#!/usr/bin/env bash
# Supabase REST API → JSON yedek
# Sadece tablo verileri (schema/RLS/policy/sequence/trigger korunmaz).
# Tam restore için pg_dump gerekir. Bu yedek "yangın halinde veri elimde" garantisidir.
set -euo pipefail

# .env.local içeriğini güvenli yükle (`source` JWT'yi komut sanabiliyor)
SUPA_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
SUPA_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')

if [[ -z "$SUPA_URL" || -z "$SUPA_KEY" ]]; then
  echo "FATAL: Supabase env okunamadı" >&2
  exit 1
fi

OUT_DIR="_audit/backup-2026-05-21"
mkdir -p "$OUT_DIR"

TABLES=(
  accessories accessories_backup_20260501 accessory_match_catalog accessory_types
  brands import_apply_logs import_match_results logistics_capacity
  material_types package_definitions package_items packages payment_terms
  plate_prices plate_prices_backup_20260317 plate_prices_staging plates
  plates_backup_20260501 product_categories products quote_funnel_events quotes
  raw_import_files raw_import_rows shipping_districts shipping_zones
)

MANIFEST="$OUT_DIR/_manifest.txt"
: > "$MANIFEST"
echo "Supabase REST backup — $(date -Iseconds)" >> "$MANIFEST"
echo "Project: ${SUPA_URL}" >> "$MANIFEST"
echo "----" >> "$MANIFEST"

for tbl in "${TABLES[@]}"; do
  out_file="$OUT_DIR/${tbl}.json"
  # Range header ile up to 100k satır + Content-Range gözle
  resp_headers=$(mktemp)
  curl -sS -D "$resp_headers" \
    "${SUPA_URL}/rest/v1/${tbl}?select=*" \
    -H "apikey: ${SUPA_KEY}" \
    -H "Authorization: Bearer ${SUPA_KEY}" \
    -H "Range-Unit: items" \
    -H "Range: 0-99999" \
    -H "Prefer: count=exact" \
    -o "$out_file"

  content_range=$(grep -i '^content-range:' "$resp_headers" | tr -d '\r' || true)
  rm -f "$resp_headers"

  if [[ ! -s "$out_file" ]] || head -c 1 "$out_file" | grep -qv '\['; then
    # Boş dosya veya array değil → hata muhtemel
    bytes=$(wc -c < "$out_file" 2>/dev/null || echo 0)
    printf "%-40s  FAIL  bytes=%s  range=%s\n" "$tbl" "$bytes" "$content_range" >> "$MANIFEST"
    echo "[FAIL] $tbl ($bytes bytes)" >&2
    continue
  fi

  rows=$(python3 -c "import json,sys; print(len(json.load(open('$out_file'))))" 2>/dev/null || echo "?")
  bytes=$(wc -c < "$out_file")
  printf "%-40s  rows=%-7s  bytes=%-10s  %s\n" "$tbl" "$rows" "$bytes" "$content_range" >> "$MANIFEST"
  echo "[OK] $tbl rows=$rows"
done

echo "----" >> "$MANIFEST"
echo "Done. Manifest: $MANIFEST"
