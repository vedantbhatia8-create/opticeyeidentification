// Draws the Optic mark (cyan rounded square with an eye) as PNG icons for the
// browser extension. Pure Node: supersampled coverage + zlib-compressed PNG.
//   node scripts/extension-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const OUT = new URL('../extension/icons/', import.meta.url)
const CYAN = [84, 214, 255]
const INK = [4, 6, 10]

/** Colour at a point in the 32×32 design space: null (transparent), CYAN or INK. */
function sample(x, y) {
  // Rounded square, rx = 9.
  const r = 9
  const cx = Math.min(Math.max(x, r), 32 - r)
  const cy = Math.min(Math.max(y, r), 32 - r)
  if ((x - cx) ** 2 + (y - cy) ** 2 > r * r || x < 0 || y < 0 || x > 32 || y > 32) return null
  const dx = x - 16
  const dy = y - 16
  // Almond outline: half-height h(x) = 6.9·(1 − (dx/10.5)²), stroke 1.6.
  if (Math.abs(dx) <= 11) {
    const h = 6.9 * Math.max(0, 1 - (dx / 10.5) ** 2)
    if (Math.abs(Math.abs(dy) - h) < 0.85 && Math.abs(dx) <= 10.9) return INK
  }
  const d = Math.hypot(dx, dy)
  if (Math.abs(d - 3.6) < 0.8) return INK // iris ring
  if (d < 1.25) return INK // pupil
  return CYAN
}

function crc32(buf) {
  let c
  const table = crc32.table ?? (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  }))
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size) {
  const SS = 6 // supersamples per axis
  const rows = []
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4) // filter byte 0
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = sample(((px + (sx + 0.5) / SS) * 32) / size, ((py + (sy + 0.5) / SS) * 32) / size)
          if (!c) continue
          r += c[0]; g += c[1]; b += c[2]; a++
        }
      const o = 1 + px * 4
      if (a) {
        row[o] = Math.round(r / a)
        row[o + 1] = Math.round(g / a)
        row[o + 2] = Math.round(b / a)
      }
      row[o + 3] = Math.round((a / (SS * SS)) * 255)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT, { recursive: true })
for (const size of [16, 32, 48, 128]) writeFileSync(new URL(`icon${size}.png`, OUT), png(size))
console.log('extension icons written')
