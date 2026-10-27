// Teklif PDF'inin stil sayfası.
//
// Belge sitenin içinde, ekran dışındaki bir kapta kurulup resme çevrilir.
// Bu yüzden her kural `.tq` kökünün altındadır ve sınıflar `tq-` ile başlar:
// site stilleri belgeye, belge stilleri siteye karışmaz.
//
// Renk dizilimi ve üst bölümün düzeni alçı teklif şablonundan uyarlandı
// (Emrah, 13 Ekim 2026): yapim/alcifiyatlari/src/lib/quoteDocument.js.
//
// html2canvas kısıtları: `object-fit` ve `font-variant-numeric` çizime
// yansımaz; ikisi de kullanılmaz. `text-rendering:geometricPrecision`
// harf genişliklerinin piksele yuvarlanmasını kapatır: yerleşim 1 katta,
// çizim 2 katta yapıldığı için yuvarlama kelime aralarını kaydırır. Büyük harf dönüşümü CSS ile yapılmaz
// (Türkçe i/İ bozulur); metinler kaynağında yazıldığı gibidir.

/** A4, 96 dpi. */
export const SHEET_WIDTH_PX = 794
export const SHEET_HEIGHT_PX = 1123

export const QUOTE_DOCUMENT_CSS = `
.tq{--tq-ink:#141A16;--tq-body:#39423C;--tq-muted:#68736B;--tq-line:#E3E8E4;--tq-line2:#C9D3CC;--tq-green:#175C39;--tq-green-deep:#0D3B26;--tq-green-mid:#14532F;--tq-green-soft:#F2F6F3;--tq-green-pale:#BFE3CE;--tq-amber-bg:#FCF4DD;--tq-amber-line:#E9D8A6;--tq-amber-ink:#6C5312;--tq-wa:#1a7f43;width:${SHEET_WIDTH_PX}px;background:#fff;color:var(--tq-body);font-family:var(--font-geist-sans),var(--font-barlow),Arial,sans-serif;font-size:12px;line-height:1.42;font-weight:400;letter-spacing:0;text-align:left;text-transform:none;text-rendering:geometricPrecision}
.tq *,.tq *::before,.tq *::after{box-sizing:border-box}
.tq h1,.tq h2,.tq h3,.tq p,.tq dl,.tq dt,.tq dd{margin:0;padding:0;letter-spacing:0;text-transform:none}
.tq h1,.tq h2,.tq h3,.tq .tq-metric-value,.tq .tq-cross-price,.tq .tq-iban{font-family:var(--font-barlow),Arial,sans-serif}
.tq h1{font-size:21px;line-height:1.1;font-weight:800;color:var(--tq-ink)}
.tq h2{font-size:18px;line-height:1.15;font-weight:600;color:var(--tq-ink)}
.tq h3{font-size:15px;line-height:1.2;font-weight:600;color:var(--tq-ink)}
.tq b{font-weight:600;color:var(--tq-ink)}
.tq small{font-size:inherit}
.tq img{display:block;max-width:none}
.tq-sheet{width:${SHEET_WIDTH_PX}px;height:${SHEET_HEIGHT_PX}px;padding:30px 36px 23px;background:#fff;display:flex;flex-direction:column;gap:13px;overflow:hidden}
.tq-header{display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:2px solid var(--tq-ink);padding-bottom:12px;flex-shrink:0;min-height:66px}
.tq-brand{width:190px;height:auto}
.tq-seller{max-width:440px;text-align:right;font-size:10px;line-height:1.5;color:var(--tq-muted)}
.tq-seller b{display:block;font-size:11px;font-weight:700}
.tq-dealer{display:block;font-size:9.5px;font-weight:600;color:var(--tq-green);margin:1px 0 2px}
.tq-seller-phone{display:block;font-weight:700;color:var(--tq-body)}
.tq-context{display:flex;justify-content:space-between;gap:12px;flex-shrink:0;font-size:10px;color:var(--tq-muted)}
.tq-content{flex:1;min-height:0;display:flex;flex-direction:column;gap:12px}
.tq-content>*{flex-shrink:0;min-width:0}
.tq-footer{flex-shrink:0;border-top:1px solid var(--tq-line);padding-top:8px;display:flex;justify-content:space-between;font-size:9px;color:var(--tq-muted);gap:10px}
.tq-intro{display:flex;justify-content:space-between;gap:14px;align-items:flex-end}
.tq-ref{font-size:11px;color:var(--tq-muted);margin-top:6px}
.tq-meta{text-align:right;flex:0 0 auto;font-size:10px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;color:var(--tq-muted)}
.tq-valid-pill{display:inline-block;background:var(--tq-amber-bg);border:1px solid var(--tq-amber-line);color:var(--tq-amber-ink);border-radius:5px;padding:5px 11px;font-size:11.5px;font-weight:700;white-space:nowrap}
.tq-valid-pill i{font-style:normal;font-weight:600;margin-right:7px;font-size:10px;letter-spacing:.4px}
.tq-hero{background-color:var(--tq-green-deep);background-image:linear-gradient(135deg,var(--tq-green-deep) 0%,var(--tq-green-mid) 62%,var(--tq-green) 100%);border-radius:9px;color:#fff;padding:15px 6px 13px}
.tq-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.tq-metric{padding:0 14px;border-right:1px solid rgba(255,255,255,.2);display:grid;gap:4px;align-content:start}
.tq-metric:last-child{border-right:0}
.tq-metric>span{font-size:9px;font-weight:600;letter-spacing:.5px;color:var(--tq-green-pale);white-space:nowrap}
.tq .tq-metric-value{font-size:23px;line-height:1.15;font-weight:700;color:#fff;white-space:nowrap}
.tq-metric>small{font-size:9.5px;color:var(--tq-green-pale);white-space:nowrap}
.tq-facts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));margin:13px 14px 0;padding-top:11px;border-top:1px solid rgba(255,255,255,.2);gap:10px}
.tq-facts>div{display:grid;gap:2px;align-content:start}
.tq-facts img{width:17px;height:17px;margin-bottom:2px}
.tq .tq-facts b{font-size:12px;font-weight:600;color:#fff}
.tq-facts span{font-size:8.5px;font-weight:600;letter-spacing:.5px;color:var(--tq-green-pale)}
.tq-info{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,2.2fr) minmax(0,1fr);border:1px solid var(--tq-line2);border-radius:9px}
.tq-info>div{padding:10px 14px;border-right:1px solid var(--tq-line2);display:grid;gap:2px;align-content:start}
.tq-info>div:last-child{border-right:0}
.tq-info span{font-size:9px;font-weight:600;letter-spacing:.5px;color:var(--tq-muted)}
.tq-info b{font-size:13px;line-height:1.25}
.tq-info small{display:block;font-size:10px;color:var(--tq-muted)}
.tq-nowrap{white-space:nowrap}
.tq table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:11.5px;margin:0}
.tq th{text-align:right;background:var(--tq-green-deep);color:#fff;padding:7px;font-size:10px;line-height:1.25;font-weight:600;border:0}
.tq th:first-child{text-align:left;width:56%}
.tq th:nth-child(2){width:10%}
.tq th:nth-child(3){width:16%}
.tq th:nth-child(4){width:18%}
.tq th small{display:block;font-size:9px;font-weight:400;color:var(--tq-green-pale);margin-top:2px}
.tq td{padding:5.5px 7px;border:0;border-bottom:1px solid var(--tq-line);text-align:right;vertical-align:middle;line-height:1.35;color:var(--tq-body)}
.tq td:first-child{text-align:left}
.tq td:not(:first-child){white-space:nowrap}
.tq-row-name{display:flex;gap:0}
.tq-row-no{flex:0 0 20px;color:var(--tq-muted);font-size:10px;padding-top:1px}
.tq td small{display:block;font-size:9.5px;color:var(--tq-muted);margin-top:2px}
.tq tbody tr:nth-child(even){background:var(--tq-green-soft)}
.tq-in-package{font-size:10px;color:var(--tq-muted)}
.tq-total{display:flex;gap:28px;justify-content:space-between;align-items:center}
.tq-total>p{font-size:10.5px;line-height:1.5}
.tq-total dl{flex:0 0 320px}
.tq-total dl>div{display:flex;justify-content:space-between;gap:20px;padding:3px 0;font-size:11px}
.tq-total dd{font-weight:700;color:var(--tq-ink)}
.tq-total dl>div:last-child{font-size:14px;border-top:1px solid var(--tq-ink);margin-top:3px;padding-top:7px;color:var(--tq-ink)}
.tq-notice{background:var(--tq-amber-bg);border:1px solid var(--tq-amber-line);border-radius:6px;padding:7px 12px;font-size:10.5px;line-height:1.45;color:var(--tq-amber-ink)}
.tq-notice p+p{margin-top:3px}
.tq-action{display:flex;justify-content:space-between;align-items:center;border:1px solid var(--tq-line2);border-radius:7px;padding:9px 16px;gap:18px}
.tq .tq-action h2{font-size:17px}
.tq-action-row{display:flex;align-items:center;gap:12px;margin-top:8px}
.tq-cta{display:inline-block;background:var(--tq-wa);color:#fff;padding:11px 17px;font-size:13px;font-weight:700;border-radius:5px}
.tq-action-phone{font-size:11px}
.tq-action-phone b{font-weight:700;text-decoration:underline}
.tq-prepared{font-size:10.5px;margin-top:7px;color:var(--tq-ink)}
.tq-validity{font-size:9.8px;color:var(--tq-amber-ink);line-height:1.4;margin-top:6px}
.tq-qr{flex:0 0 104px;width:104px;text-align:center;color:var(--tq-muted);font-size:9px;white-space:nowrap}
.tq-qr img{width:88px;height:88px;margin:0 auto 2px}
.tq-process h2{margin-bottom:7px}
.tq-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}
.tq-steps>div{border-top:2px solid var(--tq-green);padding-top:6px}
.tq-steps b{font-size:11px}
.tq-steps p{font-size:10px;line-height:1.4;color:var(--tq-muted);margin-top:3px}
.tq-section-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:5px}
.tq-section-head>span{font-size:10px;color:var(--tq-muted)}
.tq-payment{font-size:10.5px}
.tq-payment>p{margin-bottom:5px}
.tq-account{margin-bottom:6px}
.tq-account p{font-size:11.5px;padding-top:2px}
.tq-bank-row{display:grid;grid-template-columns:105px 1fr;border-top:1px solid var(--tq-line);padding:6px 0;gap:15px;font-size:11px;align-items:baseline}
.tq .tq-iban{font-size:14px;font-weight:600;white-space:nowrap;color:var(--tq-ink)}
.tq .tq-hint{font-size:9.5px;color:var(--tq-muted);margin:5px 0 0}
.tq-trust{display:flex;gap:15px;justify-content:space-between;align-items:center;background:var(--tq-green-soft);border:1px solid var(--tq-line2);padding:10px 12px;border-radius:5px}
.tq-trust>div:first-child{flex:1}
.tq-trust b{font-size:11.5px}
.tq-trust p{font-size:9px;color:var(--tq-muted);margin-top:3px;line-height:1.4}
.tq-logos{display:flex;gap:14px;align-items:center;flex:0 0 auto}
.tq-logos img{height:28px;width:auto}
.tq-cross{background:var(--tq-green-soft);border:1px solid var(--tq-line2);border-radius:6px;padding:12px 14px}
.tq-cross .tq-section-head{margin-bottom:9px}
.tq .tq-cross h2{font-size:20px}
.tq-cross-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.tq-cross-grid>div+div{border-left:1px solid var(--tq-line2);padding-left:18px}
.tq .tq-cross-price{display:block;font-size:22px;line-height:1.15;font-weight:700;color:var(--tq-ink);margin:3px 0 5px}
.tq-cross p{font-size:10px;color:var(--tq-muted);margin-top:2px;line-height:1.35}
.tq-cross-link{display:inline-block;margin-top:5px}
.tq .tq-cross-link b{display:block;font-size:11px;font-weight:700;color:var(--tq-green);text-decoration:underline}
.tq-cross-link small{display:block;font-size:9px;color:var(--tq-muted);margin-top:1px}
.tq .tq-cross-note{margin-top:7px;font-size:9px}
.tq-contact{display:flex;justify-content:space-between;gap:12px;font-size:11px;align-items:center}
.tq .tq-contact b{color:var(--tq-green);font-weight:700;text-decoration:underline}
.tq-continuation{padding-top:2px}
.tq-eyebrow{font-size:10px;letter-spacing:.8px;color:var(--tq-green);font-weight:700}
/* Tek kalemli teklif tek sayfada kalsın diye bir kademe sıkı. */
.tq-single .tq-content{gap:6px}
.tq-single .tq-facts img{display:none}
.tq-single .tq-action{padding:8px 12px}
.tq-single .tq-action h2{display:none}
.tq-single .tq-action-row{margin-top:0}
.tq-single .tq-steps{gap:10px}
.tq.tq-single .tq-process h2{font-size:16px;margin-bottom:5px}
.tq-single .tq-payment>p:first-of-type{display:none}
.tq-single .tq-bank-row{padding:4px 0}
.tq-single .tq-account{display:flex;flex-wrap:wrap;column-gap:22px}
.tq-single .tq-trust{padding:7px 10px}
.tq-single .tq-trust p{line-height:1.3}
.tq-single .tq-cross{padding:8px 11px}
.tq-single .tq-cross .tq-section-head{margin-bottom:5px}
.tq.tq-single .tq-cross h2{font-size:17px}
.tq.tq-single .tq-cross h3{font-size:12px}
.tq.tq-single .tq-cross-price{font-size:17px;margin:2px 0}
.tq-single .tq-cross p{font-size:9px}
.tq-single .tq-cross-grid{gap:14px}
.tq-single .tq-cross-link{margin-top:3px}
.tq.tq-single .tq-cross-note{margin-top:3px}
.tq-single .tq-hero{padding:11px 6px 10px}
.tq-single .tq-facts{margin-top:9px;padding-top:8px}
.tq-single .tq-info>div{padding:7px 14px}
`
