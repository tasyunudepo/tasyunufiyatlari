> Güncel Faz 2–4 ve gerçek yerel DB önizlemesi: [../ofis-test/README.md](../ofis-test/README.md). Aşağıdaki launcher önceki salt okunur aşamaya aittir.

# Bağlantısız Ofis önizlemesi

Bu betikler uygulama API handler'larını çalıştırmadan mevcut Ofis bileşenlerini sentetik kayıtlarla sunar. Test veritabanı değildir; tüm mutasyonlar 405 döner.

Çalışma ağacında `.env.example` dışındaki ortam dosyaları bulunamaz. Anahtarlar ebeveyn ortamından alınmaz. Supabase hedefi 127.0.0.1:3210; Node dış socket/DNS/fetch engeli çocuk süreçlere aktarılır. Gerçek uygulamadaki `proxy.ts` ve yetki denetimleri değiştirilmez. Preview geçidi kendi sabit yerel kimliğini kullanır; bunu uygulama sunucusu veya yayın için kullanmayın.

Başlat: `node scripts/ofis-preview/start.mjs`

Aç: http://127.0.0.1:3210/ — admin/patron görünümü ve sentetik veri açıklaması.

Kontroller:

- `node scripts/ofis-preview/check.mjs types`
- `node scripts/ofis-preview/check.mjs lint`
- `node scripts/ofis-preview/check.mjs tests`
- `node scripts/ofis-preview/check.mjs build`
- `node scripts/ofis-preview/verify.mjs`
- `node scripts/ofis-preview/verify.mjs phase1` — aynı görsel kontroller + geçmişte başarı/son girişim ayrımı, filtre paydası, bilinmeyen durum, okuma hatası/tekrar deneme.

Tarayıcı kontrolü sırasında kaynak dosyası değiştirilmez; HMR ölçümü kesebilir. Testler yalnız localhost'u açar. Ekran görüntüleri ve JSON kanıtları `docs/verification/ofis-20261008/evidence/` altındadır.

Kök layout Google fontlarını derlemek için bu worktree'de `.ofis-preview/root-fonts/` ve `root-fonts.json` çevrimdışı önbelleği hazırdır; ana uygulamanın mevcut yerel build'indeki fontlardan elde edilmiştir, sır veya müşteri verisi içermez. Yeni checkout'a yalnız git dosyalarını taşırsanız bu yerel önbelleği de taşıyın. Launcher cache yoksa dışarıdan font indirmeyi denemez. Ofis Atkinson dosyaları `public/fonts/ofis/` altında lisanslarıyla bulunur.
