#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const workflow = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const writer = readFileSync(join(root, 'scripts', 'write_lite_builder_config.mjs'), 'utf8')

const requiredScripts = [
  'write:lite-builder-config',
  'dist:lite:mac',
  'dist:lite:win',
  'check:lite-release-assets'
]
const requiredWorkflowFragments = [
  'package-lite:',
  'Package Lite',
  'pnpm dist:lite:mac',
  'pnpm dist:lite:win',
  'GoAgent-*-mac-arm64-lite.dmg',
  'GoAgent-*-mac-x64-lite.dmg',
  'GoAgent-*-win-x64-lite.exe',
  'GoAgent-*-win-x64-lite-portable.zip'
]
const requiredWriterFragments = [
  '${productName}-${version}-${os}-${arch}-lite.${ext}',
  '${productName}-${version}-${os}-${arch}-lite-portable.${ext}',
  'data/knowledge',
  'data/katago',
  'manifest.json',
  '!kokoro/zh-CN/onnx/model_int8.onnx'
]

const failures = []
for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) failures.push(`package.json missing script: ${scriptName}`)
}
for (const fragment of requiredWorkflowFragments) {
  if (!workflow.includes(fragment)) failures.push(`release workflow missing: ${fragment}`)
}
for (const fragment of requiredWriterFragments) {
  if (!writer.includes(fragment)) failures.push(`lite builder writer missing: ${fragment}`)
}

const generatedPath = join(root, '.release', 'electron-builder-lite.json')
rmSync(generatedPath, { force: true })
const result = spawnSync(process.execPath, ['scripts/write_lite_builder_config.mjs'], {
  cwd: root,
  encoding: 'utf8'
})
if (result.status !== 0) {
  failures.push(`lite builder config generation failed: ${result.stderr || result.stdout}`)
} else if (!existsSync(generatedPath)) {
  failures.push('lite builder config was not written')
} else {
  const config = JSON.parse(readFileSync(generatedPath, 'utf8'))
  const resources = JSON.stringify(config.extraResources ?? [])
  if (!resources.includes('data/knowledge')) failures.push('lite config must include local knowledge data')
  if (!resources.includes('manifest.json')) failures.push('lite config must include KataGo manifest')
  if (resources.includes('data/katago/bin') || resources.includes('data/katago/models')) {
    failures.push('lite config must not bundle KataGo binaries or models')
  }
  if (config.artifactName !== '${productName}-${version}-${os}-${arch}-lite.${ext}') {
    failures.push('lite config has unexpected artifactName')
  }
  if (config.win?.artifactName !== '${productName}-${version}-${os}-${arch}-lite-portable.${ext}') {
    failures.push('lite config has unexpected Windows portable artifactName')
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[check-lite-release-assets] ${failure}`)
  process.exit(1)
}

console.log('[check-lite-release-assets] lite release packaging contract OK')
