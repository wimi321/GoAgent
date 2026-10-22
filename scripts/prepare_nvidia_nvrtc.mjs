#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { NVRTC } from './lib/nvidia_nvrtc.mjs'

const execFileAsync = promisify(execFile)
const arg = (name, fallback = '') => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
async function verified(path, expected) {
  const bytes = await readFile(path)
  if (digest(bytes) !== expected) throw new Error(`SHA-256 mismatch: ${path}`)
  return bytes
}

async function main() {
  if (process.platform !== 'win32') throw new Error('NVRTC preparation requires Windows')
  const runtime = resolve(arg('runtime-dir', 'data/katago/bin/win32-x64'))
  await readFile(join(runtime, 'katago.exe'))
  const work = await mkdtemp(join(tmpdir(), 'goagent-nvrtc-'))
  try {
    const archive = join(work, 'nvrtc.zip')
    const localArchive = arg('archive')
    if (localArchive) await copyFile(resolve(localArchive), archive)
    else {
      const response = await fetch(NVRTC.url, { signal: AbortSignal.timeout(120_000) })
      if (!response.ok) throw new Error(`NVRTC download failed: HTTP ${response.status}`)
      await writeFile(archive, Buffer.from(await response.arrayBuffer()))
    }
    await verified(archive, NVRTC.archiveSha256)
    // Paths are supplied as environment data, never interpolated PowerShell code.
    const extracted = join(work, 'extracted')
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$ErrorActionPreference="Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory($env:GOAGENT_NVRTC_ARCHIVE, $env:GOAGENT_NVRTC_EXTRACT)'], {
      windowsHide: true, timeout: 120_000,
      env: { ...process.env, GOAGENT_NVRTC_ARCHIVE: archive, GOAGENT_NVRTC_EXTRACT: extracted }
    })
    const source = join(extracted, NVRTC.archiveRoot)
    const license = await verified(join(source, 'LICENSE'), NVRTC.licenseSha256)
    const files = []
    for (const [name, hash] of Object.entries(NVRTC.files)) {
      const bytes = await verified(join(source, 'bin', name), hash)
      files.push({ name, hash, bytes })
    }
    const licensePath = join(runtime, 'licenses', 'nvidia-runtime', 'cuda_nvrtc-LICENSE')
    await mkdir(dirname(licensePath), { recursive: true })
    await writeFile(licensePath, license)
    for (const { name, bytes } of files) await writeFile(join(runtime, name), bytes)
    await writeFile(join(runtime, 'goagent-nvrtc.json'), JSON.stringify({
      version: NVRTC.version, url: NVRTC.url, archiveSha256: NVRTC.archiveSha256,
      license: 'licenses/nvidia-runtime/cuda_nvrtc-LICENSE', licenseSha256: NVRTC.licenseSha256,
      files: NVRTC.files
    }, null, 2) + '\n')
    console.log(`[prepare-nvidia-nvrtc] verified NVRTC ${NVRTC.version}, both DLLs and license copied to ${runtime}`)
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
