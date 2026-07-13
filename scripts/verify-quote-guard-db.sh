#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container="tasyunu-quote-guard-${$}"
tmp_dir="$(mktemp -d)"

cleanup() {
  if docker inspect "$container" >/dev/null 2>&1; then
    docker rm -f "$container" >/dev/null
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

docker run --rm -d \
  --name "$container" \
  --network none \
  -e POSTGRES_PASSWORD=quote_guard_test \
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

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$repo_root/tests/db/quote-guard-bootstrap.sql" >/dev/null
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$repo_root/scripts/migration-v17-quote-submission-guard.sql" >/dev/null

pids=()
for index in $(seq 1 10); do
  docker exec -i "$container" psql -U postgres -qAt -v ON_ERROR_STOP=1 \
    < "$repo_root/tests/db/quote-guard-call.sql" \
    > "$tmp_dir/outcome-${index}.txt" &
  pids+=("$!")
done

for pid in "${pids[@]}"; do
  wait "$pid"
done

created_count="$(awk '$0 == "created" { count += 1 } END { print count + 0 }' "$tmp_dir"/outcome-*.txt)"
replayed_count="$(awk '$0 == "replayed" { count += 1 } END { print count + 0 }' "$tmp_dir"/outcome-*.txt)"
db_counts="$(docker exec "$container" psql -U postgres -qAt -v ON_ERROR_STOP=1 -c \
  "SELECT (SELECT count(*) FROM public.quotes) || ':' || (SELECT count(*) FROM public.quote_funnel_events) || ':' || (SELECT count(*) FROM public.quote_rate_limit_events);")"

if [[ "$created_count" != '1' || "$replayed_count" != '9' || "$db_counts" != '1:1:1' ]]; then
  echo "Eşzamanlılık kontratı başarısız: created=${created_count}, replayed=${replayed_count}, db=${db_counts}" >&2
  exit 1
fi

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 \
  < "$repo_root/tests/db/quote-guard-rate-limit.sql" >/dev/null

echo 'Quote guard DB smoke geçti: 10 tekrar → 1 quote, 1 event, 1 rate kaydı; telefon limiti 429 sözleşmesine hazır.'
