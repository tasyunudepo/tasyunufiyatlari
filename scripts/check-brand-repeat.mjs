// Build çıktısında marka adının art arda iki kez yazıldığı yer var mı?
// "Optimix Optimix Karbonlu", "optimix-optimix-karbonlu-eps", "Expert Expert ..."
//
// Kaynak kod bekçisi tests/contracts/brand-repeat.test.ts; bu betik veriden
// gelen tekrarı (ürün adı, slug) yakalar. `npm run build` sonrası koşar.
// Kullanım: node scripts/check-brand-repeat.mjs [.next/server/app]

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] ?? '.next/server/app'
const BRANDS = ['optimix', 'fawori', 'bonus', 'dalmaçyalı', 'dalmacyali', 'expert', 'tekno', 'filli', 'eryap']
const pattern = new RegExp(`(?<![\\p{L}])(${BRANDS.join('|')})(?:\\s|&nbsp;|\\\\u00a0|-|%20|\\+)+\\1(?![\\p{L}])`, 'giu')

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(html|rsc|body|meta|json|xml)$/.test(name) ? [path] : []
  })
}

let all
try {
  all = files(root)
} catch {
  console.error(`Build çıktısı bulunamadı: ${root}. Önce npm run build.`)
  process.exit(2)
}

const hits = []
for (const file of all) {
  const body = readFileSync(file, 'utf8')
  for (const m of body.matchAll(pattern)) {
    const at = m.index ?? 0
    hits.push(`${relative(process.cwd(), file)}  …${body.slice(Math.max(0, at - 40), at + m[0].length + 30).replace(/\s+/g, ' ')}…`)
  }
}

if (hits.length) {
  console.error(`Marka tekrarı: ${hits.length} yer (${all.length} dosya tarandı)`)
  for (const h of hits.slice(0, 40)) console.error(`  ${h}`)
  process.exit(1)
}
console.log(`Marka tekrarı yok (${all.length} dosya tarandı).`)
