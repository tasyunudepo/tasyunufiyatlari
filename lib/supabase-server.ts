import 'server-only'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase server env vars are missing')
}

const resolvedSupabaseUrl = supabaseUrl
const resolvedSupabaseServiceRoleKey = supabaseServiceRoleKey

// Derleme damgası. force-static sayfalarda Next, Supabase isteklerini süresiz
// önbelleğe yazar (.next/cache/fetch-cache, revalidate 1 yıl) ve sonraki
// derleme aynı anahtarı bulunca veritabanına gitmez. 16 Ekim 2026'da ürün
// adı ve slug değişikliği bu yüzden marka sayfasına, sitemap'e ve kalınlık
// fiyat sayfalarına yansımadı. Önbellek anahtarı istek başlıklarını da
// kapsadığından yayına özgü bir başlık önbelleği o derlemeye bağlar: sayfalar
// statik kalır, veri her yayında yeniden okunur.
const BUILD_STAMP = process.env.VERCEL_GIT_COMMIT_SHA ?? `yerel-${Date.now()}`

export function createServerSupabaseClient() {
  return createClient(resolvedSupabaseUrl, resolvedSupabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { 'x-tf-build': BUILD_STAMP },
    },
  })
}
