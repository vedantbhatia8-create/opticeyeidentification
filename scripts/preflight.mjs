// Friendly checks before `npm run dev` / `npm start`, so setup problems
// show a clear message instead of a silent or cryptic failure.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [major, minor] = process.versions.node.split('.').map(Number)
const ok = major > 22 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19)
const problems = []
if (!ok) problems.push(`Node ${process.versions.node} is too old. Install Node 22 LTS from https://nodejs.org, then run "npm install" again.`)
if (!existsSync(join(root, 'node_modules', 'vite'))) problems.push('Dependencies are not installed. Run "npm install" in this folder first.')
if (!existsSync(join(root, 'public', 'vendor', 'mediapipe'))) problems.push('Sensor assets are missing. Run "npm install" (it copies them automatically).')

if (problems.length) {
  console.error('\n  Optic Access can’t start yet:\n')
  for (const p of problems) console.error(`  • ${p}`)
  console.error('')
  process.exit(1)
}
console.log('\n  Optic Access: starting… your browser will open at http://localhost:5173\n')
