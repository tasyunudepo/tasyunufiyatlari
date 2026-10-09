#!/usr/bin/env bash
# İlk aktarım provası — yerel sentetik yığın üzerinde (node scripts/ofis-test/start.mjs
# çalışıyor olmalı). Veritabanı başta yedeklenir, çıkışta her durumda geri yüklenir.
#
#   bash scripts/ofis-aktarim/prova.sh
#
# Sınananlar: (1) temiz koşu, (2) ikinci koşunun kayıt eklememesi, (3) aktarımın
# her işlemden sonra kesilip yeniden koşulması, (4) operatörün çalışmaya başladığı
# projeye dokunulmaması.
set -u
KOK="$(cd "$(dirname "$0")/../.." && pwd)"; BURASI="$KOK/scripts/ofis-aktarim"
export PGHOST=/tmp/ofis-test-20261008/socket PGPORT=55438 PGUSER=ofis_test_owner PGDATABASE=ofis_acceptance
export OFIS_AKTARIM_USER=preview OFIS_AKTARIM_PASSWORD=preview-only
TABAN=http://127.0.0.1:3210
[ "$(psql -XAtc "select current_setting('data_directory')||'|'||current_setting('port')")" = "/tmp/ofis-test-20261008/data|55438" ] || { echo "Hedef yerel test veritabanı değil; prova reddedildi."; exit 2; }
GECICI="$(mktemp -d)"; SONUC=0
geri_yukle() {
  echo "=== geri yükleme"
  pg_restore --clean --if-exists --single-transaction -d "$PGDATABASE" "$GECICI/once.dump" 2>&1 | tail -3
  psql -Xq -c "NOTIFY pgrst, 'reload schema'"
  [ "$(sayim)" = "$ONCE" ] && echo "SONUÇ: veritabanı prova öncesi hâlinde ($ONCE)" || { echo "SONUÇ: GERİ YÜKLEME FARKLI — önce [$ONCE] şimdi [$(sayim)]"; SONUC=1; }
  rm -rf "$GECICI"; exit $SONUC
}
sayim() { psql -XAt -F ' ' -c "select 'teklif', count(*) from quotes union all select 'bağlı', count(*) from quotes where project_id is not null union all select 'proje', count(*) from sales_projects union all select 'iş', count(*) from sales_tasks union all select 'işlem', count(*) from office_operations" | tr '\n' ' ' | sed 's/ $//'; }
ozet() { psql -XAt -F ' | ' -c "select 'proje', count(*) from sales_projects union all select 'değeri seçili proje', count(*) from sales_projects where valuation_quote_id is not null union all select 'bağlı teklif', count(*) from quotes where project_id is not null union all select 'iş: '||kind||' / '||status, count(*) from sales_tasks group by kind,status union all select 'işlem: '||operation_type, count(*) from office_operations group by operation_type union all select 'görüşme kaydı (projeye bağlı)', count(*) from customer_interactions where project_id is not null order by 1"; }
# Proje bazında imza: ad, sorumlu, aşama, bağlı teklifler, değer, işler.
imza() { psql -XAt -F ' | ' -c "select p.name, p.owner, p.status, (select string_agg(q.quote_code, ',' order by q.id) from quotes q where q.project_id=p.id), (select quote_code from quotes where id=p.valuation_quote_id), p.valuation_revision, p.valuation_net_amount, (select string_agg(t.kind||'/'||t.status||'/'||to_char(t.due_at at time zone 'Europe/Istanbul','MM-DD HH24:MI')||'/'||t.owner||'/'||coalesce(t.cancellation_reason,''), ' ; ' order by t.kind) from sales_tasks t where t.project_id=p.id) from sales_projects p order by 1,4"; }
kos() { node "$BURASI/run.mjs" --taban "$TABAN" "$@" 2>&1; }
suz() { sed -n "/okundu\|^kapsam\|^açılacak\|^ilk temas\|^✓\|^✗\|^→\|^!\|Aktarım\|Yazılacak\|proje açıldı\|açılan ilk/p"; }
sifirla() { psql -X -v ON_ERROR_STOP=1 -q -f "$BURASI/prova-sifirla.sql"; }

ONCE="$(sayim)"; pg_dump -Fc -f "$GECICI/once.dump" || exit 2
trap geri_yukle EXIT

sifirla || exit 2
echo "=== 1. temiz koşu"; kos --uygula | suz
imza > "$GECICI/imza.txt"; ozet > "$GECICI/ozet.txt"; cat "$GECICI/ozet.txt"
TOPLAM=$(psql -XAtc "select count(*) from office_operations")
[ "$TOPLAM" -gt 0 ] || { echo "SONUÇ: temiz koşu kayıt yazmadı"; SONUC=1; exit; }

echo "=== 2. ikinci koşu"; kos --uygula | suz | tail -3
imza | diff -q - "$GECICI/imza.txt" >/dev/null && ozet | diff -q - "$GECICI/ozet.txt" >/dev/null && echo "SONUÇ: ikinci koşu kayıt eklemedi" || { echo "SONUÇ: ikinci koşu durumu DEĞİŞTİRDİ"; SONUC=1; }

echo "=== 3. kesinti taraması (1..$((TOPLAM-1)). işlemden sonra süreç öldürülür, sonra yeniden koşulur)"
gecen=0; kalan=()
for n in $(seq 1 $((TOPLAM-1))); do
  sifirla || exit 2
  KES_SONRA=$n node --import "$BURASI/prova-kes.mjs" "$BURASI/run.mjs" --taban "$TABAN" --uygula >/dev/null 2>&1; kod=$?
  yarim=$(psql -XAtc "select count(*) from office_operations")
  kos --uygula > "$GECICI/devam.log" || { echo "N=$n devam koşusu hata verdi: $(grep '✗' "$GECICI/devam.log")"; kalan+=("$n"); continue; }
  if [ "$kod" = 137 ] && [ "$yarim" = "$n" ] && imza | diff -q - "$GECICI/imza.txt" >/dev/null && ozet | diff -q - "$GECICI/ozet.txt" >/dev/null; then gecen=$((gecen+1)); else kalan+=("$n"); echo "N=$n FARKLI (çıkış $kod, yarıda $yarim işlem)"; fi
done
echo "SONUÇ: kesinti noktası $((TOPLAM-1)) · temiz koşuyla aynı: $gecen · farklı: ${#kalan[@]} ${kalan[*]:-}"
[ "${#kalan[@]}" = 0 ] || SONUC=1

echo "=== 4. operatörün çalışmaya başladığı proje + aynı müşteriden yeni teklif"
PID=$(psql -XAtc "select p.id from sales_projects p join sales_tasks t on t.project_id=p.id and t.status='open' and t.kind='initial_contact' order by p.name limit 1")
TID=$(psql -XAtc "select id from sales_tasks where project_id='$PID' and status='open'")
QID=$(psql -XAtc "select min(id) from quotes where project_id='$PID'")
curl -s -u "$OFIS_AKTARIM_USER:$OFIS_AKTARIM_PASSWORD" -X POST "$TABAN/api/admin/office/operations" -H 'content-type: application/json' -H "idempotency-key: $(uuidgen)" \
  -d "{\"type\":\"contact_success\",\"projectId\":\"$PID\",\"channel\":\"phone\",\"taskId\":\"$TID\",\"note\":\"Prova görüşmesi\"}" | grep -q '"ok":true' || { echo "SONUÇ: prova görüşmesi kaydedilemedi"; SONUC=1; }
COLS=$(psql -XAtc "select string_agg(quote_ident(column_name), ',') from information_schema.columns where table_schema='public' and table_name='quotes' and is_generated='NEVER' and column_name not in ('id','quote_code','project_id','created_at')")
psql -X -v ON_ERROR_STOP=1 -q -c "INSERT INTO quotes(id,quote_code,project_id,created_at,$COLS) SELECT (select max(id)+1 from quotes),'TE-2026-PROVA1',null,now(),$COLS FROM quotes WHERE id=$QID" || SONUC=1
durum() { psql -XAt -F ' | ' -c "select valuation_net_amount, status, (select count(*) from sales_tasks where project_id=p.id), (select count(*) from quotes where project_id=p.id) from sales_projects p where id='$PID'"; }
onceki="$(durum)"; kos --uygula | suz | grep -v "okundu\|^kapsam\|^ilk temas"; sonraki="$(durum)"
bagli=$(psql -XAtc "select count(*) from quotes where quote_code='TE-2026-PROVA1' and project_id is not null")
[ "$onceki" = "$sonraki" ] && [ "$bagli" = 0 ] && echo "SONUÇ: projeye dokunulmadı; yeni teklifin bağlanması operatöre bırakıldı (değer | aşama | iş | teklif: $sonraki)" || { echo "SONUÇ: BEKLENMEYEN — önce [$onceki] sonra [$sonraki] bağlanan=$bagli"; SONUC=1; }
