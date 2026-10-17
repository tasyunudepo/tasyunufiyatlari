// Google Analytics 4 — işletme kararı gereği analitik ölçüm sürekli açıktır.
// Reklam depolama, reklam kullanıcı verisi ve kişiselleştirme sinyalleri kapalı kalır.

import Script from 'next/script';

interface Props {
  measurementId: string;
}

/** Ölçüm yalnız bu alan adlarında (www ve çıplak) çalışır. */
export const REAL_HOST_PATTERN = '/^(www\\.)?tasyunufiyatlari\\.com$/';

export default function GoogleAnalytics({ measurementId }: Props) {
  if (!measurementId) return null;

  return (
    <>
      {/* 1) Consent Mode v2 — analitik açık, tüm reklam sinyalleri kapalı */}
      {/* Consent default'u GA yüklenmeden ÖNCE koşmalı; app router'da
          root layout'ta beforeInteractive geçerli, kural pages-router çağı. */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <Script id="ga-consent-default" strategy="beforeInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('consent', 'default', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          analytics_storage: 'granted',
          functionality_storage: 'granted',
          security_storage: 'granted',
        });
        gtag('set', 'ads_data_redaction', true);
      `}</Script>

      {/* 2) GA4 gtag.js — yalnız gerçek alan adında yüklenir (17 Ekim 2026). Yerelde (127.0.0.1) koşan otomatik
          testler gerçek etiketi yükleyip düğmelere basıyor, Google bunları ziyaretçi ve temas sayıyordu (16 Eki:
          284 kişi / 18 temas görünen günde gerçek 117 kişi / 3 temas). gtag yine tanımlı kalır: olaylar dataLayer'a
          düşer, ağa gitmez. Ölçüm bekçisi gerçek alan adıyla (--resolve) koştuğu için etiket yüklenir. */}
      <Script id="ga-init" strategy="afterInteractive">{`
        (function () {
          if (!${REAL_HOST_PATTERN}.test(location.hostname)) { window.__gaSkippedHost = location.hostname; return; }
          var s = document.createElement('script');
          s.async = true;
          s.src = 'https://www.googletagmanager.com/gtag/js?id=${measurementId}';
          document.head.appendChild(s);
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            send_page_view: false
          });
        })();
      `}</Script>
    </>
  );
}
