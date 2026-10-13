// Sipariş süreci ve ödeme cümleleri — teklif PDF'i ile Sipariş Onay Formu
// aynı cümleleri kullanır; müşteri iki belgede aynı sözü okur.
//
// Ödeme kuralı değişmez: sipariş onayında tek seferde. Gün ya da tarih
// taahhüdü yazılmaz; yükleme tarihi fabrika uygunluğuna göre bildirilir.

/** Ödeme alınan hesaplar — teklif PDF'i ile Sipariş Onay Formu aynı listeyi basar. */
export const SELLER_BANK_ACCOUNTS = [
  { bank: 'KUVEYTTÜRK', label: 'Kuveyt Türk', iban: 'TR22 0020 5000 0947 0027 8000 01' },
  { bank: 'VAKIFBANK', label: 'VakıfBank', iban: 'TR54 0001 5001 5800 7223 2324 14' },
] as const

export const ORDER_PROCESS_TEXT = {
  manufacturerOrder: 'Siparişiniz üreticiye girilir, sipariş teyidi size iletilir.',
  shippingPlan: 'Yükleme tarihi fabrika uygunluğuna göre bildirilir.',
  dispatch: 'Araç fabrikadan yola çıktığında bilgi verilir.',
  delivery: 'Ürün şantiyeye teslim edilir; indirme alıcıya aittir.',
  paymentRule: 'Ödeme sipariş onayında tek seferde alınır.',
  accountCheck: "Havale yaparken alıcı unvanının ve IBAN'ın yukarıdakilerle aynı olduğunu kontrol edin.",
  dealership: 'Bayiliğimizi üreticinin müşteri hattından teyit edebilirsiniz.',
} as const
