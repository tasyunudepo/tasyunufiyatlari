import { randomUUID } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import {
  PdfCapabilityError,
  verifyPdfCapabilityToken,
} from '@/lib/security/pdfCapability'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const MAX_PDF_BYTES = 5 * 1024 * 1024
const DEFAULT_SIGNED_URL_TTL_SECONDS = 900
const MIN_SIGNED_URL_TTL_SECONDS = 60
const MAX_SIGNED_URL_TTL_SECONDS = 3600

function getSignedUrlTtlSeconds(): number {
  const configured = Number(process.env.QUOTE_PDF_SIGNED_URL_TTL_SECONDS)
  if (!Number.isSafeInteger(configured)) return DEFAULT_SIGNED_URL_TTL_SECONDS
  return Math.min(
    MAX_SIGNED_URL_TTL_SECONDS,
    Math.max(MIN_SIGNED_URL_TTL_SECONDS, configured),
  )
}

function invalidCapabilityResponse() {
  return NextResponse.json(
    { ok: false, error: 'PDF yükleme yetkisi geçersiz veya süresi dolmuş.' },
    { status: 403 },
  )
}

/**
 * Teklif kaydına bağlı, kısa ömürlü capability ile private PDF yükler.
 * Dosya yolu istemciden alınmaz; tekrar yükleme ve overwrite kapalıdır.
 */
export async function POST(req: NextRequest) {
  let uploadedPath: string | null = null
  let quoteId: number | null = null
  let supabase: ReturnType<typeof createServerSupabaseClient> | null = null

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const capability = formData.get('capability')
    const rawQuoteId = formData.get('quoteId')

    if (
      typeof rawQuoteId !== 'string'
      || !/^[1-9]\d{0,15}$/.test(rawQuoteId)
      || typeof capability !== 'string'
    ) {
      return invalidCapabilityResponse()
    }

    quoteId = Number(rawQuoteId)
    if (!Number.isSafeInteger(quoteId)) return invalidCapabilityResponse()

    try {
      verifyPdfCapabilityToken(capability, {
        expectedQuoteId: rawQuoteId,
        expectedAction: 'upload',
      })
    } catch (error) {
      if (error instanceof PdfCapabilityError) return invalidCapabilityResponse()
      throw error
    }

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { ok: false, error: 'Geçersiz dosya.' },
        { status: 400 },
      )
    }

    if (file.size === 0 || file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Dosya boyutu 0–5MB aralığında olmalı.' },
        { status: 400 },
      )
    }

    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json(
        { ok: false, error: 'Sadece PDF kabul edilir.' },
        { status: 400 },
      )
    }

    const headBytes = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    if (
      headBytes[0] !== 0x25
      || headBytes[1] !== 0x50
      || headBytes[2] !== 0x44
      || headBytes[3] !== 0x46
    ) {
      return NextResponse.json(
        { ok: false, error: 'Dosya PDF formatında değil.' },
        { status: 400 },
      )
    }

    supabase = createServerSupabaseClient()

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, request_type, pdf_storage_path')
      .eq('id', quoteId)
      .maybeSingle()

    if (quoteError) {
      console.error('[upload-pdf] Teklif doğrulanamadı:', quoteError.message)
      return NextResponse.json(
        { ok: false, error: 'Teklif doğrulanamadı.' },
        { status: 500 },
      )
    }

    // 'manual_quote' = /ofis'te elle yazılan teklif. Bu kapı açılmazsa elle
    // teklifin PDF'i sessizce 403 alır ve arşivlenmez. Capability tokenı
    // yine zorunlu — yetki gevşemiyor, yalnız kanal tanınıyor.
    const PDF_UPLOAD_ALLOWED_TYPES = ['pdf_quote', 'manual_quote']
    if (!quote || !PDF_UPLOAD_ALLOWED_TYPES.includes(quote.request_type)) {
      return invalidCapabilityResponse()
    }

    if (quote.pdf_storage_path) {
      return NextResponse.json(
        { ok: false, error: 'Bu teklif için PDF zaten yüklenmiş.' },
        { status: 409 },
      )
    }

    uploadedPath = `${quoteId}/${randomUUID()}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('quote-pdfs')
      .upload(uploadedPath, file, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload-pdf] Storage yüklemesi başarısız:', uploadError.message)
      return NextResponse.json(
        { ok: false, error: 'Dosya yüklenemedi.' },
        { status: 500 },
      )
    }

    const { data: attachedQuote, error: attachError } = await supabase
      .from('quotes')
      .update({ pdf_storage_path: uploadedPath, pdf_url: null })
      .eq('id', quoteId)
      .is('pdf_storage_path', null)
      .select('id')
      .maybeSingle()

    if (attachError || !attachedQuote) {
      await supabase.storage.from('quote-pdfs').remove([uploadedPath])
      uploadedPath = null
      return NextResponse.json(
        { ok: false, error: 'PDF teklif kaydına bağlanamadı.' },
        { status: attachError ? 500 : 409 },
      )
    }

    const ttlSeconds = getSignedUrlTtlSeconds()
    const { data: signed, error: signedError } = await supabase.storage
      .from('quote-pdfs')
      .createSignedUrl(uploadedPath, ttlSeconds)

    if (signedError || !signed?.signedUrl) {
      await supabase
        .from('quotes')
        .update({ pdf_storage_path: null })
        .eq('id', quoteId)
        .eq('pdf_storage_path', uploadedPath)
      await supabase.storage.from('quote-pdfs').remove([uploadedPath])
      uploadedPath = null
      console.error(
        '[upload-pdf] Signed URL üretilemedi:',
        signedError?.message || 'boş yanıt',
      )
      return NextResponse.json(
        { ok: false, error: 'PDF erişim bağlantısı oluşturulamadı.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      signedUrl: signed.signedUrl,
      storagePath: uploadedPath,
      expiresInSeconds: ttlSeconds,
    })
  } catch (error) {
    if (uploadedPath && supabase) {
      await supabase.storage.from('quote-pdfs').remove([uploadedPath])
      if (quoteId) {
        await supabase
          .from('quotes')
          .update({ pdf_storage_path: null })
          .eq('id', quoteId)
          .eq('pdf_storage_path', uploadedPath)
      }
    }
    console.error(
      '[upload-pdf] Beklenmeyen hata:',
      error instanceof Error ? error.message : 'bilinmeyen hata',
    )
    return NextResponse.json(
      { ok: false, error: 'Beklenmeyen bir hata oluştu.' },
      { status: 500 },
    )
  }
}
