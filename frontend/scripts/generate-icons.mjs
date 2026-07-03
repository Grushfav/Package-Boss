import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const svg = fs.readFileSync('public/favicon.svg', 'utf8')
const match = svg.match(/href="data:image\/png;base64,([^"]+)"/)
if (!match) throw new Error('No embedded PNG in favicon.svg')

const src = Buffer.from(match[1], 'base64')
const outDir = 'public'

async function writePng(name, width, height = width) {
  await sharp(src)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 10, g: 10, b: 10, alpha: 1 },
    })
    .png()
    .toFile(path.join(outDir, name))
  console.log('wrote', name)
}

const logo512 = await sharp(src)
  .resize(420, 420, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

await writePng('icon-192.png', 192)
await writePng('icon-512.png', 512)
await writePng('favicon-96x96.png', 96)
await writePng('apple-touch-icon.png', 180)
await writePng('email-logo.png', 256)

await sharp({
  create: {
    width: 1200,
    height: 630,
    channels: 4,
    background: { r: 10, g: 10, b: 10, alpha: 1 },
  },
})
  .composite([{ input: logo512, gravity: 'centre' }])
  .png()
  .toFile(path.join(outDir, 'og-image.png'))
console.log('wrote og-image.png')

await sharp(src).resize(32, 32).png().toFile(path.join(outDir, 'favicon.ico'))
console.log('wrote favicon.ico')
