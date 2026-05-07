#!/usr/bin/env node
import { chmod, copyFile, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(process.cwd())
const manifestPath = join(root, 'data', 'katago', 'manifest.json')

function arg(name, fallback = '') {
  const prefix = `--${name}=`
  const found = process.argv.find((item) => item.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function platformKey() {
  return arg('platform', `${process.platform}-${process.arch}`)
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function sha256(path) {
  const data = await readFile(path)
  return createHash('sha256').update(data).digest('hex')
}

async function walkFiles(dir) {
  const rootDir = resolve(dir)
  if (!(await exists(rootDir))) return []
  const files = []
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        await visit(full)
      } else if (entry.isFile()) {
        files.push(full)
      }
    }
  }
  await visit(rootDir)
  return files
}

function candidateScore(file, hints = []) {
  const lower = file.toLowerCase()
  let score = 0
  for (const hint of hints) {
    if (hint && lower.includes(hint)) score += 20
  }
  if (lower.includes('nvidia')) score += 80
  if (lower.includes('cuda')) score += 70
  if (lower.includes('cudnn')) score += 50
  if (lower.includes('opencl')) score += 20
  if (lower.includes('katago')) score += 10
  if (lower.includes('resources')) score += 5
  score -= lower.length / 10000
  return score
}

async function findRuntimeBinary(assetDir, platform) {
  const assetRoot = resolve(assetDir)
  const exact = join(assetRoot, platform.binaryPath)
  if (await exists(exact)) return exact

  const expectedName = basename(platform.binaryPath).toLowerCase()
  const candidates = (await walkFiles(assetRoot)).filter((file) => basename(file).toLowerCase() === expectedName)
  candidates.sort((left, right) => candidateScore(right, ['win64', 'win32', 'x64']) - candidateScore(left, ['win64', 'win32', 'x64']))
  return candidates[0] ?? ''
}

async function findModel(assetDir, manifest) {
  const assetRoot = resolve(assetDir)
  const exact = join(assetRoot, manifest.modelPath)
  if (await exists(exact)) return exact

  const expectedName = basename(manifest.modelPath).toLowerCase()
  const candidates = (await walkFiles(assetRoot)).filter((file) => basename(file).toLowerCase().endsWith('.bin.gz'))
  candidates.sort((left, right) => {
    const leftName = basename(left).toLowerCase()
    const rightName = basename(right).toLowerCase()
    const leftScore = (leftName === expectedName ? 100 : 0) + candidateScore(left, ['b18', 'b28', 'kata1'])
    const rightScore = (rightName === expectedName ? 100 : 0) + candidateScore(right, ['b18', 'b28', 'kata1'])
    return rightScore - leftScore
  })
  return candidates[0] ?? ''
}

async function chmodBinary(path) {
  if (process.platform !== 'win32' && !path.endsWith('.bin.gz')) {
    await chmod(path, 0o755).catch(() => undefined)
  }
}

async function copyIfProvided(source, target, label) {
  if (!source) {
    console.log(`[prepare-katago-assets] ${label}: no source provided, skip`)
    return false
  }
  const sourcePath = resolve(source)
  if (!(await exists(sourcePath))) {
    throw new Error(`${label} source does not exist: ${sourcePath}`)
  }
  await mkdir(dirname(target), { recursive: true })
  await copyFile(sourcePath, target)
  await chmodBinary(target)
  console.log(`[prepare-katago-assets] copied ${label}: ${sourcePath} -> ${target}`)
  console.log(`[prepare-katago-assets] ${label} sha256=${await sha256(target)}`)
  return true
}

async function copyRuntimeDirectory(sourceBinary, targetBinary, label) {
  if (!sourceBinary) return false
  const sourceDir = dirname(resolve(sourceBinary))
  const targetDir = dirname(resolve(targetBinary))
  if (sourceDir === targetDir) {
    console.log(`[prepare-katago-assets] ${label}: runtime directory already in place: ${targetDir}`)
    await chmodBinary(targetBinary)
    return true
  }

  await rm(targetDir, { recursive: true, force: true })
  await mkdir(dirname(targetDir), { recursive: true })
  await cp(sourceDir, targetDir, { recursive: true })
  await chmodBinary(targetBinary)
  console.log(`[prepare-katago-assets] copied ${label} runtime directory: ${sourceDir} -> ${targetDir}`)
  console.log(`[prepare-katago-assets] ${label} binary sha256=${await sha256(targetBinary)}`)
  return true
}

async function writeEditionMetadata(metadata) {
  const editionPath = join(root, 'data', 'katago', 'edition.json')
  await writeFile(editionPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
  console.log(`[prepare-katago-assets] wrote edition metadata: ${relative(root, editionPath)}`)
}

async function writePreparedManifest(manifest, platform, modelTarget, binaryTarget, flavor) {
  const nextManifest = {
    ...manifest,
    defaultModelFileName: basename(modelTarget),
    defaultModelDisplayName: flavor === 'nvidia'
      ? `KataGo NVIDIA bundled model (${basename(modelTarget)})`
      : `KataGo bundled model (${basename(modelTarget)})`,
    modelPath: relative(join(root, 'data', 'katago'), modelTarget).replaceAll('\\', '/'),
    modelSha256: await sha256(modelTarget),
    supportedPlatforms: {
      ...manifest.supportedPlatforms,
      [platform]: {
        ...manifest.supportedPlatforms[platform],
        sha256: await sha256(binaryTarget)
      }
    }
  }
  await writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8')
  console.log(`[prepare-katago-assets] updated manifest for ${platform}: ${nextManifest.modelPath}`)
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const key = platformKey()
  const platform = manifest.supportedPlatforms?.[key]
  if (!platform) {
    throw new Error(`Unsupported platform key: ${key}. Supported: ${Object.keys(manifest.supportedPlatforms ?? {}).join(', ')}`)
  }

  const binarySource = arg('binary', process.env.GOAGENT_KATAGO_BINARY ?? '')
  const modelSource = arg('model', process.env.GOAGENT_KATAGO_MODEL ?? '')
  const assetDir = arg('asset-dir', process.env.GOAGENT_KATAGO_ASSET_DIR ?? '')
  const scan = hasFlag('scan')
  const copyRuntimeDir = hasFlag('copy-runtime-dir')
  const preserveModelName = hasFlag('preserve-model-name')
  const flavor = arg('flavor', process.env.GOAGENT_KATAGO_FLAVOR ?? 'standard')
  const sourceLabel = arg('source-label', process.env.GOAGENT_KATAGO_SOURCE_LABEL ?? (assetDir || 'manual'))

  const binaryFallback = assetDir ? (scan ? await findRuntimeBinary(assetDir, platform) : join(resolve(assetDir), platform.binaryPath)) : ''
  const modelFallback = assetDir ? (scan ? await findModel(assetDir, manifest) : join(resolve(assetDir), manifest.modelPath)) : ''

  const binaryTarget = join(root, 'data', 'katago', platform.binaryPath)
  const resolvedModelSource = modelSource || modelFallback
  const modelTarget = preserveModelName && resolvedModelSource
    ? join(root, 'data', 'katago', 'models', basename(resolvedModelSource))
    : join(root, 'data', 'katago', manifest.modelPath)

  const resolvedBinarySource = binarySource || binaryFallback
  const copiedBinary = copyRuntimeDir
    ? await copyRuntimeDirectory(resolvedBinarySource, binaryTarget, `binary ${key}`)
    : await copyIfProvided(resolvedBinarySource, binaryTarget, `binary ${key}`)
  const copiedModel = await copyIfProvided(resolvedModelSource, modelTarget, preserveModelName ? 'bundled model' : 'default model')

  if (copiedBinary || copiedModel) {
    await writeEditionMetadata({
      flavor,
      platform: key,
      source: sourceLabel,
      binaryPath: platform.binaryPath,
      modelPath: relative(join(root, 'data', 'katago'), modelTarget).replaceAll('\\', '/'),
      preparedAt: new Date().toISOString()
    })
  }

  if (copiedBinary && copiedModel) {
    await writePreparedManifest(manifest, key, modelTarget, binaryTarget, flavor)
  }

  if (!copiedBinary || !copiedModel) {
    console.log('[prepare-katago-assets] No complete asset pair copied. This is OK for local development but release packaging should provide both assets.')
  }
}

main().catch((error) => {
  console.error(`[prepare-katago-assets] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
