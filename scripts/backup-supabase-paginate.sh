#!/usr/bin/env bash
# 1000+ satırlık tablolar için sayfa sayfa çek, birleştir.
set -euo pipefail

SUPA_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
SUPA_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')

OUT_DIR="_audit/backup-2026-05-21"
PAGE_SIZE=1000

TABLES=("$@")

for tbl in "${TABLES[@]}"; do
  out_file="$OUT_DIR/${tbl}.json"
  tmp_dir=$(mktemp -d)
  total=""
  offset=0
  page=0

  while :; do
    page_file="$tmp_dir/page-$page.json"
    headers=$(mktemp)
    end=$((offset + PAGE_SIZE - 1))
    curl -sS -D "$headers" \
      "${SUPA_URL}/rest/v1/${tbl}?select=*&order=id.asc" \
      -H "apikey: ${SUPA_KEY}" \
      -H "Authorization: Bearer ${SUPA_KEY}" \
      -H "Range-Unit: items" \
      -H "Range: ${offset}-${end}" \
      -H "Prefer: count=exact" \
      -o "$page_file"

    range=$(grep -i '^content-range:' "$headers" | tr -d '\r' | awk '{print $2}')
    rm -f "$headers"

    if [[ -z "$range" ]]; then
      echo "[$tbl] range header missing — abort" >&2
      break
    fi

    if [[ -z "$total" ]]; then
      total=${range##*/}
    fi

    got=$(python3 -c "import json; print(len(json.load(open('$page_file'))))")
    echo "[$tbl] page=$page offset=$offset got=$got total=$total"

    offset=$((offset + got))
    page=$((page + 1))

    if [[ "$got" -lt "$PAGE_SIZE" ]] || [[ "$offset" -ge "$total" ]]; then
      break
    fi
  done

  # Sayfaları tek JSON array'e birleştir
  python3 -c "
import json, glob, sys
rows = []
for f in sorted(glob.glob('$tmp_dir/page-*.json')):
    rows.extend(json.load(open(f)))
json.dump(rows, open('$out_file', 'w'))
print('  merged rows=', len(rows))
"
  rm -rf "$tmp_dir"
done
