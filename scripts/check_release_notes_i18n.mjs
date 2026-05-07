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
  `GoAgent-${version}-win-x64.exe`,
  `GoAgent-${version}-win-x64-nvidia-portable.zip`,
  `GoAgent-${version}-win-x64-nvidia.exe`,
  'SHA256SUMS.txt'
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
}
for (const topic of requiredTopics) {
  if (!body.toLowerCase().includes(topic.toLowerCase())) failures.push(`missing release topic: ${topic}`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[check-release-notes-i18n] ${failure}`)
  process.exit(1)
}

console.log(`[check-release-notes-i18n] multilingual release notes OK for ${tag}`)
