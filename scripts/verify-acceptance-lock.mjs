import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const manifestPath = resolve(root, '.goal-verify/acceptance-lock.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const changed = []

for (const [relativePath, expected] of Object.entries(manifest.files ?? {})) {
  const content = readFileSync(resolve(root, relativePath))
  const sha256 = createHash('sha256').update(content).digest('hex')
  if (sha256 !== expected.sha256) changed.push(relativePath)
}

if (changed.length > 0) {
  console.error('Korunan kabul dosyaları kilitten sonra değişmiş:')
  for (const file of changed) console.error(`- ${file}`)
  process.exit(1)
}

console.log(`Kabul kilidi geçti: ${Object.keys(manifest.files ?? {}).length} dosya.`)

