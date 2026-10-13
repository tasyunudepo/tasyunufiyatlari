import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { BUSINESS_INFO } from '@/lib/business/info'
import {
  buildAccountIdentityRows,
  getSellerIdentity,
  type SellerIdentity,
} from '@/lib/pdf/sellerIdentity'

// Havale anındaki belge (13 Ekim 2026, yuvarlak masa kararı).
//
// Müşteri teklifi "Taşyünü Fiyatları" sitesinden alıyordu; PDF'te satıcı
// unvanı başka, web adresi başka (ozeryapiinsaat.com) yazıyor, banka
// bölümünde yalnız banka adı ve IBAN duruyordu. Parayı göndereceği anda
// elindeki belgede hesabın kime ait olduğu yazmıyordu.

const identity = getSellerIdentity()

describe('PDF satıcı kimliği', () => {
  it('AC-101: hesap sahibi satırı satıcı unvanını taşır', () => {
    const rows = buildAccountIdentityRows(identity)
    expect(rows[0]).toEqual({
      label: 'Hesap sahibi',
      value: BUSINESS_INFO.legalName.toLocaleUpperCase('tr-TR'),
    })
  })

  it('AC-102: teklif sitesi ve kurumsal site ayrı ayrı adlandırılır', () => {
    expect(identity.quoteSite).toBe('www.tasyunufiyatlari.com')
    expect(identity.corporateSite).toBe('www.ozeryapiinsaat.com')
  })

  it('AC-103: vergi ve MERSİS boşken satır üretilmez', () => {
    const empty: SellerIdentity = { ...identity, taxOffice: '', taxNumber: '', mersisNumber: '' }
    expect(buildAccountIdentityRows(empty).map((row) => row.label)).toEqual(['Hesap sahibi'])
  })

  it('AC-103: vergi ve MERSİS doluyken satır üretilir', () => {
    const filled: SellerIdentity = {
      ...identity,
      taxOffice: 'Tuzla',
      taxNumber: '1234567890',
      mersisNumber: '0123456789000015',
    }
    expect(buildAccountIdentityRows(filled)).toEqual([
      { label: 'Hesap sahibi', value: identity.legalName },
      { label: 'Vergi dairesi / no', value: 'Tuzla / 1234567890' },
      { label: 'MERSİS no', value: '0123456789000015' },
    ])
  })

  it('AC-103: vergi dairesi yokken yalnız numara yazılır', () => {
    const onlyNumber: SellerIdentity = { ...identity, taxOffice: '', taxNumber: '1234567890', mersisNumber: '' }
    expect(buildAccountIdentityRows(onlyNumber)[1]).toEqual({ label: 'Vergi no', value: '1234567890' })
  })
})

describe('PDF şablonu satıcı kimliğini tek kaynaktan basar', () => {
  const pdfSource = readFileSync(resolve(process.cwd(), 'lib/pdfGenerator.ts'), 'utf8')

  it('banka bölümü hesap sahibi satırlarını çizer', () => {
    expect(pdfSource).toContain('buildAccountIdentityRows(')
    const bankBlock = pdfSource.slice(
      pdfSource.indexOf('BANKA HESAP BİLGİLERİ</h4>'),
      pdfSource.indexOf('TEKLİF REFERANS NOTU'),
    )
    expect(bankBlock).toContain('${accountIdentityRows}')
    expect(bankBlock.indexOf('${accountIdentityRows}')).toBeLessThan(bankBlock.indexOf('${bankRows}'))
  })

  it('web adresi etiketsiz tek satır olarak basılmaz', () => {
    expect(pdfSource).not.toContain("website: 'www.ozeryapiinsaat.com'")
    expect(pdfSource).not.toContain('${SELLER.website}')
    expect(pdfSource.match(/Teklif:<\/span> \$\{SELLER\.quoteSite\}/g)?.length).toBe(2)
    expect(pdfSource.match(/Kurumsal:<\/span> \$\{SELLER\.corporateSite\}/g)?.length).toBe(2)
  })
})
