#!/usr/bin/env node
import { access, readdir, readFile, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import process from 'node:process'

const root = resolve(process.cwd())
const manifestPath = join(root, 'data', 'katago', 'manifest.json')
const execFileAsync = promisify(execFile)

function arg(name, fallback = '') {
  const prefix = `--${name}=`
  const found = process.argv.find((item) => item.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function currentPlatformKey() {
  return arg('platform', `${process.platform}-${process.arch}`)
}

async function fileOk(path, executable = false) {
  try {
    await stat(path)
    if (executable && process.platform !== 'win32') {
      await access(path, constants.X_OK)
    }
    return true
  } catch {
    return false
  }
}

async function sha256(path) {
  const data = await readFile(path)
  return createHash('sha256').update(data).digest('hex')
}

async function binaryArchitectureProblem(path, key) {
  if (!key.startsWith('darwin-')) {
    return ''
  }
  const expected = key === 'darwin-arm64' ? 'arm64' : key === 'darwin-x64' ? 'x86_64' : ''
  if (!expected) {
    return ''
  }
  try {
    const { stdout } = await execFileAsync('file', ['-b', path], { maxBuffer: 1024 * 1024 })
    const description = String(stdout)
    if (!description.includes('Mach-O')) {
      return `KataGo binary is not a macOS Mach-O executable for ${key}: ${description.trim()}`
    }
    if (!description.includes(expected)) {
      return `KataGo binary architecture mismatch for ${key}: expected ${expected}, got ${description.trim()}`
    }
    return ''
  } catch (error) {
    return `Could not inspect KataGo binary architecture for ${key}: ${error instanceof Error ? error.message : String(error)}`
  }
}

async function walkFiles(dir) {
  const out = []
  async function visit(current) {
    let entries = []
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) await visit(full)
      else if (entry.isFile()) out.push(full)
    }
  }
  await visit(dir)
  return out
}

async function main() {
  const mode = arg('mode', hasFlag('release') ? 'release' : 'dev')
  const key = currentPlatformKey()
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const platform = manifest.supportedPlatforms?.[key]
  if (!platform) {
    const message = `Unsupported platform ${key}. Supported: ${Object.keys(manifest.supportedPlatforms ?? {}).join(', ')}`
    if (mode === 'release') throw new Error(message)
    console.warn(`[check-katago-assets] warning: ${message}`)
    return
  }

  const binaryPath = join(root, 'data', 'katago', platform.binaryPath)
  const modelPath = join(root, 'data', 'katago', manifest.modelPath)
  const modelDir = join(root, 'data', 'katago', 'models')
  const binaryOk = await fileOk(binaryPath, true)
  const modelOk = await fileOk(modelPath, false)
  const fallbackModels = modelOk ? [] : (await walkFiles(modelDir)).filter((file) => file.toLowerCase().endsWith('.bin.gz'))
  const releaseModelOk = modelOk || fallbackModels.length > 0

  if (binaryOk) {
    console.log(`[check-katago-assets] binary OK: ${platform.binaryPath}`)
    const architectureProblem = await binaryArchitectureProblem(binaryPath, key)
    if (architectureProblem) {
      if (mode === 'release') throw new Error(architectureProblem)
      console.warn(`[check-katago-assets] warning: ${architectureProblem}`)
    }
    if (platform.sha256) {
      const actual = await sha256(binaryPath)
      if (actual !== platform.sha256) throw new Error(`Binary checksum mismatch: expected ${platform.sha256}, got ${actual}`)
    }
  } else {
    console.warn(`[check-katago-assets] missing binary: ${platform.binaryPath}`)
  }

  if (modelOk) {
    console.log(`[check-katago-assets] model OK: ${manifest.modelPath}`)
    if (manifest.modelSha256) {
      const actual = await sha256(modelPath)
      if (actual !== manifest.modelSha256) throw new Error(`Model checksum mismatch: expected ${manifest.modelSha256}, got ${actual}`)
    }
  } else if (fallbackModels.length > 0) {
    console.log(`[check-katago-assets] compatible bundled model OK: ${relative(join(root, 'data', 'katago'), fallbackModels[0]).replaceAll('\\', '/')}`)
  } else {
    console.warn(`[check-katago-assets] missing model: ${manifest.modelPath}`)
  }

  if (mode === 'release' && (!binaryOk || !releaseModelOk)) {
    throw new Error('Release packaging requires a KataGo binary and at least one bundled model. Run scripts/prepare_katago_assets.mjs first.')
  }

  if (!binaryOk || !releaseModelOk) {
    console.warn('[check-katago-assets] development warning only. Diagnostics should show missing assets to the user.')
  }
}

main().catch((error) => {
  console.error(`[check-katago-assets] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
