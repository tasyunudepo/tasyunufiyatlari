---
name: "Taşyünü Fiyatları"
description: "Profesyonel yapı malzemesi kararlarını sıcak numune yüzeyleri ve ölçülü koyu panellerle hızlandıran görsel sistem."
colors:
  warm-paper: "#f5f1e8"
  warm-card: "#ffffff"
  warm-card-soft: "#faf6ed"
  warm-night: "#161410"
  warm-ink: "#0f0d0a"
  warm-ink-soft: "#2e2a23"
  warm-muted: "#6b6557"
  warm-rule: "#d8d3c4"
  gold: "#7d5d20"
  gold-soft: "#c69e54"
  graphite-bg: "#0b0b0c"
  graphite-surface: "#131315"
  graphite-raised: "#1c1c21"
  graphite-text: "#d6d6de"
  graphite-muted: "#94949e"
  graphite-border: "rgba(46, 46, 52, 0.65)"
typography:
  display:
    fontFamily: "Barlow, Arial, sans-serif"
    fontSize: "clamp(2.5rem, 4.5vw + 0.5rem, 4.75rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Barlow, Arial, sans-serif"
    fontSize: "clamp(2rem, 3vw + 0.5rem, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Barlow, Arial, sans-serif"
    fontSize: "clamp(1.125rem, 0.6vw + 0.9rem, 1.5rem)"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Geist Sans, Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.18em"
rounded:
  subtle: "4px"
  button: "8px"
  action: "10px"
  choice: "11px"
  surface: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section-sm: "48px"
  section-md: "80px"
  section-lg: "120px"
components:
  button-primary:
    backgroundColor: "{colors.gold-soft}"
    textColor: "{colors.graphite-bg}"
    typography: "{typography.title}"
    rounded: "{rounded.button}"
    padding: "14px 28px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.gold}"
    typography: "{typography.title}"
    rounded: "{rounded.button}"
    padding: "14px 28px"
    height: "44px"
  field-dark:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.warm-card}"
    typography: "{typography.body}"
    rounded: "{rounded.action}"
    padding: "0 12px"
    height: "48px"
  card-warm:
    backgroundColor: "{colors.warm-card}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
  card-dark:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.graphite-text}"
    rounded: "{rounded.surface}"
    padding: "16px"
---

# Design System: Taşyünü Fiyatları

## Overview

**Creative North Star: "Mimari Numune Masası"**

Taşyünü Fiyatları, profesyonel alıcının teknik ürün ve teslim koşullarını hızlıca taradığı sakin, maddi ve güvenilir bir çalışma yüzeyidir. Sistem iki bağlamsal dünya kullanır: katalog ve karar yüzeylerinde sıcak kâğıt, koyu mürekkep ve beyaz numune kartları; teknik ve genel ürün yüzeylerinde grafit zemin, yükseltilmiş koyu kartlar ve kırık beyaz metin. Her iki dünya aynı Barlow başlık karakteri, Geist gövde yazısı, yumuşatılmış altın eylem rengi ve sıkı kontrol geometrisiyle aynı markaya aittir.

Güven dekoratif lüksle değil, gerçek ürün görselleri, kaynak etiketleri, açık fiyat koşulları ve okunabilir teknik hiyerarşiyle kurulur. Sıcak ve koyu dünyalar bir ekran içinde rastgele karıştırılmaz; bağlam için biri ana zemin olur, diğeri karar veya kanıt paneli olarak sınırlı kullanılır.

**Key Characteristics:**

- Sıcak kâğıt ve grafit arasında bağlama göre seçilen çift yüzey dünyası
- Barlow ile yoğun, doğrudan başlıklar; Geist ile okunaklı işlem metni
- Altını yalnız eylem, seçili durum ve küçük vurgu için kullanan ölçülü renk hiyerarşisi
- Gerçek ürün kapakları, ince kurallar ve doğrulanabilir mikro-metinlerle kurulan güven
- Mobilde en az 44 px hedefler ve tek sütuna doğal çöken karar akışı

## Colors

Palet sıcak mineral nötrleri, kömür grafiti ve sınırlı altın vurguyu bir araya getirir; renk, bilgi ve eylem önceliğini taşır.

### Primary

- **Yumuşak Altın:** Birincil eylemler, koyu zemin üzerindeki vurgular ve seçili durumlar için kullanılır.
- **Derin Altın:** Açık zemindeki bağlantılar, odak göstergeleri ve ikincil eylemler için kullanılır.

### Neutral

- **Sıcak Kâğıt:** Katalog ve karar yüzeylerinin ana sayfa zeminidir.
- **Numune Beyazı ve Yumuşak Kart:** Ürün, seçim ve filtre yüzeylerini kâğıttan ayırır.
- **Sıcak Gece:** Koyu karar panelleri, başlık ve altbilgi yüzeyleri için kullanılır.
- **Mürekkep, Yumuşak Mürekkep ve Sessiz Metin:** Açık zemin üzerindeki üç seviyeli metin hiyerarşisidir.
- **Sıcak Cetvel:** Kartları ve bilgi bloklarını sert kutulara çevirmeden ayırır.
- **Grafit Zemin, Yüzey ve Yükseltilmiş Yüzey:** Genel ürün ve teknik sayfalardaki koyu katman sistemidir.
- **Grafit Metin, Sessiz Metin ve Sınır:** Koyu dünyadaki okunabilirlik ve bölüm ayrımı rolleridir.

**The Two Worlds Rule.** Bir yüzey sıcak ya da grafit dünyayı temel alır; karşıt dünya yalnız karar, kanıt veya navigasyon paneli olarak devreye girer.

**The Measured Gold Rule.** Altın geniş dekoratif alanları boyamaz; eylemi, seçimi, bağlantıyı ve küçük vurgu anlarını işaretler.

## Typography

**Display Font:** Barlow (Arial fallback)
**Body Font:** Geist Sans (Arial ve Helvetica fallback)
**Label/Mono Font:** Geist Mono (sistem monospace fallback)

**Character:** Barlow’un dar ve güçlü yapısı ürün kararlarını hızlandırır; Geist, teknik ve ticari ayrıntıları nötr, temiz ve uzun süre okunabilir tutar. Büyük başlıklar sıkı harf aralığıyla, gövde metni ise rahat satır aralığıyla çalışır.

### Hierarchy

- **Display:** En büyük karar ve değer önermesi başlıkları; 800 ağırlık ve çok sıkı satır yüksekliği.
- **Headline:** Sayfa ve bölüm başlıkları; 700 ağırlık, dengeli kırılım ve kısa satırlar.
- **Title:** Kart, panel ve alt bölüm başlıkları; 600 ağırlık ve kompakt ritim.
- **Body:** Açıklamalar, koşullar ve yönlendirmeler; mümkün olduğunda yaklaşık 65–75 karakterlik satır uzunluğu.
- **Label:** Küçük kaynak, kategori ve kaş metinleri; monospace, geniş izli ve gerektiğinde büyük harfli.

**The Scan First Rule.** Başlıklar kısa ve yoğun, yardımcı metinler doğrudan ve sakindir; uzun açıklama ilk tarama hattına girmez.

## Layout

Ana içerik yüzeyleri ortalanmış ve sınırlıdır: genel navigasyon 1200 px, zengin katalog çalışma yüzeyi 1240 px, daha basit ürün listeleri 1024 px civarında kalır. Yatay iç boşluk mobilde 16 px, küçük masaüstünden itibaren 24 px olur. Dikey bölüm ritmi küçük, orta ve büyük aralıklarda 48/80/120 px tabanını kullanır; 768 px sonrasında 64/104/160 px’e genişler.

Gridler içeriğe göre kurulur: ürünler mobilde tek, orta ekranda iki, geniş ekranda üç sütundur. Seçim kümeleri mobilde iki sütunla başlar ve yeterli genişlikte dört ya da yedi sütuna açılır. Masaüstü bölünmüş sahneler dengeli iki kolon kullanır; mobilde başlık, ana eylem, doğrular ve işlem paneli doğal okuma sırasına döner. Hiçbir düzen yatay katalog şeridine veya kritik içeriği gizleyen kaydırmaya dayanmaz.

## Elevation & Depth

Sistem düz tonal katmanları temel alır ve gölgeyi yalnız beyaz numune kartlarını sıcak kâğıttan ayırmak ya da koyu karar panelini öne almak için kullanır. Koyu grafit kartlarda derinlik çoğunlukla yüzey tonu ve sınırla, sıcak kartlarda düşük kontrastlı kahverengi ortam gölgesiyle kurulur.

### Shadow Vocabulary

- **Numune Kartı:** `0 10px 28px rgba(39,31,17,0.09)`; sıcak zemin üzerindeki ürün ve seçim kartları.
- **Numune Kartı Hover:** `0 18px 40px rgba(39,31,17,0.13)`; yalnız etkileşim sırasında hafif yükselme.
- **Karar Paneli:** `0 20px 46px rgba(39,31,17,0.16)`; fiyat ve sonuç gibi yüksek öncelikli koyu paneller.
- **Mobil Çekmece:** `-8px 0 32px rgba(0,0,0,0.5)`; açık durumdaki navigasyon katmanı.

**The Flat by Default Rule.** Gölge dekor değildir; yüzey ayrımı veya etkileşim durumu yoksa sınır ve ton yeterlidir.

## Shapes

Form dili ölçülü biçimde yumuşaktır. Ana paneller ve ürün kartları 14 px, alanlar ve ana yüzey eylemleri 10 px, ortak butonlar 8 px köşe kullanır. Küçük teknik çiplerde 4–6 px, kaynak etiketlerinde tam hap formu kullanılır. İnce, sıcak cetvel çizgileri açık dünyada; düşük kontrastlı grafit sınırlar koyu dünyada grupları ayırır.

**The Working Geometry Rule.** Köşeler dostça ama işlevseldir; büyük baloncuk kartlar, organik kapsüller ve süs amaçlı aşırı yuvarlaklık kullanılmaz.

## Components

### Buttons

- **Shape:** Ortak butonlar 8 px, sayfa içi güçlü eylemler 10 px köşelidir; etkileşim alanı en az 44 px yüksekliğindedir.
- **Primary:** Yumuşak altın zemin, grafit metin, 14 × 28 px dolgu ve güçlü Barlow ağırlığı kullanır.
- **Hover / Focus:** Hover’da derin altına geçer ve en fazla 1 px yükselir; klavye odağı 2 px altın halka ve görünür ofset kullanır.
- **Secondary / Ghost:** İkincil eylem ince altın sınırla, üçüncül eylem ise metin ve gerektiğinde alt çizgiyle kalır.

### Chips

- **Style:** Teknik özellikler yumuşak mineral zeminde, kompakt 4–6 px köşeler ve 11–12 px metinle gösterilir; kaynak etiketi beyaz hap ve ince sınır kullanır.
- **State:** Seçili kullanım alanı sıcak gece yüzeyine ve beyaz metne döner; seçili olmayan durum beyaz ve sıcak cetvelli kalır.

### Cards / Containers

- **Corner Style:** Ana kart ve paneller 14 px köşelidir.
- **Background:** Sıcak dünyada numune beyazı, koyu dünyada yükseltilmiş grafit kullanılır.
- **Shadow Strategy:** Sıcak kartlar düşük ortam gölgesi kullanabilir; koyu kartlar çoğunlukla sınır ve tonla ayrılır.
- **Border:** Bilgi gruplarında tam kutu yerine ince bölüm cetvelleri tercih edilir.
- **Internal Padding:** Yoğun kartlarda 16 px; karar ve seçim panellerinde 20–28 px.

### Inputs / Fields

- **Style:** En az 44–48 px yüksekliğinde, 10 px köşeli ve açıkça görünen sınırla kurulur. Koyu panel alanları yükseltilmiş kömür tonu; sıcak filtreler beyaz yüzey kullanır.
- **Focus:** Sınır altına döner ve düşük opaklıklı 2 px odak halkası eklenir; yalnız renk değişimine güvenilmez.
- **Error / Disabled:** Hata, koyu kırmızı tonal blok ve açık metinle alan grubuna yakın görünür; devre dışı durum opaklığı azaltır ve imleci değiştirir.

### Navigation

Site başlığı her iki dünyada da koyudur. Masaüstü bağlantıları 44 px hedef, kırık beyaz metin ve aktif durumda altın alt çizgi kullanır. Mobilde 44 px menü düğmesi koyu çekmece açar; aktif satır altın metin, hafif altın yüzey ve ince halka ile belirginleşir.

### Product Card

Gerçek ürün kapağı, kaynak etiketi, marka/model, en fazla birkaç teknik çip, fiyat bağlamı ve birincil ürün eylemini aynı tarama yüzeyinde birleştirir. Sıcak varyant masaüstünde görsel ve bilgi arasında 42/58 bölünür; dar ekranda tek kolona çöker. Karşılaştırma yalnız teknik profili uygun ürünlerde ikincil eylem olarak görünür.

## Do's and Don'ts

### Do:

- **Do** yüzey bağlamına göre sıcak kâğıt veya grafit dünyadan birini ana zemin seç.
- **Do** fiyatın yanında KDV ve nakliye koşulunu görünür, kısa ve doğru tut.
- **Do** ürün kimliğini gerçek kapak görseli, marka/model ve doğrulanabilir kaynak etiketiyle koru.
- **Do** mobilde 44 px asgari hedefi ve başlıktan eyleme doğal okuma sırasını sürdür.
- **Do** hareketi 150–240 ms aralığında, durum değişimini açıklayan kısa geçişlerle sınırla ve azaltılmış hareket tercihini koru.

### Don't:

- **Don't** altını büyük dekoratif yüzeylere, her sınıra veya eşit ağırlıktaki çok sayıda eyleme yayma.
- **Don't** sıcak ve grafit token setlerini aynı yüzeyde amaçsızca karıştırma.
- **Don't** yatay katalog şeridi, kritik bilgiyi saklayan kaydırma veya aşırı kart yığını kurma.
- **Don't** doğrulanmamış teslim, ödeme, fiyat garantisi veya koşulsuz nakliye vaadi üretme.
- **Don't** kategoriye özgü Karar Masası kompozisyonunu bütün site için zorunlu bir şablona dönüştürme.
