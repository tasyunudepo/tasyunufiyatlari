// GCR ziyaret ve temas kaydı (6 Kasım 2026): betik yalnız gerçek alan adında, GA4 etiketiyle aynı koşulda yüklenir.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const kaynak = readFileSync(path.join(process.cwd(), 'components/analytics/GoogleAnalytics.tsx'), 'utf8');

describe('temas kaydı betiği', () => {
  it('gerçek alan adı koşulunun içinde ve async yüklenir', () => {
    const blok = kaynak.slice(kaynak.indexOf('id="ga-init"'));
    const kosul = blok.indexOf('.test(location.hostname)');
    const betik = blok.indexOf("t.src = 'https://alcifiyatlari.com/_temas/t.js'");
    expect(kosul).toBeGreaterThan(-1);
    expect(betik).toBeGreaterThan(kosul);
    expect(blok.slice(betik - 120, betik)).toContain('t.async = true');
  });
});
