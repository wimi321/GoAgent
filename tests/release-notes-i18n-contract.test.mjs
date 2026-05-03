import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { join } from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const notes = readFileSync(join(root, 'docs', `RELEASE_NOTES_v${packageJson.version}.md`), 'utf8')

test('release notes include multilingual download guidance', () => {
  for (const heading of ['## 中文', '## 繁體中文', '## English', '## 日本語', '## 한국어', '## ภาษาไทย', '## Tiếng Việt']) {
    assert.ok(notes.includes(heading), `missing ${heading}`)
  }
})

test('release notes list standard and NVIDIA artifacts', () => {
  for (const asset of [
    `GoMentor-${packageJson.version}-win-x64-portable.zip`,
    `GoMentor-${packageJson.version}-win-x64.exe`,
    `GoMentor-${packageJson.version}-win-x64-nvidia-portable.zip`,
    `GoMentor-${packageJson.version}-win-x64-nvidia.exe`
  ]) {
    assert.ok(notes.includes(asset), `missing ${asset}`)
  }
})
