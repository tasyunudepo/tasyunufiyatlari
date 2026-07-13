import { supabase } from '../lib/supabase'

async function checkRLS() {
  console.log('RLS salt-okunur kontrolü başlıyor.')

  const [catalogResult, quotesResult, eventsResult] = await Promise.all([
    supabase.from('brands').select('id', { count: 'exact', head: true }),
    supabase.from('quotes').select('id', { count: 'exact', head: true }),
    supabase.from('quote_funnel_events').select('id', { count: 'exact', head: true }),
  ])

  if (catalogResult.error) {
    throw new Error(`Katalog SELECT kontrolü başarısız: ${catalogResult.error.message}`)
  }
  if (quotesResult.error) {
    throw new Error(`Quotes RLS kontrolü çalıştırılamadı: ${quotesResult.error.message}`)
  }
  if (eventsResult.error) {
    throw new Error(`Funnel RLS kontrolü çalıştırılamadı: ${eventsResult.error.message}`)
  }

  if ((quotesResult.count ?? 0) !== 0 || (eventsResult.count ?? 0) !== 0) {
    throw new Error('Anon istemci hassas teklif kayıtlarını görebiliyor; release durdurulmalı.')
  }

  console.log(`Katalog SELECT açık: ${catalogResult.count ?? 0} marka.`)
  console.log('Anon hassas tablo görünürlüğü kapalı: quotes=0, quote_funnel_events=0.')
  console.log(
    'Not: INSERT/UPDATE/DELETE yetkileri staging SQL introspection ve migration assertionlarıyla ayrıca doğrulanmalıdır.',
  )
}

checkRLS().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Bilinmeyen RLS kontrol hatası'
  console.error(message)
  process.exitCode = 1
})
