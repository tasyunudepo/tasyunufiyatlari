#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="tasyunu-comparison-attribution-${$}"

cleanup() {
  if docker inspect "$container" >/dev/null 2>&1; then
    docker rm -f "$container" >/dev/null
  fi
}
trap cleanup EXIT

docker run --rm -d \
  --name "$container" \
  --network none \
  -e POSTGRES_PASSWORD=comparison_attribution_test \
  postgres:16-alpine >/dev/null

ready_count=0
for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
    ready_count=$((ready_count + 1))
    if [[ "$ready_count" -ge 2 ]]; then
      break
    fi
  else
    # İlk init sunucusu kısa süre hazır görünüp yeniden başlayabilir.
    ready_count=0
  fi
  sleep 1
done

if [[ "$ready_count" -lt 2 ]]; then
  echo 'PostgreSQL comparison attribution test containerı hazır olmadı.' >&2
  exit 1
fi

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$repo_root/tests/db/quote-guard-bootstrap.sql" >/dev/null
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$repo_root/scripts/migration-v17-quote-submission-guard.sql" >/dev/null
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$repo_root/tests/db/comparison-attribution-bootstrap.sql" >/dev/null

# İkinci uygulama, migration'ın yeniden çalıştırılabilirliğini de kanıtlar.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$repo_root/scripts/migration-v26-comparison-attribution.sql" >/dev/null
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$repo_root/scripts/migration-v26-comparison-attribution.sql" >/dev/null
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$repo_root/tests/db/comparison-attribution-call.sql" >/dev/null

echo 'Comparison attribution DB smoke geçti: v26 idempotent; RPC → quote → event → CRM origin zinciri doğrulandı.'
