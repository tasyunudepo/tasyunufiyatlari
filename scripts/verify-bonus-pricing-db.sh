#!/usr/bin/env bash
set -euo pipefail

# Migration v19 + v19b sözleşme testi — gerçek PostgreSQL:
#   bootstrap → v18 → v19 → v19b → assert → v19/v19b tekrar (idempotency) → assert

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="tasyunu-bonus-pricing-${$}"

cleanup() {
  if docker inspect "$container" >/dev/null 2>&1; then
    docker rm -f "$container" >/dev/null
  fi
}
trap cleanup EXIT

docker run --rm -d \
  --name "$container" \
  --network none \
  -e POSTGRES_PASSWORD=bonus_pricing_test \
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
run_sql scripts/migration-v19-bonus-region-pricing.sql
run_sql scripts/migration-v19b-seed-bonus-region-prices.sql
run_sql tests/db/bonus-pricing-assert.sql
run_sql scripts/migration-v19-bonus-region-pricing.sql            # idempotency
run_sql scripts/migration-v19b-seed-bonus-region-prices.sql       # idempotency
run_sql tests/db/bonus-pricing-assert.sql
run_sql tests/db/technical-profiles-assert.sql                    # v18 regresyonu

echo 'Bonus fiyat DB sözleşmesi geçti: 231 hücre, golden değerler, marka marjı, şehir eşlemesi, RLS ve idempotency doğru.'
