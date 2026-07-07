#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const workflow = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8')
const packaging = readFileSync(join(root, 'docs', 'PACKAGING.md'), 'utf8')
const notesPath = join(root, 'docs', `RELEASE_NOTES_v${packageJson.version}.md`)
const notes = existsSync(notesPath) ? readFileSync(notesPath, 'utf8') : ''

const failures = []
const forbiddenFragments = [
  'package-lite',
  'Package Lite',
  'GoAgent-Lite',
  'dist:lite',
  'write:lite-builder-config',
  'check:lite-release-assets',
  'electron-builder-lite',
  'win-x64-lite',
  'mac-arm64-lite',
  'mac-x64-lite',
  '-lite-portable'
]

const scriptNames = Object.keys(packageJson.scripts ?? {})
for (const name of scriptNames) {
  if (/(^|:)lite(:|$)/i.test(name)) failures.push(`package.json must not expose Lite script: ${name}`)
}

const scriptText = JSON.stringify(packageJson.scripts ?? {})
for (const fragment of forbiddenFragments) {
  if (scriptText.includes(fragment)) failures.push(`package.json scripts still mention Lite release fragment: ${fragment}`)
  if (workflow.includes(fragment)) failures.push(`release workflow still mentions Lite release fragment: ${fragment}`)
  if (packaging.includes(fragment)) failures.push(`docs/PACKAGING.md still mentions Lite artifact fragment: ${fragment}`)
  if (notes.includes(fragment)) failures.push(`${notesPath} still mentions Lite artifact fragment: ${fragment}`)
}

if (!notes) failures.push(`missing release notes for v${packageJson.version}`)

if (failures.length > 0) {
  for (const failure of failures) console.error(`[check-no-lite-release-assets] ${failure}`)
  process.exit(1)
}

console.log('[check-no-lite-release-assets] release packaging no longer exposes Lite artifacts')
