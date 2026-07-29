#!/usr/bin/env node
// Vercel üretim dağıtımı.
//
// NEDEN AYRI DOSYA: eskiden package.json içinde `source .env.local` ile
// yapılıyordu. `.env.local` içinde `=` işaretinden sonra boşluk bırakılan
// tek bir satır (`KEY= "değer"`) bash'te komut olarak yorumlanıyor, script
// sessizce boş değişkenlerle devam edip anlaşılmaz bir hata veriyordu.
// Burada dosya satır satır ayrıştırılır; kabuk yorumlaması devreye girmez.

import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

function envDegeri(anahtar) {
  let icerik
  try {
    icerik = readFileSync('.env.local', 'utf8')
  } catch {
    return null
  }
  for (const satir of icerik.split('\n')) {
    const temiz = satir.trim()
    if (!temiz || temiz.startsWith('#')) continue
    const esit = temiz.indexOf('=')
    if (esit < 0) continue
    if (temiz.slice(0, esit).trim() !== anahtar) continue
    return temiz
      .slice(esit + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
  }
  return null
}

const scope = envDegeri('VERCEL_SCOPE')
const token = envDegeri('VERCEL_TOKEN')

if (!scope || !token) {
  console.error(
    'VERCEL_SCOPE ve VERCEL_TOKEN .env.local içinde tanımlı olmalı.\n' +
      `  VERCEL_SCOPE: ${scope ? 'var' : 'YOK'}\n` +
      `  VERCEL_TOKEN: ${token ? 'var' : 'YOK'}`,
  )
  process.exit(1)
}

console.log(`Vercel'e üretim dağıtımı — hesap: ${scope}`)
const sonuc = spawnSync(
  'npx',
  ['vercel', 'deploy', '--prod', '--yes', '--scope', scope, '--token', token],
  { stdio: 'inherit' },
)
process.exit(sonuc.status ?? 1)
