# Teklif PDF standardı

27 Ekim 2026. Karar: Emrah. Uzlaşma: Astra (GPT-6) ve Opus, iki tur. Kod: `lib/quote/plateIdentity.ts`, `lib/pdf/quoteDocument.ts`, `lib/pdf/quoteDocumentStyles.ts`, `lib/pdf/quotePagination.ts`. Testler: `tests/quote/plate-identity.test.ts`, `tests/pdf/quote-document.test.ts` ("teklif PDF standardı" blokları).

**Neden:** Sercan Bey'in tek kalemli teklifinde tablo altında ara toplam, KDV ve genel toplam yoktu. Paket, paket içeriği ve yoğunluk bazı belgelerde çıkıp bazılarında çıkmıyordu; belge sıkışıktı. Emrah'ın sözü: "Birinde var, öbüründe yok… bu işler artık bir standarda bağlansın."

**28 Ekim 2026 değişikliği (Emrah, TE-2026-000272 paket teklifi üzerinden):** "Boşluklar çok fazla, gereksiz detaylar çok fazla… 30 m² mala üç satır bilgi çok gereksiz… boşlukları azalt, tek sayfaya sığdır." Aşağıda bu değişiklikle güncellenen yerler "(28 Ekim)" diye işaretlidir. Eski ölçüler: grup içi 12 / gruplar arası 24 px, sayfa kenarı 40/32/28 px, hücre 9 × 10 px; levha satırında ayrı tür satırı, uygulama alanı, yoğunluğun tolerans ve kaynak etiketi, paket karşılığı.

**Değişmeyen 13 Ekim kararları:** üst bölüm alçı şablonundan, koyu yeşil geçişli şerit, dört rakam eşit ağırlık, koyu siyah şerit yok, döküm ilk sayfada, önce döküm sonra diğer bilgiler, geçerlilik günle yazılır.

## A. Ürün kimliği

Levha kimliği üç bilgi grubuyla saklanır. Grup içindeki bilinmeyen parça düşer, tamamen boş grup basılmaz. **Tablo satırında (28 Ekim) iki satır basılır:** başlık = ad + malzeme ve levha türü + kalınlık ("Fawori Optimix Karbonlu EPS levha · 8 cm", "Bonus F 150 Pro taşyünü levha · 8 cm"; ad türü zaten söylüyorsa tekrar edilmez), altında tek özellik satırı. Uygulama alanı, yoğunluğun toleransı ve kaynak etiketi ile paket karşılığı tabloya basılmaz. Ürün kartı ad ve kapsamı yazmaya devam eder.

| Grup | İçerik | Örnek |
|---|---|---|
| Ad (600) | Marka + model + kalınlık. Kaplama gibi ürün kimliğini değiştiren nitelemeler korunur. Paket sayısı adda yer almaz. | Bonus Gold Plus 50 · 12 cm |
| Tür | Malzeme + levha türü + uygulama alanı (teknik profilden) | Taşyünü levha · Giydirme cephe |
| Özellik | Yoğunluk · levha ölçüsü · paket içeriği (28 Ekim: tolerans, kaynak etiketi ve paket karşılığı basılmaz) | Yoğunluk 50 kg/m³ · Levha 60 × 120 cm · Pakette 3 levha = 2,16 m² |

**Satır kuralları**
- **Miktar sütunu:** üstte m², altında paket sayısı ("1.900 m²" / "880 paket").
- **Paket karşılığı (28 Ekim):** tabloya yazılmaz; paket sayısı miktar sütunundadır. Kayıtlı miktar ve tutarlar değişmez.
- **Sütunlar:** ürün %52, miktar %14, birim fiyat %16, tutar %18.
- **Toz ve yardımcı malzemeler:** katalogdaki tam ad yazılır (adın içindeki ambalaj ayrıca tekrar edilmez). Altında "Sarfiyat 6 kg/m²" yer alır. Miktar sütununda adet ve Türkçe birim kullanılır: PKT→paket, KUTU→kutu, RULO→rulo, KOVA→kova, ADET→adet. "Torba" yalnız kayıtlı birim buysa yazılır.
- **Nakliye:** görünen ad "Nakliye · Kocaeli teslim". Veri anahtarı "Nakliye" olarak kalır. Operatörün açıklaması ("TIR boşluk farkı") satır adına değil not kutusuna girer.
- **Üst ürün kartı:** 1. satır tam addır. 2. satır kapsamı söyler: "Taşyünü levha", "EPS levha" ya da "Taşyünü levha + n yardımcı malzeme" (nakliye n'ye sayılmaz). Levhasız teklifte "n kalem malzeme" yazar. Yoğunluk kartta tekrar edilmez; sihirbazın paket adı ("Dengeli Sistem") kalır. "Paket: Ofis Teklifi" gibi iç adlar basılmaz.

**Veri**
- Kimlik, katalogdan seçildiği anda kalemle birlikte saklanır (`package_items.items[].identity`). Kimlikte marka + model adı, kalınlık, tür, yoğunluk ve kaynağı, levha ölçüsü, paket m² ve paket içi adet bulunur.
- PDF yalnız kaydedilmiş veriyi biçimlendirir, katalog araması yapmaz.
- Revize ve çoğaltma aynı veriyi taşır. Ürün değişirse kimlik de birlikte değişir.
- Eski kayıtta kimlik yoksa ekran onu katalog anahtarından (`levha-<id>-<kalınlık>`) tamamlar. Katalog yüklenirken kaydetme beklenir. Sayıdan teknik değer üretilmez.
- Üç kanal (site sihirbazı, ürün sayfası, ofis) aynı fonksiyonu kullanır: `resolvePlateIdentity`.

## B. Boşluk ve sayfa

**Ölçüler**
- **Yazı ağırlığı:** gövde 400, vurgu 600. Dört rakam 23 px / 600, başlık 21 px / 800. 700 kullanılmaz.
- **Boşluk ölçeği:**

  | Ad | Ölçü | Kullanım |
  |---|---|---|
  | s1 | 1 px | ad ile alt bilgi arası (28 Ekim; önce 4) |
  | s2 | 8 px | blok içi; aynı grubun blokları arası (28 Ekim; önce 12) |
  | s3 | 14 px | gruplar arası (28 Ekim; önce 24) |

  Aralık tek yerden (`margin-top`) uygulanır.
- **Sayfa kenarı (28 Ekim):** yanlar 36 px, üst 24 px, alt 20 px. A4, 794 × 1123 px.

**Gruplar ve tablo**
- **Grup sırası:**
  1. Karar: başlık, yeşil şerit, kart.
  2. Döküm: tablo, toplam, varsa kayıtlı not.
  3. Eylem.
  4. Bilgi: süreç, ödeme, bayilik; her biri ayrı blok.
  5. Ek: alçı/alçıpan.
  6. Kapanış satırı: müşteri + teklif no, "Sipariş için WhatsApp'tan yazın".
- **Tablo:**
  - Hücre 5 px, başlık 6 px dikey; 10 px yatay; satır yüksekliği 1,25 (28 Ekim).
  - Zebra yok; satırlar 1 px #E3E8E4 çizgiyle ayrılır.
  - Toplam bloğu tablodan 8 px sonra gelir. Toplam satırları 3 px aralıklıdır; genel toplam üst çizgiden 5 px aşağıdadır (28 Ekim).

**Sayfalama:** tek kural geçerli, tek ve çok kalem ayrımı yok.
- Bloklar sırayla akar ve bölünmez. Tablo satır satır bölünür; devam sayfasında başlığı tekrarlanır.
- Tablonun son satırı (nakliye ya da iskonto satırı da olabilir) ile toplam bloğu birlikte yerleşir.
- Eylem, dökümün bittiği sayfada ya da sonraki sayfanın ilk bloğu olarak yer alır.
- Yazı boşluk doldurmak için küçültülmez.
- **Sık düzen (28 Ekim):** normal düzende ikinci sayfaya taşan teklif `tq-dense` sınıfıyla yeniden dizilir: boşluklar ve ikincil ölçüler sıkılaşır, eylem + süreç sol, ödeme + bayilik sağ sütunda yan yana durur. Tek sayfaya sığarsa o kullanılır; sığmazsa normal düzen çok sayfalı kalır. İçerik gizlenmez, dört rakamın boyutu değişmez. Kod: `lib/pdf/quotePagination.ts`, `.tq-dense` kuralları `lib/pdf/quoteDocumentStyles.ts`.
- **Alçı tanıtım kutusu (28 Ekim):** teklifte levha dışı bir alçı/alçıpan kalemi varsa "Alçı ve alçıpan da lazım mı?" bloğu basılmaz.
- Devam sayfasının bağlam satırında teklif numarası yazar.
- Tek ve çok kaleme bağlı sıkıştırma ve içerik gizleme CSS'te de HTML'de de yoktur. `single` yalnız başlıkta ("LEVHA FİYAT TEKLİFİ") ve kapsam cümlesinde kullanılır.

**Fiyat ve nakliye metni**
- **m² fiyatı:** etiketler "m² FİYATI · KDV DAHİL / HARİÇ" olarak kalır. Alt satır kapsamı söyler: tek levhada "Nakliye dahil", çok kalemde "Tüm kalemler · nakliye dahil". Metraj ile m² fiyatının paydası aynı kaynaktandır: fiyatlandırılan levha metrajı.
- **Nakliye ayrı kalemse** PDF ve WhatsApp mesajı aynı cümleyi kullanır: "Nakliye ayrı kalem olarak teklif toplamına dahildir."

## Kabul

Her şablon değişikliğinde son PDF üretilir ve gözle bakılır. Kontrol listesi:
- metin katmanı ve IBAN kopyası,
- bağlantı alanları ve karekod hedefi,
- örnekler: tek levha, levha + nakliye, 8 kalem set, uzun ürün adı, teknik bilgisi eksik ürün, sayfa sınırına düşen son satır.
