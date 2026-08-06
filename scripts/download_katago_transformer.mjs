#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, stat, unlink } from 'node:fs/promises'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const VERSION = '1.17.1'
const FILE_NAME = 'b10c512h8nbt3tflrs-fson-silu-rsnh.bin.gz'
const URL = `https://github.com/lightvector/KataGo/releases/download/v${VERSION}/${FILE_NAME}`
const SHA256 = 'c04db4a503721d948bb720324f3cbdac6088cc9eb243632f020e4b6846f58995'
const SIZE_BYTES = 94281753
const MAX_ATTEMPTS = 4
const ATTEMPT_TIMEOUT_MS = 15 * 60 * 1000

async function digest(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

async function valid(path) {
  try {
    return (await stat(path)).size === SIZE_BYTES && await digest(path) === SHA256
  } catch {
    return false
  }
}

async function download(target) {
  const tmp = `${target}.download`
  await mkdir(dirname(target), { recursive: true })
  let existingBytes = await stat(tmp).then((value) => value.size).catch(() => 0)
  const request = (resumeAt) => fetch(URL, {
    headers: {
      'User-Agent': 'GoAgent KataGo Transformer fetch',
      ...(resumeAt > 0 ? { Range: `bytes=${resumeAt}-` } : {})
    },
    signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)
  })
  let response = await request(existingBytes)
  if (response.status === 416 && existingBytes > 0) {
    await unlink(tmp).catch(() => undefined)
    existingBytes = 0
    response = await request(0)
  }
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`)
  const resumed = existingBytes > 0 && response.status === 206
  if (existingBytes > 0 && !resumed) {
    await unlink(tmp).catch(() => undefined)
    existingBytes = 0
  }
  const total = Number(/\/(\d+)$/.exec(response.headers.get('content-range') ?? '')?.[1] ?? 0) || SIZE_BYTES
  let received = resumed ? existingBytes : 0
  let lastPercent = -1
  const progress = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      const percent = Math.min(100, Math.floor(received / total * 100))
      if (percent !== lastPercent) {
        lastPercent = percent
        process.stdout.write(`\r[katago-transformer] ${percent}% (${(received / 1024 / 1024).toFixed(1)} MB)   `)
      }
      callback(null, chunk)
    }
  })
  await pipeline(Readable.fromWeb(response.body), progress, createWriteStream(tmp, { flags: resumed ? 'a' : 'w' }))
  process.stdout.write('\n')
  await rename(tmp, target)
}

async function downloadVerified(target) {
  let lastError
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await download(target)
      if (await valid(target)) return
      await unlink(target).catch(() => undefined)
      throw new Error('download completed but size or SHA-256 did not match')
    } catch (error) {
      lastError = error
      if (attempt === MAX_ATTEMPTS) break
      const delayMs = attempt * 2_000
      console.warn(`[katago-transformer] attempt ${attempt}/${MAX_ATTEMPTS} failed; resuming in ${delayMs / 1000}s`)
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs))
    }
  }
  throw lastError
}

async function main() {
  const target = join(root, 'data', 'katago', 'models', FILE_NAME)
  if (!(await valid(target))) {
    await unlink(target).catch(() => undefined)
    console.log(`[katago-transformer] downloading official KataGo v${VERSION} balanced Transformer`)
    await downloadVerified(target)
  } else {
    console.log(`[katago-transformer] verified existing model: ${target}`)
  }
  if (!(await valid(target))) throw new Error(`Official model SHA-256 or size check failed: ${target}`)

  const selected = spawnSync('node', [
    'scripts/select_default_katago_model.mjs',
    `--model=${target}`,
    '--id=official-transformer-balanced',
    '--display-name=KataGo Transformer 10B Balanced',
    '--prune'
  ], { cwd: root, stdio: 'inherit' })
  if (selected.status !== 0) process.exit(selected.status ?? 1)
}

main().catch((error) => {
  console.error(`[katago-transformer] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
