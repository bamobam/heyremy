// Copies MediaPipe's wasm files into public/wasm so the app serves them itself
// (no CDN at the venue). Runs after npm install.

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Returns how many files were copied. */
export function copyWasm(from, to) {
  if (!existsSync(from)) return 0
  mkdirSync(to, { recursive: true })
  const files = readdirSync(from).filter((f) => f.endsWith('.wasm') || f.endsWith('.js'))
  for (const file of files) copyFileSync(join(from, file), join(to, file))
  return files.length
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(import.meta.url), '..', '..')
  const copied = copyWasm(join(root, 'node_modules/@mediapipe/tasks-vision/wasm'), join(root, 'public/wasm'))
  console.log(`MediaPipe: copied ${copied} wasm files to public/wasm`)
}
