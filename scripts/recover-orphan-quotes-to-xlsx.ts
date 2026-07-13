import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

import ExcelJS from 'exceljs'

import { parseQuotePdfOcr } from '../lib/recovery/quotePdfOcr.ts'

const execFileAsync = promisify(execFile)
const CUTOFF = new Date('2026-05-11T12:44:22.000Z')
const EXPECTED_ORPHAN_COUNT = 63
const OCR_CONCURRENCY = 3

type StorageObject = {
  name: string
  created_at: string
  metadata?: { size?: number }
}

type QuotePathRow = { pdf_storage_path: string | null }

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} tanımlı değil.`)
  return value
}

function storageHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  }
}

async function listRootObjects(baseUrl: string, serviceKey: string): Promise<StorageObject[]> {
  const response = await fetch(`${baseUrl}/storage/v1/object/list/quote-pdfs`, {
    method: 'POST',
    headers: {
      ...storageHeaders(serviceKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prefix: '',
      limit: 1000,
      offset: 0,
      sortBy: { column: 'created_at', order: 'asc' },
    }),
  })
  if (!response.ok) throw new Error(`Storage listesi alınamadı: HTTP ${response.status}`)
  return response.json() as Promise<StorageObject[]>
}

async function listLinkedPaths(baseUrl: string, serviceKey: string): Promise<Set<string>> {
  const response = await fetch(
    `${baseUrl}/rest/v1/quotes?select=pdf_storage_path&pdf_storage_path=not.is.null`,
    { headers: storageHeaders(serviceKey) },
  )
  if (!response.ok) throw new Error(`Teklif PDF yolları alınamadı: HTTP ${response.status}`)
  const rows = await response.json() as QuotePathRow[]
  return new Set(rows.flatMap((row) => row.pdf_storage_path ? [row.pdf_storage_path] : []))
}

async function downloadPdf(
  baseUrl: string,
  serviceKey: string,
  objectName: string,
  destination: string,
): Promise<void> {
  const encodedPath = objectName.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(`${baseUrl}/storage/v1/object/quote-pdfs/${encodedPath}`, {
    headers: storageHeaders(serviceKey),
  })
  if (!response.ok) throw new Error(`${objectName} indirilemedi: HTTP ${response.status}`)
  await writeFile(destination, Buffer.from(await response.arrayBuffer()), { mode: 0o600 })
}

async function runOcr(pdfPath: string, imagePrefix: string): Promise<string> {
  await execFileAsync('pdftoppm', [
    '-png', '-f', '1', '-singlefile', '-r', '200', pdfPath, imagePrefix,
  ], { maxBuffer: 2 * 1024 * 1024 })
  const { stdout } = await execFileAsync(
    'tesseract',
    [`${imagePrefix}.png`, 'stdout', '-l', 'eng', '--psm', '6'],
    { maxBuffer: 4 * 1024 * 1024 },
  )
  return stdout
}

function formatIstanbulDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const index = cursor++
      if (index >= values.length) return
      results[index] = await mapper(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

async function main() {
  const baseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const [objects, linkedPaths] = await Promise.all([
    listRootObjects(baseUrl, serviceKey),
    listLinkedPaths(baseUrl, serviceKey),
  ])
  const orphanObjects = objects.filter((object) =>
    object.name.toLowerCase().endsWith('.pdf')
    && new Date(object.created_at) >= CUTOFF
    && !linkedPaths.has(object.name),
  )

  if (orphanObjects.length !== EXPECTED_ORPHAN_COUNT) {
    throw new Error(
      `Kurtarma kapsamı değişti: beklenen ${EXPECTED_ORPHAN_COUNT}, bulunan ${orphanObjects.length}.`,
    )
  }

  const workDir = await mkdtemp(join(tmpdir(), 'tasyunu-quote-recovery-'))
  try {
    const recovered = await mapWithConcurrency(
      orphanObjects,
      OCR_CONCURRENCY,
      async (object, index) => {
        const offerCode = object.name.replace(/\.pdf$/i, '')
        const pdfPath = join(workDir, `${index}.pdf`)
        const imagePrefix = join(workDir, `${index}`)
        await downloadPdf(baseUrl, serviceKey, object.name, pdfPath)
        const rawOcr = await runOcr(pdfPath, imagePrefix)
        const fields = parseQuotePdfOcr(rawOcr)
        process.stdout.write(`\rOCR ${index + 1}/${orphanObjects.length}`)
        return { object, offerCode, rawOcr, fields }
      },
    )
    process.stdout.write('\n')

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Codex — tasyunufiyatlari kurtarma denetimi'
    workbook.created = new Date()

    const summary = workbook.addWorksheet('Özet')
    summary.columns = [{ width: 30 }, { width: 90 }]
    summary.addRows([
      ['Rapor', '11 Mayıs sonrası kayıtsız PDF teklif kurtarma listesi'],
      ['Belge sayısı', recovered.length],
      ['Tarih aralığı', `${formatIstanbulDate(orphanObjects[0].created_at)} – ${formatIstanbulDate(orphanObjects.at(-1)!.created_at)}`],
      ['Kaynak', 'Supabase private quote-pdfs bucket; mevcut quotes satırına bağlı olmayan PDF’ler'],
      ['Önemli not', 'OCR sonuçları kesin müşteri kaydı değildir. Türkçe karakterler, telefon ve fiyatlar özgün PDF ile kontrol edilmelidir.'],
      ['Veri güvenliği', 'Bu dosya kişisel veri içerir; e-posta/WhatsApp ile kontrolsüz paylaşılmamalı ve repoya eklenmemelidir.'],
    ])
    summary.getColumn(1).font = { bold: true }
    summary.getRow(1).font = { bold: true, size: 14 }

    const list = workbook.addWorksheet('Kurtarma Listesi', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    list.columns = [
      { header: 'Sıra', key: 'index', width: 8 },
      { header: 'Teklif No', key: 'offerCode', width: 18 },
      { header: 'PDF Tarihi (TSİ)', key: 'createdAt', width: 22 },
      { header: 'Müşteri / Firma (OCR)', key: 'customerName', width: 30 },
      { header: 'Telefon (OCR)', key: 'phone', width: 18 },
      { header: 'Lokasyon (OCR)', key: 'location', width: 18 },
      { header: 'Seçilen Sistem (OCR)', key: 'selectedSystem', width: 52 },
      { header: 'Toplam Metraj', key: 'totalAreaM2', width: 16 },
      { header: 'Ara Toplam', key: 'subtotal', width: 16 },
      { header: 'KDV', key: 'vat', width: 16 },
      { header: 'Genel Toplam', key: 'grandTotal', width: 18 },
      { header: 'PDF Dosyası', key: 'objectName', width: 24 },
      { header: 'OCR Güveni', key: 'confidence', width: 14 },
      { header: 'Kontrol Notu', key: 'reviewNote', width: 52 },
      { header: 'Manuel Kontrol', key: 'manualReview', width: 18 },
    ]
    for (const [index, item] of recovered.entries()) {
      list.addRow({
        index: index + 1,
        offerCode: item.offerCode,
        createdAt: formatIstanbulDate(item.object.created_at),
        ...item.fields,
        objectName: item.object.name,
        manualReview: 'BEKLİYOR',
      })
    }
    list.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    list.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
    list.autoFilter = { from: 'A1', to: 'O1' }
    for (const row of list.getRows(2, list.rowCount - 1) ?? []) {
      row.getCell('H').numFmt = '#,##0.0 "m²"'
      for (const key of ['I', 'J', 'K']) row.getCell(key).numFmt = '#,##0.00 "₺"'
      const confidence = String(row.getCell('M').value)
      row.getCell('M').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: confidence === 'yüksek' ? 'FFC6EFCE' : confidence === 'orta' ? 'FFFFEB9C' : 'FFFFC7CE' },
      }
    }

    const rawSheet = workbook.addWorksheet('Ham OCR', {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    rawSheet.columns = [
      { header: 'Teklif No', key: 'offerCode', width: 18 },
      { header: 'PDF Dosyası', key: 'objectName', width: 24 },
      { header: 'Ham OCR Metni', key: 'rawOcr', width: 120 },
    ]
    for (const item of recovered) {
      rawSheet.addRow({
        offerCode: item.offerCode,
        objectName: item.object.name,
        rawOcr: item.rawOcr.slice(0, 32_000),
      })
    }
    rawSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    rawSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
    rawSheet.getColumn(3).alignment = { wrapText: true, vertical: 'top' }

    const outputDir = resolve('özel-raporlar')
    await mkdir(outputDir, { recursive: true, mode: 0o700 })
    const outputPath = join(outputDir, 'kayip-teklif-kurtarma-2026-05-11_2026-07-13.xlsx')
    await workbook.xlsx.writeFile(outputPath)
    await readFile(outputPath)
    console.log(JSON.stringify({
      outputPath,
      rows: list.rowCount - 1,
      rawRows: rawSheet.rowCount - 1,
      high: recovered.filter((item) => item.fields.confidence === 'yüksek').length,
      medium: recovered.filter((item) => item.fields.confidence === 'orta').length,
      low: recovered.filter((item) => item.fields.confidence === 'düşük').length,
    }, null, 2))
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

await main()

