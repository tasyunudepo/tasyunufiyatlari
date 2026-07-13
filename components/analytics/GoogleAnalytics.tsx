// Google Analytics 4 — işletme kararı gereği analitik ölçüm sürekli açıktır.
// Reklam depolama, reklam kullanıcı verisi ve kişiselleştirme sinyalleri kapalı kalır.

import Script from 'next/script';

interface Props {
  measurementId: string;
}

export default function GoogleAnalytics({ measurementId }: Props) {
  if (!measurementId) return null;

  return (
    <>
      {/* 1) Consent Mode v2 — analitik açık, tüm reklam sinyalleri kapalı */}
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

      {/* 2) GA4 gtag.js — sayfa görüntülemeleri ayrı izleyicide güvenli URL ile gönderilir */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">{`
        gtag('js', new Date());
        gtag('config', '${measurementId}', {
          anonymize_ip: true,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          send_page_view: false
        });
      `}</Script>
    </>
  );
}
