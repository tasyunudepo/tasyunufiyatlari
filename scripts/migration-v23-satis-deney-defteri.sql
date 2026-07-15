-- ============================================================
-- Migration v23 — Satış deney defteri (Sprint 4A)
-- Tarih: 2026-07-15
--
-- Satış Hipotez Motoru'nun veri sözleşmesi katmanı: her satış fikri
-- bir "deney sözleşmesi" olarak kaydedilir (problem → yüzey → metrik →
-- koruma → sonuç → karar). Motorun beyni (teşhis/öneri/otomasyon)
-- Sprint 4B'de, yeterli kapanmış teklif birikince açılır.
--
-- GİZLİLİK: tablo yalnız admin yüzeyinde kullanılır; RLS açık ve anon
-- policy YOK (yalnız service role okur/yazar).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sales_experiments (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  -- Hipotez sözleşmesi alanları (ölçüm sözleşmesindeki şablon)
  hypothesis     TEXT NOT NULL,
  target_visitor TEXT NULL,
  surface        TEXT NOT NULL,
  primary_metric TEXT NOT NULL,
  guardrails     TEXT NULL,
  status         TEXT NOT NULL DEFAULT 'yayinda'
                 CHECK (status IN ('yayinda', 'duraklatildi', 'tamamlandi')),
  decision       TEXT NULL
                 CHECK (decision IS NULL OR decision IN ('yayinla', 'geri_al', 'gelistir', 'veri_yetersiz')),
  result_summary TEXT NULL,
  started_at     DATE NOT NULL,
  ended_at       DATE NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_experiments_tarih_tutarli
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

ALTER TABLE public.sales_experiments ENABLE ROW LEVEL SECURITY;

-- Geriye dönük ilk deneyler: yüzeyler 14 Temmuz 2026'da canlıya alındı;
-- öncesi/sonrası çizgisinin bulanıklaşmaması için başlangıçlar kayda girer.
INSERT INTO public.sales_experiments
  (name, hypothesis, target_visitor, surface, primary_metric, guardrails, started_at)
SELECT * FROM (VALUES
  (
    'Bonus Meydan Okuma yüzeyleri',
    'Filli grubu ürününe bakan müşteriye aynı koşullu Bonus farkını gösterirsek nitelikli Bonus teklif oranı artar; çünkü müşteri alternatifi yeniden aramak zorunda kalmadan gerçek toplam farkı görür.',
    'Filli grubu fiyatı araştıran mantolama müşterisi',
    'Wizard sonucu meydan okuma kartı + Filli PDP alternatif kartı + ana sayfa bandı',
    'Nitelikli Bonus teklif oranı (Bonus teklif / meydan okuma gösterimi)',
    'Fark yalnız aynı koşulda ve gerçek hesaptan; Bonus pahalıysa kart çıkmaz; brüt kâr müşteri yüzeyine inmez.',
    DATE '2026-07-14'
  ),
  (
    'Bonus PDP canlı bölge fiyatı ve araç toplamları',
    'Bonus ürün sayfasında bölge fiyatı ve kamyon/TIR toplamını sayfadan ayrılmadan gösterirsek PDP''den hesaplayıcıya/teklife geçiş artar; çünkü müşteri cebinden çıkacak gerçek tutarı görür.',
    'SEO/katalogdan Bonus PDP''sine gelen ziyaretçi',
    'Bonus PDP bölge fiyat kutusu (yaka varsayılanlı) + 1 Kamyon / 1 TIR toplamları',
    'Bonus PDP → teklif dönüşümü',
    'Fiyat sunucuda hesaplanır; taban/iskonto istemciye inmez; yaka seçilmeden kesin fiyat gösterilmez.',
    DATE '2026-07-14'
  ),
  (
    'Karşılaştırma Merkezi (8 ürün + 150 görünümü)',
    'Teknik ve ticari kıyası tek sayfada föy etiketleriyle sunarsak karşılaştırma → teklif geçişi ve SEO trafiği artar; çünkü müşteri karar için siteden ayrılmak zorunda kalmaz.',
    'Yoğunluk/fiyat karşılaştırması arayan araştırmacı müşteri',
    '/tasyunu-karsilastir + /tasyunu-yogunluk/150-kg-m3 + PDP çapraz linkleri',
    'Karşılaştırma → teklif geçiş oranı (Karsilastirma_Acildi → teklif)',
    'Föyde olmayan değer yazılmaz; sözlü beyan etiketi zorunlu; koşul eşitliği sağlanmadan fiyat kıyası gösterilmez.',
    DATE '2026-07-14'
  )
) AS v(name, hypothesis, target_visitor, surface, primary_metric, guardrails, started_at)
WHERE NOT EXISTS (
  SELECT 1 FROM public.sales_experiments e WHERE e.name = v.name
);

DO $v23$
DECLARE n INTEGER;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.sales_experiments'::regclass) THEN
    RAISE EXCEPTION 'sales_experiments RLS açık değil.';
  END IF;
  SELECT count(*) INTO n FROM public.sales_experiments;
  IF n < 3 THEN
    RAISE EXCEPTION 'Deney tohumları eksik: en az 3 bekleniyordu, % bulundu.', n;
  END IF;
END;
$v23$;

COMMIT;

-- Geri almak için:
--   DROP TABLE IF EXISTS public.sales_experiments;
