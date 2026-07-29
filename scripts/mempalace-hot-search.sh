#!/usr/bin/env bash
set -euo pipefail

wing="tasyunufiyatlari"
room="hot-memory"
results="5"
archive="false"

usage() {
  cat <<'EOF'
Kullanım:
  bash scripts/mempalace-hot-search.sh [--wing WING] [--results N] [--archive] "sorgu"

Varsayılan arama yalnızca tasyunufiyatlari/hot-memory odasında çalışır.
--archive seçeneği aynı wing içindeki ham/eski odaları da arar.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wing)
      wing="${2:?--wing için değer gerekli}"
      shift 2
      ;;
    --results)
      results="${2:?--results için değer gerekli}"
      shift 2
      ;;
    --archive)
      archive="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Bilinmeyen seçenek: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      break
      ;;
  esac
done

if [[ $# -eq 0 ]]; then
  usage >&2
  exit 2
fi

query="$*"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mempalace_bin="${MEMPALACE_BIN:-$HOME/.local/bin/mempalace}"

if [[ ! -x "$mempalace_bin" ]]; then
  echo "MemPalace komutu bulunamadı: $mempalace_bin" >&2
  exit 1
fi

if [[ "$archive" == "true" ]]; then
  echo "UYARI: Arşiv modu eski veya güncelliğini yitirmiş sonuçlar döndürebilir." >&2
  exec "$mempalace_bin" search "$query" --wing "$wing" --results "$results"
fi

verify_args=(--verify-only)
if [[ -n "${MEMPALACE_HOT_MANIFEST:-}" ]]; then
  verify_args+=(--manifest "$MEMPALACE_HOT_MANIFEST")
fi
bash "$repo_root/scripts/seed-mempalace-hot-memory.sh" "${verify_args[@]}" >&2

exec "$mempalace_bin" search "$query" \
  --wing "$wing" \
  --room "$room" \
  --results "$results"
