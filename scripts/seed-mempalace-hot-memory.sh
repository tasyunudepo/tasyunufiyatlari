#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mempalace_python="${MEMPALACE_PYTHON:-$HOME/.local/share/uv/tools/mempalace/bin/python}"

if [[ ! -x "$mempalace_python" ]]; then
  echo "MemPalace Python bulunamadı: $mempalace_python" >&2
  echo "MEMPALACE_PYTHON ile doğru yolu belirtin." >&2
  exit 1
fi

exec "$mempalace_python" \
  "$repo_root/scripts/seed-mempalace-hot-memory.py" \
  --root "$repo_root" \
  "$@"

