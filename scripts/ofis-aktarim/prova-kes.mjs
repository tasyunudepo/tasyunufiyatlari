// Prova aracı (node --import ile yüklenir): KES_SONRA sayıda işlem sunucuya
// ulaştıktan sonra süreci, cevabı işlemeden öldürür. "İşlem kaydedildi ama
// betik haberdar olamadı" durumunu üretir.
const asil = globalThis.fetch; let n = 0; const SINIR = Number(process.env.KES_SONRA)
globalThis.fetch = async (url, init) => {
  const res = await asil(url, init)
  if (init?.method === 'POST' && ++n >= SINIR) { await res.arrayBuffer(); process.exit(137) }
  return res
}
