#!/usr/bin/env node
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, dirname, join, resolve } from 'node:path'

const root = resolve(process.cwd())
const manifestPath = join(root, 'data', 'katago', 'manifest.json')
const modelsDir = join(root, 'data', 'katago', 'models')

function arg(name, fallback = '') {
  const prefix = `--${name}=`
  const found = process.argv.find((item) => item.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
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
  const hash = createHash('sha256')
  hash.update(await readFile(path))
  return hash.digest('hex')
}

async function pruneOtherModels(keepFileName) {
  if (!(await exists(modelsDir))) return
  for (const entry of await readdir(modelsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.bin.gz')) continue
    if (entry.name === keepFileName) continue
    await rm(join(modelsDir, entry.name), { force: true })
    console.log(`[select-default-katago-model] pruned model: ${entry.name}`)
  }
}

async function main() {
  const model = arg('model')
  if (!model) throw new Error('Missing --model=/path/to/model.bin.gz')

  const source = resolve(model)
  if (!(await exists(source))) throw new Error(`Model does not exist: ${source}`)

  const fileName = basename(source)
  if (!fileName.endsWith('.bin.gz')) throw new Error(`Model must be a .bin.gz file: ${source}`)

  const target = join(modelsDir, fileName)
  await mkdir(dirname(target), { recursive: true })
  if (source !== target) await copyFile(source, target)

  if (hasFlag('prune')) await pruneOtherModels(fileName)

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const bundledModels = Array.isArray(manifest.bundledModels)
    ? manifest.bundledModels.filter((item) => item?.fileName === fileName)
    : []
  const next = {
    ...manifest,
    defaultModelId: arg('id', manifest.defaultModelId ?? 'bundled-default'),
    defaultModelFileName: fileName,
    defaultModelDisplayName: arg('display-name', manifest.defaultModelDisplayName ?? `KataGo bundled model (${fileName})`),
    modelPath: `models/${fileName}`,
    modelSha256: await sha256(target)
  }
  if (bundledModels.length > 0) next.bundledModels = bundledModels
  else delete next.bundledModels
  await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  console.log(`[select-default-katago-model] default model set to ${next.modelPath}`)
}

main().catch((error) => {
  console.error(`[select-default-katago-model] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
