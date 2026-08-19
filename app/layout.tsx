import type { Metadata } from "next";
import { Geist, Geist_Mono, Barlow } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ErrorBoundaryWrapper } from "@/components/shared/ErrorBoundaryWrapper";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import GAPageviewTracker from "@/components/analytics/GAPageviewTracker";
import SalesIntentGate from "@/components/qualification/SalesIntentGate";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || "G-VCHRKVJCEN";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.tasyunufiyatlari.com"),
  applicationName: "Taşyünü Fiyatları",
  title: {
    default: "Taşyünü Fiyatları — Mantolama Maliyeti Hesaplama",
    template: "%s | Taşyünü Fiyatları",
  },
  description:
    "Proje ölçeğinde taşyünü ve EPS satışı. Tam kamyon veya TIR için KDV hariç fiyatınızı hesaplayın, PDF teklifinizi oluşturun.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    siteName: "Taşyünü Fiyatları",
    type: "website",
    locale: "tr_TR",
    url: "https://www.tasyunufiyatlari.com",
    title: "Taşyünü Fiyatları — Mantolama Maliyeti Hesaplama",
    description:
      "Proje ölçeğinde taşyünü ve EPS satışı. Tam kamyon veya TIR için KDV hariç fiyatınızı hesaplayın, PDF teklifinizi oluşturun.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Fabrika çıkışlı taşyünü ve EPS mantolama fiyat hesabı",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Taşyünü Fiyatları — Mantolama Maliyeti Hesaplama",
    description:
      "Proje ölçeğinde taşyünü ve EPS satışı. Tam kamyon veya TIR için KDV hariç fiyatınızı hesaplayın, PDF teklifinizi oluşturun.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/images/ikonlar/favicon.webp", type: "image/webp" },
    ],
    shortcut: ["/images/ikonlar/favicon.webp"],
    apple: ["/images/ikonlar/favicon.webp"],
  },
  verification: {
    google: "vEFFP8z6qzvl71kJzvBuuTZkOzUm3YBGf5qWQoQZqlw",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <head>
        {/* GA4 — İşletme kararıyla analitik açık; reklam sinyalleri kapalı */}
        {process.env.NODE_ENV === "production" && (
          <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} antialiased`}
      >
        <ErrorBoundaryWrapper>
          <Providers>{children}</Providers>
        </ErrorBoundaryWrapper>
        <SalesIntentGate />
        {process.env.NODE_ENV === "production" && (
          <>
            <GAPageviewTracker measurementId={GA_MEASUREMENT_ID} />
          </>
        )}
      </body>
    </html>
  );
}
