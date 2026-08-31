#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo '1/8 Kabul sözleşmesi'
node scripts/verify-acceptance-lock.mjs

echo '2/8 Ziyaretçi metni'
bash scripts/verify-visitor-copy.sh

echo '3/8 Unit, API, contract ve typecheck'
npm run verify:fast

echo '4/8 P0 değişiklik alanı lint'
npx eslint \
  app/api/admin/material-types/[id]/route.ts \
  app/api/admin/quotes/[id]/pdf/route.ts \
  app/api/import app/api/products/bulk-insert \
  app/api/quotes/route.ts app/api/upload-pdf/route.ts \
  components/analytics components/catalog components/quote \
  components/wizard/WizardCalculator.tsx components/wizard/WizardStep4.tsx \
  lib/analytics lib/catalog/pricing.ts lib/catalog/server.ts \
  lib/notifications.ts lib/notifyWizardEvent.ts lib/pdfGenerator.ts \
  lib/pricing lib/schemas/quote.schema.ts lib/security \
  tests

echo '5/8 Gerçek PostgreSQL quote guard'
npm run test:db:quote-guard

echo '6/8 Production dependency yüksek/kritik eşik'
npm audit --omit=dev --audit-level=high

echo '7/8 Production build'
npm run build

echo '8/9 Kritik tarayıcı akışları'
CI=1 npm run test:e2e -- --workers=1 --retries=0

# 27 Temmuz 2026: kullanıcı hem panelde hem ana sayfada "OKUNMUYOR" dedi ve
# haklıydı — 578 birim testinin ve 36 E2E testinin hiçbiri bir yazının
# okunup okunmadığını sormuyordu. Bu kapı o boşluğu kapatır: kontrast
# EKRANDAKİ GERÇEK PİKSEL üzerinden ölçülür, kaynak taraması yetmez.
echo '9/9 Okunabilirlik (WCAG AA kontrast, gerçek ekran ölçümü)'
contrast_port="$(node -e "const net=require('node:net');const server=net.createServer();server.listen(0,'127.0.0.1',()=>{console.log(server.address().port);server.close()})")"
contrast_base_url="http://127.0.0.1:${contrast_port}"
contrast_log="$(mktemp "${TMPDIR:-/tmp}/tasyunu-contrast.XXXXXX.log")"
contrast_server_pid=""

cleanup_contrast_server() {
  if [[ -n "$contrast_server_pid" ]] && kill -0 "$contrast_server_pid" 2>/dev/null; then
    kill "$contrast_server_pid" 2>/dev/null || true
    wait "$contrast_server_pid" 2>/dev/null || true
  fi
  rm -f "$contrast_log"
}
trap cleanup_contrast_server EXIT INT TERM

node node_modules/next/dist/bin/next start \
  --hostname 127.0.0.1 \
  --port "$contrast_port" \
  >"$contrast_log" 2>&1 &
contrast_server_pid="$!"

contrast_ready=false
for _ in {1..30}; do
  if curl --fail --silent --show-error "$contrast_base_url/" >/dev/null 2>&1; then
    contrast_ready=true
    break
  fi
  if ! kill -0 "$contrast_server_pid" 2>/dev/null; then
    cat "$contrast_log" >&2
    exit 1
  fi
  sleep 1
done

if [[ "$contrast_ready" != true ]]; then
  cat "$contrast_log" >&2
  echo 'Kontrast denetimi için production sunucusu hazır olmadı.' >&2
  exit 1
fi

AUDIT_BASE_URL="$contrast_base_url" npm run verify:contrast
cleanup_contrast_server
trap - EXIT INT TERM

echo 'P0 yerel release kapısı geçti. Canlı RLS/storage/env smoke ayrıca zorunludur.'
