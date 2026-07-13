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

echo '8/8 Kritik tarayıcı akışları'
npm run test:e2e

echo 'P0 yerel release kapısı geçti. Canlı RLS/storage/env smoke ayrıca zorunludur.'

