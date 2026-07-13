import { NextRequest, NextResponse } from 'next/server'

import { requireOfficeReadAuth } from '@/lib/security/adminMutationAuth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireOfficeReadAuth(req)
  if (!auth.ok) return auth.response

  const { id } = await params
  const quoteId = Number(id)

  if (!Number.isSafeInteger(quoteId) || quoteId <= 0) {
    return NextResponse.json(
      { ok: false, error: 'Geçersiz teklif kimliği.' },
      { status: 400 },
    )
  }

  const supabase = createServerSupabaseClient()
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('pdf_storage_path, quote_code')
    .eq('id', quoteId)
    .maybeSingle()

  if (quoteError) {
    console.error('[admin-pdf] Teklif okunamadı:', quoteError.message)
    return NextResponse.json(
      { ok: false, error: 'PDF bilgisi alınamadı.' },
      { status: 500 },
    )
  }

  if (!quote?.pdf_storage_path) {
    return NextResponse.json(
      { ok: false, error: 'Bu teklife ait PDF bulunamadı.' },
      { status: 404 },
    )
  }

  const shouldDownload = req.nextUrl.searchParams.get('download') === '1'
  const safeQuoteCode = String(quote.quote_code || `TY-${quoteId}`)
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 40)
  const { data: signed, error: signedError } = await supabase.storage
    .from('quote-pdfs')
    .createSignedUrl(
      quote.pdf_storage_path,
      60,
      shouldDownload ? { download: `${safeQuoteCode}.pdf` } : undefined,
    )

  if (signedError || !signed?.signedUrl) {
    console.error(
      '[admin-pdf] Signed URL üretilemedi:',
      signedError?.message || 'boş yanıt',
    )
    return NextResponse.json(
      { ok: false, error: 'PDF erişim bağlantısı oluşturulamadı.' },
      { status: 500 },
    )
  }

  const response = NextResponse.redirect(signed.signedUrl, 302)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
