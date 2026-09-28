// Provisions the on-device ML assets the webcam sensor needs.
// Everything is served locally from /public so the prototype runs offline
// once installed and no camera data ever leaves the machine.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vendor = join(root, 'public', 'vendor')

function copyDir(from, to, filter = () => true) {
  mkdirSync(to, { recursive: true })
  for (const file of readdirSync(from)) {
    if (filter(file)) copyFileSync(join(from, file), join(to, file))
  }
}

// 1. MediaPipe Tasks WASM runtime (face + iris landmark tracking)
copyDir(join(root, 'node_modules/@mediapipe/tasks-vision/wasm'), join(vendor, 'mediapipe'))

// 2. Face-region embedding network (128-d descriptor), see src/core/sensor/webcam/faceEmbedder.ts
copyDir(join(root, 'node_modules/@vladmandic/face-api/model'), join(vendor, 'face-api'), (f) =>
  f.startsWith('face_recognition_model'),
)

// 3. MediaPipe Face Landmarker model (committed in public/models; download if missing)
const landmarker = join(root, 'public/models/face_landmarker.task')
if (!existsSync(landmarker)) {
  const url =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    mkdirSync(dirname(landmarker), { recursive: true })
    writeFileSync(landmarker, Buffer.from(await res.arrayBuffer()))
    console.log('[optic] downloaded face_landmarker.task')
  } catch (err) {
    console.warn(`[optic] could not download face_landmarker.task (${err.message}). Download it manually from ${url}`)
  }
}
console.log('[optic] sensor assets ready in public/vendor')
