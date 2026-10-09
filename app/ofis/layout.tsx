import localFont from 'next/font/local'
import './ofis.css'

// Operasyon Masası yönünün fontu: IBM Plex Sans (gövde ve fiyat) ve IBM Plex
// Mono (teklif kodu gibi teknik kimlikler). Dosyalar yereldir, Türkçe harfleri
// ve ₺ işaretini içerir; dış font isteği yoktur.
const officeSans = localFont({
  src: '../../public/fonts/ofis/IBMPlexSans-Variable.ttf',
  variable: '--font-ofis-sans', weight: '100 700', display: 'swap',
})
const officeMono = localFont({
  src: [
    { path: '../../public/fonts/ofis/IBMPlexMono-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/ofis/IBMPlexMono-SemiBold.ttf', weight: '600', style: 'normal' },
  ],
  variable: '--font-ofis-mono', display: 'swap',
})

// Bu server component, /ofis rotasını force-dynamic yapar.
// "use client" olan page.tsx'te dynamic export çalışmadığı için layout'ta yapılır.
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`ofis-surface ${officeSans.variable} ${officeMono.variable}`}>
    {children}
    {process.env.OFIS_PREVIEW_MODE === '1' && <aside className="ofis-font-specimen" aria-label="Yerel font denetimi">
      <h2>Yazı örneği</h2>
      <p id="font-specimen">Örnek Kuzey Yapı · 08.10.2026 · 1.680 m² · 263.692,80 ₺ · O/0 · I/ı/İ/1</p>
      <p id="font-turkish">İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü</p>
      <p id="font-technical" className="font-mono">ORNEK-2026-001 · O/0 · I/ı/İ/1 · ş ğ ç ö ü</p>
    </aside>}
  </div>
}
