import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

test('package scripts no longer expose Lite release builds', () => {
  const packageJson = JSON.parse(read('package.json'))
  const scripts = packageJson.scripts ?? {}
  assert.equal(scripts['write:lite-builder-config'], undefined)
  assert.equal(scripts['dist:lite:mac'], undefined)
  assert.equal(scripts['dist:lite:win'], undefined)
  assert.equal(scripts['dist:lite:linux'], undefined)
  assert.equal(scripts['check:lite-release-assets'], undefined)
  assert.equal(scripts['check:no-lite-release-assets'], 'node scripts/check_no_lite_release_assets.mjs')
  assert.match(scripts['check:release-quality'], /check:no-lite-release-assets/)
  assert.doesNotMatch(scripts['check:release-quality'], /check:lite-release-assets/)
})

test('release workflow publishes only full Standard and NVIDIA packages', () => {
  const workflow = read('.github/workflows/release.yml')
  assert.doesNotMatch(workflow, /package-lite:/)
  assert.doesNotMatch(workflow, /Package Lite/)
  assert.doesNotMatch(workflow, /pnpm dist:lite/)
  assert.doesNotMatch(workflow, /GoAgent-Lite/)
  assert.doesNotMatch(workflow, /GoAgent-\*-mac-arm64-lite\.dmg/)
  assert.doesNotMatch(workflow, /GoAgent-\*-mac-x64-lite\.dmg/)
  assert.doesNotMatch(workflow, /GoAgent-\*-win-x64-lite\.exe/)
  assert.doesNotMatch(workflow, /GoAgent-\*-win-x64-lite-portable\.zip/)
  assert.doesNotMatch(workflow, /needs\.package-lite/)

  assert.match(workflow, /GoAgent-\*-mac-arm64\.dmg/)
  assert.match(workflow, /GoAgent-\*-mac-x64\.dmg/)
  assert.match(workflow, /GoAgent-\*-win-x64\.exe/)
  assert.match(workflow, /GoAgent-\*-win-x64-portable\.zip/)
  assert.match(workflow, /GoAgent-\*-win-x64-nvidia\.exe/)
  assert.match(workflow, /GoAgent-\*-win-x64-nvidia-portable\.7z/)
  assert.doesNotMatch(workflow, /GoAgent-\*-win-x64-nvidia-portable\.7z\*/)
  assert.doesNotMatch(workflow, /\.7z\.001/)
})

test('Lite release helper scripts and docs were removed', () => {
  assert.equal(existsSync(join(root, 'scripts', 'write_lite_builder_config.mjs')), false)
  assert.equal(existsSync(join(root, 'scripts', 'check_lite_release_assets.mjs')), false)
  assert.equal(existsSync(join(root, 'docs', 'LITE_RELEASES.md')), false)
})

test('current release notes do not advertise Lite packages', () => {
  const packageJson = JSON.parse(read('package.json'))
  const notes = read(`docs/RELEASE_NOTES_v${packageJson.version}.md`)
  assert.doesNotMatch(notes, /lite/i)
  assert.doesNotMatch(notes, /win-x64-lite/)
  assert.doesNotMatch(notes, /mac-arm64-lite/)
  assert.doesNotMatch(notes, /mac-x64-lite/)
})
