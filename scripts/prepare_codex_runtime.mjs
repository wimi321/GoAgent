import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(join(root, 'data', 'codex', 'manifest.json'), 'utf8'))
const requested = process.argv.slice(2)
  .filter((arg) => arg.startsWith('--platform='))
  .map((arg) => arg.slice('--platform='.length))
const targets = requested.length ? [...new Set(requested)] : [`${process.platform}-${process.arch}`]

async function sha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`Codex runtime download failed: ${response.status} ${url}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
}

for (const target of targets) {
  const asset = manifest.targets[target]
  if (!asset) throw new Error(`Unsupported Codex runtime target: ${target}`)
  const destination = join(root, 'data', 'codex', 'bin', target, asset.executable)
  if (existsSync(destination) && statSync(destination).size === asset.bytes && await sha256(destination) === asset.sha256) {
    console.log(`[codex-runtime] ${target} already verified`)
    continue
  }

  const temporary = mkdtempSync(join(tmpdir(), `goagent-codex-${target}-`))
  try {
    const archive = join(temporary, basename(new URL(asset.url).pathname))
    await download(asset.url, archive)
    const extracted = join(temporary, 'extracted')
    mkdirSync(extracted, { recursive: true })
    const unpack = spawnSync('tar', ['-xzf', archive, '-C', extracted], { encoding: 'utf8' })
    if (unpack.status !== 0) throw new Error(`Unable to extract Codex runtime: ${unpack.stderr || unpack.stdout}`)
    const source = join(extracted, ...asset.archivePath.split('/'))
    if (!existsSync(source)) throw new Error(`Codex runtime archive is missing ${asset.archivePath}`)
    const digest = await sha256(source)
    if (statSync(source).size !== asset.bytes || digest !== asset.sha256) {
      throw new Error(`Codex runtime checksum mismatch for ${target}`)
    }
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(source, destination)
    if (!target.startsWith('win32-')) chmodSync(destination, 0o755)
    console.log(`[codex-runtime] prepared ${target} (${asset.bytes} bytes)`)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}
