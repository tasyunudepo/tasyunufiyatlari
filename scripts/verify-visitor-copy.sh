#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

mapfile -t files < <(
  {
    git diff --name-only --diff-filter=ACMRTUXB HEAD
    git ls-files --others --exclude-standard
  } \
    | sort -u \
    | rg '^(app/(?!api/|ofis/).+\.(tsx|jsx|mdx|html)|components/.+\.(tsx|jsx)|lib/(pdfGenerator\.ts|utils/whatsapp\.ts))$' -P
)

if [[ ${#files[@]} -eq 0 ]]; then
  echo 'Ziyaretçi metni kapısı: değişen müşteri yüzeyi yok.'
  exit 0
fi

patterns=(
  '\bdemo\b'
  '\bDemo\b'
  '\bplaceholder\b'
  '\bPlaceholder\b'
  '\bexample\b'
  '\bExample\b'
  '\bmock\b'
  '\bMock\b'
  '\bözellik\b'
  '\bözellikler\b'
  '\bbu bölüm\b'
  '\bburada\b'
  '\btemsilidir\b'
  '\byapay zek'
  '\bAI\b'
  'Lorem ipsum'
  'hemen keşfet'
  'daha fazla bilgi'
  'sizler için'
  'kaliteli hizmet'
  'profesyonel çözümler'
  'ihtiyaçlarınıza özel'
  'müşteri memnuniyeti'
)

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

for file in "${files[@]}"; do
  [[ -f "$file" ]] || continue
  for pattern in "${patterns[@]}"; do
    if rg -n --with-filename --pcre2 "$pattern" "$file" >>"$tmp" 2>/dev/null; then
      :
    fi
  done
done

# JSX placeholder attribute'ı ve CSS placeholder seçicisi yayın metni değildir.
if [[ -s "$tmp" ]]; then
  sed -i -E '/placeholder=|placeholder:/d' "$tmp"
fi

if [[ -s "$tmp" ]]; then
  echo 'Ziyaretçi metni kapısı başarısız:' >&2
  head -80 "$tmp" >&2
  exit 1
fi

echo 'Ziyaretçi metni kapısı geçti.'
