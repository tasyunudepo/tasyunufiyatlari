# Veri hedefleri ve güvenli çalışma sınırı

8 Ekim 2026. Gizli değerler bu rapora alınmadı.

## Mevcut uygulama

- `lib/supabase.ts`: tarayıcı istemcisi NEXT_PUBLIC_SUPABASE_URL + anon anahtarı.
- `lib/supabase-server.ts`: aynı URL + service-role anahtarı; auth persistSession ve autoRefreshToken kapalı.
- `.env.local` URL hedefi uzak HTTPS; host SHA-256 ön eki `2bb261a83e4b`. Aynı hedef mevcut `.next/dev/static/chunks` ve `.next/dev/server/chunks` derlemelerinde de bulundu. Yalnız ortam dosyasından çıkarım yapılmadı.
- Üretimden ayrı bir test veritabanı olduğuna ilişkin doğrulama yok. Hedef **yazmaya kapalı / üretim olabilir** olarak sınıflandırıldı. Hedefin tam üretim kimliği varsayılmadı.
- Faz 1 devamında bu hedefin REST şema metadatası yalnız GET ile okundu: quotes/customers/customer_interactions/quote_funnel_events alanları doğrulandı. Yeni geçmiş sorgusunun text-cast projeksiyonu `limit=0` ile HTTP 200 ve boş sonuç döndürdü. Müşteri satırı, constraint/RLS/trigger kataloğu okunmadı; hiçbir kayıt veya şema yazılmadı. Kanıt: `evidence/phase1-live-schema.json`. Salt şema okuması, ayrı test ortamı doğrulaması değildir.
- Uygulama kaynaklarında ikinci doğrudan Postgres istemcisi bulunmadı. Bakım/migration betikleri bu oturumda çalıştırılmadı; DB URI değişkeni bu yerel ortam dosyalarında yok.
- `/api/upload-pdf`: aynı service-role istemcisiyle `quote-pdfs` bucket upload + quotes update + signed URL; hata temizliği de storage remove/update içeriyor. Salt POST engeli tek başına güvenlik sınırı sayılmadı.
- `/api/admin/quotes/[id]/pdf`: imzalı storage URL oluşturur. Bu uç önizlemede gerçek storage'a yönlendirilmez.
- `/api/admin/storage-images`: aynı hedefin ürün görsel bucket'ını listeler. Public görsel URL'leri gerçek ortamı işaret edebilir; sentetik kayıtlarda kullanılmaz.
- `/ofis` layout'u force-dynamic, alt bileşenleri client. Basic Auth proxy ve handler rol kapıları korundu. `patron` read-only; tanımsız rol fail-closed.
- Mevcut çalışan gerçek veri uygulamasında hiçbir tarayıcı etkileşimi, kayıt, upload veya audit/oturum yazma testi yapılmadı.

## Yerel önizleme izolasyonu

- Ayrı worktree ve dal; `.env.local`/`.vercel`/DB dump kopyalanmadı. Launcher `.env.example` dışındaki ortam dosyalarını reddeder.
- Child process ortamı allowlist ile yeniden oluşturulur; gerçek API anahtarı veya DB URI aktarılmaz.
- Tarayıcı ve sunucu Supabase URL'si aynı loopback önizleme adresidir. Anahtarlar kullanılamayan açık sentetik değerlerdir.
- Tüm `/api/`, `/rest/`, `/auth/`, `/storage/` uçları yerel geçitte sonlanır; gerçek Next API handler'ına geçmez. GET yalnız açık sentetik fixture'ları döndürür; tüm mutasyonlar 405.
- Node socket/DNS/fetch dış hedefleri kapalı; Next işçileri aynı ağ engelini miras alır. Fontlar önceki build'in yerel statik dosyalarından sağlanır. Yeni Ofis fontları resmî dosyalardan yerel yüklenir.
- Bu ortam **test veritabanı değildir**. Kayıt kalıcılığı, migration, gerçek PDF upload, iş olayı tekilleştirme doğrulandı denemez.

## Sonraki faz kapısı

Faz 0 ve Faz 1'in mevcut alanlarla salt okunur yerel kısmı tamamlandı. Şema/proje-tutar kararına bağlı kalıcı yazma yolu için SQL taslağı sunuldu; mevcut uzak hedefe yazılmayacak.
