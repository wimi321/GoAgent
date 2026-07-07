#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const tag = `v${version}`
const notesPath = join(root, 'docs', `RELEASE_NOTES_${tag}.md`)

if (!existsSync(notesPath)) {
  console.error(`[check-release-notes-i18n] missing release notes: docs/RELEASE_NOTES_${tag}.md`)
  process.exit(1)
}

const body = readFileSync(notesPath, 'utf8')
const requiredSections = [
  '## 中文',
  '## 繁體中文',
  '## English',
  '## 日本語',
  '## 한국어',
  '## ภาษาไทย',
  '## Tiếng Việt'
]
const requiredAssets = [
  `GoAgent-${version}-mac-arm64.dmg`,
  `GoAgent-${version}-mac-x64.dmg`,
  `GoAgent-${version}-win-x64-portable.zip`,
  `GoAgent-${version}-win-x64-nvidia-portable.7z`
]
const forbiddenAssets = [
  `GoAgent-${version}-mac-arm64-lite.dmg`,
  `GoAgent-${version}-mac-x64-lite.dmg`,
  `GoAgent-${version}-win-x64-lite.exe`,
  `GoAgent-${version}-win-x64-lite-portable.zip`,
  `GoAgent-${version}-win-x64.exe`,
  `GoAgent-${version}-win-x64-nvidia.exe`,
  `GoAgent-${version}-win-x64-nvidia-portable.7z.001`
]
const requiredTopics = [
  'grounded shape recognition engine',
  'local pattern matcher',
  'knowledge source-policy gates',
  'optimized move-range review',
  'quality checks and eval gates',
  'Real Eval / engine silver fixture gate',
  'KataGo engine pool telemetry',
  'Release artifact smoke',
  'student level',
  'student age',
  'teacher persona style settings with evidence boundary',
  'teacher sessions',
  'selective PR #6 integration',
  'Kokoro',
  'selected-provider TTS',
  'offline synthesis',
  'Windows OpenCL runtime bundle',
  'KataGo OpenCL adjacent runtime files',
  'GPU vendor OpenCL drivers',
  'layiku',
  'wimi321'
]

const failures = []
for (const section of requiredSections) {
  if (!body.includes(section)) failures.push(`missing language section: ${section}`)
}
for (const asset of requiredAssets) {
  if (!body.includes(asset)) failures.push(`missing asset mention: ${asset}`)
  const url = `https://github.com/wimi321/GoAgent/releases/download/${tag}/${asset}`
  if (!body.includes(`[${asset}](${url})`)) failures.push(`missing clickable download link: ${asset}`)
}
if (!body.includes('OpenCL')) failures.push('missing OpenCL edition label')
if (!body.includes('CUDA')) failures.push('missing CUDA edition label')
if (!body.includes('免安装') || !body.includes('portable')) failures.push('recommended Windows downloads must emphasize portable packages')
if (body.includes('| SHA256SUMS.txt |') || body.includes('| Checksums |') || body.includes('| 校验文件 |') || body.includes('| 校驗檔 |')) {
  failures.push('recommended download tables must not advertise checksum files')
}
for (const asset of forbiddenAssets) {
  if (body.includes(asset)) failures.push(`release notes must not advertise this non-recommended asset: ${asset}`)
}
for (const topic of requiredTopics) {
  if (!body.toLowerCase().includes(topic.toLowerCase())) failures.push(`missing release topic: ${topic}`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[check-release-notes-i18n] ${failure}`)
  process.exit(1)
}

console.log(`[check-release-notes-i18n] multilingual release notes OK for ${tag}`)
