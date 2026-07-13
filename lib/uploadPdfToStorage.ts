// PDF yalnızca başarıyla oluşturulmuş teklif için, server'ın verdiği
// kısa ömürlü capability ile private storage'a yüklenebilir.

export interface PdfUploadAuthorization {
  quoteId: string | number
  capability: string
  filename?: string
}

export interface PdfUploadResult {
  signedUrl: string
  storagePath: string
  expiresInSeconds: number
}

export async function uploadPdfToStorage(
  pdfBlob: Blob,
  authorization: PdfUploadAuthorization,
): Promise<PdfUploadResult | null> {
  try {
    const filename = authorization.filename || 'teklif.pdf'
    const formData = new FormData()
    formData.append('file', pdfBlob, filename)
    formData.append('quoteId', String(authorization.quoteId))
    formData.append('capability', authorization.capability)

    const response = await fetch('/api/upload-pdf', {
      method: 'POST',
      body: formData,
    })
    const result = await response.json().catch(() => null) as {
      ok?: boolean
      error?: string
      signedUrl?: string
      storagePath?: string
      expiresInSeconds?: number
    } | null

    if (
      !response.ok
      || !result?.ok
      || !result.signedUrl
      || !result.storagePath
      || !Number.isFinite(result.expiresInSeconds)
    ) {
      console.error('[uploadPdfToStorage] Private PDF yüklenemedi:', {
        status: response.status,
      })
      return null
    }

    return {
      signedUrl: result.signedUrl,
      storagePath: result.storagePath,
      expiresInSeconds: Number(result.expiresInSeconds),
    }
  } catch (error) {
    console.error(
      '[uploadPdfToStorage] Beklenmeyen hata:',
      error instanceof Error ? error.message : 'bilinmeyen hata',
    )
    return null
  }
}
