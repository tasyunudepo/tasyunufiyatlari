-- ============================================================
-- Migration v13 — KVKK Rıza Kaydı (persist)
-- Tarih: 2026-05-11
-- Sprint: 0 / Faz 4 (Yangın Söndürme — KVKK uyum)
-- ============================================================
--
-- BAĞLAM:
--   Sitenin form taraflarında (PdfOfferModal, QuoteModal, WizardCalculator
--   quote modal) KVKK rıza checkbox'ı zorunlu olarak işaretlenmektedir.
--   Frontend Zod schema'sı (lib/schemas/quote.schema.ts → quoteSchema)
--   checkbox onayını ZORUNLU kılar; aksi hâlde form submit edilemez.
--
--   ANCAK API tarafındaki apiQuoteSchema'da kvkkConsent field'ı YOKTUR
--   (Faz 4 audit'inde tespit edildi). Zod parse extra field'ları sessizce
--   düşürür → API payload'unda consent bilgisi kaybolur.
--
--   Ayrıca mapQuotePayload (app/api/quotes/route.ts:8-51) DB'ye consent
--   yazmaz; quotes tablosunda zaten kvkk_consent / consent_timestamp /
--   consent_ip kolonları YOK.
--
--   SONUÇ: Rıza kullanıcıdan alınıyor, kanıtı hiçbir yerde tutulmuyor.
--   KVKK denetiminde "rıza kayıtlarınızı gösterin" denildiğinde elimizde
--   hiçbir delil yok.
--
-- BU MIGRATION:
--   quotes tablosuna 3 kolon ekler — kolonlar idempotent (IF NOT EXISTS).
--   API ve Zod patch'leri ayrıca kod tarafında uygulanır (kapanış
--   raporundaki "Açık Kalan Bekleyenler" listesi).
--
-- UYGULAMA:
--   1) Bu migration'ı Supabase SQL Editor'da çalıştır (önce STAGING'de).
--   2) Kod taraflarındaki 2 patch (quote.schema.ts + route.ts) deploy edilsin.
--   3) Backfill kararı (en altta) ayrıca verilsin.
-- ============================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS kvkk_consent      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip        TEXT;

COMMENT ON COLUMN quotes.kvkk_consent IS
  'KVKK rıza checkbox işaretlendi mi? Formdan gelir; varsayılan false.';
COMMENT ON COLUMN quotes.consent_timestamp IS
  'Rıza işaretlendiği anın zaman damgası (UTC).';
COMMENT ON COLUMN quotes.consent_ip IS
  'Rıza işaretleyen kullanıcının IP adresi (x-forwarded-for veya x-real-ip).';

-- ============================================================
-- BACKFILL — KULLANICI KARARI BEKLİYOR
-- ============================================================
--
-- Mevcut kayıtlar için 3 seçenek var:
--
-- A) Hiç backfill yapma. Eski kayıtlarda kvkk_consent = false kalır.
--    En güvenli, ama denetimde "neden eski kayıtlarda rıza yok?" sorusu
--    gelirse, formun checkbox'lı olduğunu Wayback Machine veya repo
--    git log'undan kanıtlamak gerekir.
--
-- B) Belirli bir tarihten sonraki kayıtları backfill et (formun
--    checkbox'lı hâlinin canlıda olduğu tarihi kullanıcı doğrulamalı):
--
--      UPDATE quotes
--      SET kvkk_consent = true,
--          consent_timestamp = created_at
--      WHERE created_at > '<CHECKBOX_GO_LIVE_DATE>';
--
-- C) Tüm geçmiş kayıtları backfill et — RİSKLİ, gerçekçi değil.
--
-- Sprint plan default'u (B): "Eğer formda checkbox zaten zorunluydu"
-- — yani checkbox eklendiği tarihten sonrasını işaretle. Karar kullanıcıya.
-- ============================================================
