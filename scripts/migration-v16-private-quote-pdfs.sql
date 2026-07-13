-- ============================================================
-- MIGRATION v16 - Teklif PDF'lerini özel bucket'a taşı
--
-- Amaç:
-- - quote-pdfs bucket'ını public erişime kapatmak
-- - istemciye kalıcı public URL yerine kısa ömürlü signed URL vermek
-- - quotes kaydında yalnızca server tarafından üretilen storage path tutmak
-- ============================================================

BEGIN;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS pdf_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT NULL;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'quote-pdfs',
  'quote-pdfs',
  false,
  5242880,
  ARRAY['application/pdf']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bu bucket için daha önce eklenmiş public/anon/auth object policy'lerini
-- kaldır. Service-role RLS'yi bypass ettiği için API yükleme/okuma akışı
-- çalışmaya devam eder.
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%quote-pdfs%'
        OR COALESCE(with_check, '') ILIKE '%quote-pdfs%'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      policy_row.policyname
    );
  END LOOP;
END
$$;

-- Eski public URL'ler artık kullanılmamalı. Storage path varsa korunur;
-- admin endpoint'i gerektiğinde signed URL üretir.
UPDATE public.quotes
SET pdf_url = NULL
WHERE pdf_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_pdf_storage_path
  ON public.quotes(pdf_storage_path)
  WHERE pdf_storage_path IS NOT NULL;

COMMIT;

-- Uygulama sonrası doğrulama:
-- SELECT id, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets WHERE id = 'quote-pdfs';
-- Beklenen: public = false, file_size_limit = 5242880.
