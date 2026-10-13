import { BUSINESS_INFO } from '@/lib/business/info'

// Müşteriye giden belgelerde (teklif PDF'i, Sipariş Onay Formu) satıcının
// kimliği tek yerden basılır: sitede, belgede ve banka ekranında aynı ad.

export interface SellerIdentity {
  /** Belgede ve hesap sahibi satırında görünen unvan (büyük harf). */
  legalName: string
  /** Müşterinin teklifi aldığı site. */
  quoteSite: string
  /** Aynı şirketin kurumsal sitesi. */
  corporateSite: string
  taxOffice: string
  taxNumber: string
  mersisNumber: string
}

export interface IdentityRow {
  label: string
  value: string
}

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//u, '').replace(/\/$/u, '')
}

export function getSellerIdentity(): SellerIdentity {
  return {
    legalName: BUSINESS_INFO.legalName.toLocaleUpperCase('tr-TR'),
    quoteSite: hostOf(BUSINESS_INFO.url),
    corporateSite: hostOf(BUSINESS_INFO.corporateUrl),
    taxOffice: BUSINESS_INFO.taxOffice.trim(),
    taxNumber: BUSINESS_INFO.taxNumber.trim(),
    mersisNumber: BUSINESS_INFO.mersisNumber.trim(),
  }
}

/**
 * Banka bölümünün üstünde basılan kimlik satırları. Vergi ve MERSİS
 * bilgisi boşken satır üretilmez; boş etiket müşteriye görünmez.
 */
export function buildAccountIdentityRows(identity: SellerIdentity): IdentityRow[] {
  const rows: IdentityRow[] = [{ label: 'Hesap sahibi', value: identity.legalName }]

  if (identity.taxNumber) {
    rows.push(
      identity.taxOffice
        ? { label: 'Vergi dairesi / no', value: `${identity.taxOffice} / ${identity.taxNumber}` }
        : { label: 'Vergi no', value: identity.taxNumber },
    )
  }
  if (identity.mersisNumber) {
    rows.push({ label: 'MERSİS no', value: identity.mersisNumber })
  }

  return rows
}
