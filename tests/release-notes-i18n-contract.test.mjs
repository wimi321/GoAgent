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

test('release notes list recommended portable Windows artifacts', () => {
  for (const asset of [
    `GoAgent-${packageJson.version}-mac-arm64.dmg`,
    `GoAgent-${packageJson.version}-mac-x64.dmg`,
    `GoAgent-${packageJson.version}-win-x64-portable.zip`,
    `GoAgent-${packageJson.version}-win-x64-nvidia-portable.7z`
  ]) {
    assert.ok(notes.includes(asset), `missing ${asset}`)
    const url = `https://github.com/wimi321/GoAgent/releases/download/v${packageJson.version}/${asset}`
    assert.ok(notes.includes(`[${asset}](${url})`), `missing clickable link for ${asset}`)
  }
})

test('release notes label Windows editions as OpenCL and CUDA without checksum clutter', () => {
  assert.match(notes, /OpenCL/)
  assert.match(notes, /CUDA/)
  assert.match(notes, /免安装/)
  assert.match(notes, /portable/)
  assert.doesNotMatch(notes, /\| SHA256SUMS\.txt \|/)
  assert.doesNotMatch(notes, /\| Checksums \|/)
  assert.doesNotMatch(notes, /\| 校验文件 \|/)
  assert.doesNotMatch(notes, /\| 校驗檔 \|/)
})

test('release notes do not list retired Lite artifacts or Windows installers', () => {
  for (const asset of [
    `GoAgent-${packageJson.version}-mac-arm64-lite.dmg`,
    `GoAgent-${packageJson.version}-mac-x64-lite.dmg`,
    `GoAgent-${packageJson.version}-win-x64-lite.exe`,
    `GoAgent-${packageJson.version}-win-x64-lite-portable.zip`,
    `GoAgent-${packageJson.version}-win-x64.exe`,
    `GoAgent-${packageJson.version}-win-x64-nvidia.exe`,
    `GoAgent-${packageJson.version}-win-x64-nvidia-portable.7z.001`
  ]) {
    assert.equal(notes.includes(asset), false, `must not advertise ${asset}`)
  }
})
