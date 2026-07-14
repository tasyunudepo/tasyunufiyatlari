-- ============================================================
-- Migration v22 — Satış sonucu modeli (Sprint 0.3)
-- Tarih: 2026-07-14
--
-- Problem (Codex analizi + canlı doğrulama): teklifler formda doğuyor
-- ama satış sonucu hiçbir yerde kayda geçmiyor — 16 kayıtta temas/takip
-- alanları boş, kazanıldı/kaybedildi ayrımı ve kayıp nedeni yok. Sistem
-- "Bonus'u gören müşteri neden almadı?" sorusunu cevaplayamıyor.
--
-- Durum sözlüğü SABİTLENİR (mevcut admin akışıyla uyumlu, yeni enum yok):
--   pending → contacted → quoted → approved → completed | rejected
--   completed = KAZANILDI, rejected = KAYBEDİLDİ.
--
-- GİZLİLİK: sales_final_price ve gross_profit YALNIZ admin yüzeyinde
-- kullanılır; quotes tablosu RLS'li ve anon erişimine kapalıdır (v14).
-- Bu alanlar hiçbir müşteri yüzeyine (HTML/PDF/WhatsApp) yazılamaz —
-- copy-gate proje yasakları da bunu ayrıca denetler.
-- ============================================================

BEGIN;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS loss_category TEXT NULL,
  ADD COLUMN IF NOT EXISTS loss_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS sales_final_price NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS gross_profit NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS quoted_by TEXT NULL,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.quotes.loss_category IS
  'Kayıp nedeni kategorisi (yalnız rejected): fiyat|stok_termin|vade_odeme|ulasilamadi|rakip|vazgecti|diger';
COMMENT ON COLUMN public.quotes.loss_reason IS
  'Kayıp nedeni serbest not (satışçı girer, admin-only)';
COMMENT ON COLUMN public.quotes.sales_final_price IS
  'Satışçının müşteriye verdiği nihai fiyat (KDV hariç) — ADMIN-ONLY, müşteri yüzeyine yazılmaz';
COMMENT ON COLUMN public.quotes.gross_profit IS
  'Kazanılan siparişin brüt kârı — ADMIN-ONLY, müşteri yüzeyine yazılmaz';
COMMENT ON COLUMN public.quotes.quoted_by IS
  'Teklifle ilgilenen kişi';
COMMENT ON COLUMN public.quotes.closed_at IS
  'Kapanış anı (completed/rejected) — trigger otomatik doldurur';

-- Durum sözlüğü kapısı: serbest metin durum yazılamaz.
DO $v22a$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass AND conname = 'quotes_status_gecerli'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_status_gecerli
      CHECK (status IN ('pending','contacted','quoted','approved','rejected','completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass AND conname = 'quotes_loss_category_gecerli'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_loss_category_gecerli
      CHECK (loss_category IS NULL OR loss_category IN
        ('fiyat','stok_termin','vade_odeme','ulasilamadi','rakip','vazgecti','diger'));
  END IF;
END;
$v22a$;

-- Kapanış anı: durum completed/rejected olduğunda otomatik damgalanır
-- (yalnız ilk kapanışta; elle geri açılırsa damga korunur, tarihçe bozulmaz).
CREATE OR REPLACE FUNCTION public.quotes_set_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.status IN ('completed','rejected') AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_quotes_set_closed_at ON public.quotes;
CREATE TRIGGER trg_quotes_set_closed_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.quotes_set_closed_at();

-- Doğrulama kapıları
DO $v22b$
DECLARE n INTEGER;
BEGIN
  -- RLS açık olmalı (v14 sertleştirmesi); değilse gizli alanlar eklenemez.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.quotes'::regclass) THEN
    RAISE EXCEPTION 'quotes tablosunda RLS kapalı; v22 uygulanamaz.';
  END IF;

  SELECT count(*) INTO n FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quotes'
    AND column_name IN ('loss_category','loss_reason','sales_final_price','gross_profit','quoted_by','closed_at');
  IF n <> 6 THEN
    RAISE EXCEPTION 'v22 kolonları eksik: 6 bekleniyordu, % bulundu.', n;
  END IF;

  -- Mevcut veriler durum sözlüğüne uymalı (uymazsa transaction geri döner).
  SELECT count(*) INTO n FROM public.quotes
  WHERE status NOT IN ('pending','contacted','quoted','approved','rejected','completed');
  IF n <> 0 THEN
    RAISE EXCEPTION 'Sözlük dışı durum değeri taşıyan % kayıt var.', n;
  END IF;
END;
$v22b$;

COMMIT;

-- Geri almak için:
--   DROP TRIGGER IF EXISTS trg_quotes_set_closed_at ON public.quotes;
--   DROP FUNCTION IF EXISTS public.quotes_set_closed_at();
--   ALTER TABLE public.quotes
--     DROP CONSTRAINT IF EXISTS quotes_status_gecerli,
--     DROP CONSTRAINT IF EXISTS quotes_loss_category_gecerli,
--     DROP COLUMN IF EXISTS loss_category,
--     DROP COLUMN IF EXISTS loss_reason,
--     DROP COLUMN IF EXISTS sales_final_price,
--     DROP COLUMN IF EXISTS gross_profit,
--     DROP COLUMN IF EXISTS quoted_by,
--     DROP COLUMN IF EXISTS closed_at;
