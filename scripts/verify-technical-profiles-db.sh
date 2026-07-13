#!/usr/bin/env bash
set -euo pipefail

# Migration v18 sözleşme testi — gerçek PostgreSQL üzerinde:
#   1) bootstrap şema + mevcut 5 levha
#   2) v18 uygula
#   3) v18'i İKİNCİ kez uygula (idempotency)
#   4) assert: kayıtlar, etiketler, TR7.5 ayrımı, Bonus pasifliği, RLS
#   5) v18b rollback uygula
#   6) assert: temiz geri dönüş, mevcut veri dokunulmamış
#   7) v18'i yeniden uygula (rollback sonrası tekrar kurulabilirlik)

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="tasyunu-technical-profiles-${$}"

cleanup() {
  if docker inspect "$container" >/dev/null 2>&1; then
    docker rm -f "$container" >/dev/null
  fi
}
trap cleanup EXIT

docker run --rm -d \
  --name "$container" \
  --network none \
  -e POSTGRES_PASSWORD=technical_profiles_test \
  postgres:16-alpine >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
  echo 'PostgreSQL test containerı hazır olmadı.' >&2
  exit 1
fi

run_sql() {
  docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
    < "$repo_root/$1" >/dev/null
}

run_sql tests/db/technical-profiles-bootstrap.sql
run_sql scripts/migration-v18-plate-technical-profiles.sql
run_sql scripts/migration-v18-plate-technical-profiles.sql   # idempotency
run_sql tests/db/technical-profiles-assert.sql
run_sql scripts/migration-v18b-rollback-plate-technical-profiles.sql
run_sql tests/db/technical-profiles-post-rollback.sql
run_sql scripts/migration-v18-plate-technical-profiles.sql   # yeniden kurulabilirlik
run_sql tests/db/technical-profiles-assert.sql

echo 'Teknik profil DB sözleşmesi geçti: v18 idempotent, RLS sınırı sağlam, v18b temiz geri dönüyor.'
