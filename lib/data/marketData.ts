// Doğrulanmış harici veya birinci taraf veri kaynağı bağlanana kadar bu
// modül hiçbir piyasa serisi yayınlamaz. Eski export adları, kullanılmayan
// dashboard bileşenlerinin derleme uyumluluğu için boş olarak korunur.

export interface Transaction {
  id: string
  city: string
  district: string
  system: string
  brand: string
  m2: number
  timestamp: string
}

export interface Hotspot {
  city: string
  region: string
  percent: number
}

export interface VolumeDataPoint {
  date: string
  m2: number
}

export const MARKET_DATA_STATUS = {
  isPublished: false,
  reason: 'verified_source_missing',
} as const

export const MOCK_TRANSACTIONS: Transaction[] = []
export const HOTSPOTS: Hotspot[] = []
export const VOLUME_DATA: VolumeDataPoint[] = []
