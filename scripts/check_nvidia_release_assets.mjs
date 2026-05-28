#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const workflow = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8')
const prepareScript = readFileSync(join(root, 'scripts', 'prepare_katago_assets.mjs'), 'utf8')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const requiredWorkflowFragments = [
  'opencl_katago_asset_repo',
  'opencl_katago_asset_release_tag',
  'opencl_katago_asset_pattern',
  '*windows64.opencl.portable.zip',
  '--flavor=opencl',
  'Windows OpenCL KataGo assets will be restored',
  'nvidia_katago_asset_repo',
  'nvidia_katago_asset_release_tag',
  'nvidia_katago_asset_pattern',
  'package-nvidia-windows',
  'wimi321/lizzieyzy-next',
  '*windows64.nvidia.portable.zip',
  '--copy-runtime-dir',
  '--preserve-model-name',
  'RUNNER_OS',
  'select_default_katago_model.mjs',
  'GoAgent-*-win-x64-nvidia-portable.7z',
  'GoAgent-*-win-x64-nvidia.exe',
  'GoAgent-*-mac-arm64.dmg',
  'GoAgent-*-mac-x64.dmg',
  '*mac-intel.with-katago.dmg',
  '--platform=darwin-arm64',
  '--platform=darwin-x64',
  'hdiutil attach',
  'body_path: docs/RELEASE_NOTES_${{ github.ref_name }}.md'
]

const requiredPrepareFragments = [
  'findRuntimeBinary',
  'copyRuntimeDirectory',
  'preserve-model-name',
  'edition.json'
]

const requiredScripts = [
  'check:nvidia-release-assets',
  'check:release-notes-i18n',
  'check:release-quality'
]

const failures = []
for (const fragment of requiredWorkflowFragments) {
  if (!workflow.includes(fragment)) failures.push(`release workflow missing: ${fragment}`)
}
for (const fragment of requiredPrepareFragments) {
  if (!prepareScript.includes(fragment)) failures.push(`prepare script missing: ${fragment}`)
}
for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) failures.push(`package.json missing script: ${scriptName}`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[check-nvidia-release-assets] ${failure}`)
  process.exit(1)
}

console.log('[check-nvidia-release-assets] NVIDIA release workflow and asset preparation contract OK')
