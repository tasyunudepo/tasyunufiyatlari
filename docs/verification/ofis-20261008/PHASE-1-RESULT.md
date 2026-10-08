> Güncel durum: A/B kararları kullanıcı tarafından onaylandı; migration ve altı kabul kontrolü yalnız ayrı yerel test DB’de tamamlandı. Bu dosyanın aşağıdaki içeriği onay öncesi tarihsel kayıttır; bekleyen A/B kararı yoktur. Güncel sonuç: [PHASE-1-ACCEPTANCE.md](PHASE-1-ACCEPTANCE.md).

# Faz 1 — Mevcut alanlarla tamamlanan yerel çalışma

8 Ekim 2026. Dal: `codex/ofis-redesign-20261008`. Önizleme: http://127.0.0.1:3210/.

**Sonuç:** Keşif ve şema gerektirmeyen okuma/sayaç düzenlemeleri uygulandı. Yeni şema ve kayıt yazma davranışı uygulanmadı. Mevcut üretim olabilecek hedefe hiçbir kayıt, storage veya şema yazılmadı; push/merge/deploy yok.

## 14 px kararı

`app/ofis/DESIGN.md` yardımcı metin, tarih/kaynak etiketi ve rozet için 14 px adımını belgeliyor. Gövde/fiyat/hücre 16–17 px, dokunma hedefi en az 44 px ve metin kontrastı en az 4,5:1 olarak korunuyor.

Kökten çalışan hook kaydı `/home/emrah/projeler/aktif/tasyunufiyatlari/.impeccable/config.json` içindedir: yalnız `design-system-font-size`, yalnız `14px`, yalnız `.worktrees/ofis-redesign-20261008/app/ofis/ofis.css`. Worktree içindeki aynı dosya kapsamlı önceki kayıt da korunuyor. Bu tur başka dosyaya/değere/genel kurala muafiyet eklenmedi.

## Keşif ve değişiklikler

- Çalışan uygulamanın hedefiyle eşleşen Supabase REST şeması salt GET ile okundu; teklif, müşteri, görüşme ve site olayı alanları doğrulandı. Yeni geçmiş sorgusunun kolonları ve bigint → text projeksiyonu `limit=0` ile doğrulandı. **Müşteri satırı okunmadı.** RLS/trigger/constraint kataloğu ayrıca çalıştırılmış sayılmıyor. [Şema kanıtı](evidence/phase1-live-schema.json).
- Teklif detayına mevcut `customer_interactions` tablosundan görüşme geçmişi eklendi. Yalnız tam `quote_id` bağı kullanılır; telefon/isim/müşteri benzerliği başka teklifin başarısını taşımaz. Site etkileşimleri ayrı bölümde kalır.
- Başarılı temas ile son girişim ayrıldı. Başarıdan sonra başarısız girişim gelirse geçmiş başarı korunur. Son 100 satır gösterilir; daha eski başarı ve en son girişim ayrı, tüm geçmişi kapsayan okuma sorgularından alınır. Üç okuma tek transaction snapshot'ı değildir; aynı anda yeni kayıt girilirse anlık fark olabilir ve yenilemeyle giderilir.
- Bigint kimlikleri yeni endpoint'te ondalık metin olarak taşınır. PostgreSQL sınırını aşan veya JavaScript'te hassasiyet kaybetmiş sayılar reddedilir. Bu düzenleme eski endpoint'lerdeki bütün kimlik işleme yollarını değiştirmez.
- v24 aktarımının boş eski sonuçları başarısızlığa çevirdiği bulundu. Bu aktarımın olumsuz sonuçları belirsiz gösterilir; kanal teyidi uydurulmaz. Tıklama/kopyalama/not/boş sonuç başarı sayılmaz. Eski kayıttan ilk gerçek görüşme tarihi üretilmez.
- Okuma hatasında “kayıt yok” denmez; doğrulanamadığı belirtilir ve tekrar deneme sunulur. Teklifin mevcut başarılı temas bilgisi varsa hata sırasında da korunur.
- Altı teklif durumu + “Durumu belirsiz” dağılımı, aynı yüklenmiş ve filtrelenmiş teklif kümesinden hesaplanır. Her teklif bir kez sayılır. Filtre, KPI ve dağılım paydasını birlikte değiştirir. Bunlar proje veya görev sayıları değildir.
- Belge toplamı KDV dahil ve alternatifleri içeren teklif toplamı olarak etiketlendi. Kayıtlı satış tutarı yalnız tamamlanmış tekliflerdeki mevcut `sales_final_price` alanından, KDV hariç hesaplanır; eksik tutar adedi görünür. Fırsat değeri türetilmedi.

## Kontroller ve sınırları

- 13 dosyada **152 test** geçti: mevcut yetki/fiyat/teklif kontrolleri ve yeni temas semantiği/okuma endpoint'i testleri. Endpoint birim testleri sahte DB istemcisi kullanır; veri yazmaz. [Test kaydı](evidence/phase1-tests.log).
- TypeScript geçti. ESLint: 0 hata, mevcut `AdminTopbar` çıkış yönlendirmesinde 1 uyarı. [Tip kontrolü](evidence/phase1-types.log), [lint](evidence/phase1-lint.log).
- Dış ağ erişimi engellenmiş, yerel boş katalog kullanan üretim derlemesi geçti. [Build kaydı](evidence/phase1-build.log).
- **31 tarayıcı görünümü** geçti: 375/390/768/1440 px, %200 yakınlaştırma eşdeğeri, menü/klavye, patron rolü, başarı-son girişim, filtre/belirsiz durum ve okuma hatası. Ölçülen metinlerde 14 px altı, düşük kontrast, 44 px altı hedef veya yatay taşma bulunmadı; JavaScript hatası/dış ağ isteği yok. Ayrıntı [tarayıcı kanıtında](evidence/phase1-validation.json). API/DB/auth/storage yazma denemeleri yalnız sentetik localhost geçidine yönelir ve 405 döner; gerçek handler veya veritabanı çalıştırılmaz.
- İleri/geri SQL taslağı PostgreSQL parser kontrolünden geçti; veritabanında **uygulanmadı**. [SQL incelemesi](evidence/phase1-sql-review.json).

Görseller: [mobil temas geçmişi](evidence/phase1-contact-history-375.png), [okuma hatası](evidence/phase1-contact-read-error.png), [masaüstü teklifler](evidence/phase1-quotes-1440.png), [mobil teklifler](evidence/phase1-quotes-375.png).

## Somut kalan kararlar

[Karar dosyası](PHASE-1-DECISION.md) mevcut alanların sınırlarını, gerçek migration dosyalarını, mevcut kayıtlara etkisini ve geri dönüşü açıklar.

1. **Kalıcı model:** `sales_projects`, `sales_tasks`, `office_operations`; teklif/etkileşimlere nullable bağlantılar. Mevcut veriler değiştirilmez veya telefon benzerliğiyle otomatik birleştirilmez. Yeni ilişkiler kullanıldıktan sonra referanslı kaydın silinmesi kısıtlanabilir.
2. **Proje değeri:** operatörün seçtiği tek teklif + revizyonun KDV hariç tutarı. Seçim yoksa tutar belirsiz; sıfır veya tüm alternatiflerin toplamı yapılmaz.

Görüşme ekleyen ve satış sonucunu değiştiren mevcut endpoint'ler bu tur yeniden yazılmadı. Yeni atomik görev/işlem yazma yolu ve tam Faz 1 kabulü, yukarıdaki şema kararı ile üretimden ayrı test hedefi doğrulamasına bağlıdır. Faz 2–4'ün kalıcı davranışı tamamlanmış sayılmaz. Güvenli keşif, mevcut alanları okuma, sayaç ve görünürlük işi için yeniden onay gerekmiyor.
