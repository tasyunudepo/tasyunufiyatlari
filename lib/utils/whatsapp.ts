import { WHATSAPP_ORDER } from "@/lib/config";

/**
 * Teklif WhatsApp mesajı — müşteri PDP veya wizard'dan tıklayınca
 * WhatsApp'a gönderilecek hazır metin. Bağlamsal bilgiler içerir
 * (ürün, kalınlık, metraj, araç, fiyat, şehir) ki satış ekibi
 * dönüşte müşteriyi tanısın. Son iki satır müşterinin isim/telefon
 * yazacağı yer tutucu.
 *
 * Not: WhatsApp URL'inde pre-fill yapılır, müşteri metni düzenleyebilir.
 */
export interface QuoteContext {
  productName: string;       // "Fawori Expert HD150"
  thicknessCm: number | null; // 5
  metrajM2: number;          // 806.4
  vehicleLabel: string;       // "1 Kamyon dolusu" | "2 TIR" | "1 TIR + 1 Kamyon"
  cityName: string;           // "İstanbul"
  pricePerM2: number;         // 416.30
  totalKdvHaric: number;      // 335704
  shippingMessage: string;    // "fiyata dahil" | "satış görüşmesinde netleşir"
  refCode?: string;           // "TY123456" — opsiyonel
  subRegionName?: string;
  setContext?: {
    itemCount: number;
    plateName: string;
    tierName: string;
  };
}

export function generateQuoteWhatsAppMessage(ctx: QuoteContext): string {
  // WhatsApp'ta profil adı ve telefon otomatik görünür; tekrar
  // istemek gereksiz sürtünme yaratır. Emoji de kalabalık yaptığı
  // için kaldırıldı — müşteri kendi satırında sadece niyet + bağlam.
  const lines: string[] = ["Merhaba,", ""];

  if (ctx.setContext) {
    lines.push(
      `${ctx.setContext.itemCount} kalem komple mantolama seti siparişi başlatmak istiyorum.`,
      "",
      `Levha: ${ctx.setContext.plateName}`,
      `Sistem: ${ctx.setContext.tierName}`,
    );
  } else {
    lines.push(
      `${ctx.productName}${ctx.thicknessCm ? ` (${ctx.thicknessCm} cm)` : ""} için teklif almak istiyorum.`,
    );
  }

  lines.push(
    "",
    `${ctx.metrajM2.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m² · ${ctx.vehicleLabel}`,
    [ctx.cityName || "Teslimat şehri belirsiz", ctx.subRegionName].filter(Boolean).join(" / "),
    `${ctx.pricePerM2.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺/m² (KDV hariç)`,
    `~${ctx.totalKdvHaric.toLocaleString("tr-TR")} ₺ toplam (KDV hariç)`,
    `Nakliye: ${ctx.shippingMessage}`,
  );
  if (ctx.refCode) {
    lines.push("", `Ref: ${ctx.refCode}`);
  }
  return lines.join("\n");
}

/**
 * wa.me URL'i — WHATSAPP_ORDER config'inden numara çekilir,
 * mesaj URL-encoded olarak eklenir.
 */
export function buildWhatsAppLink(message: string): string {
  return `https://wa.me/${WHATSAPP_ORDER}?text=${encodeURIComponent(message)}`;
}
