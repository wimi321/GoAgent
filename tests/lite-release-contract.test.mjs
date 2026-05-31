import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

test('lite release packaging is wired without bundled KataGo binaries or models', () => {
  const packageJson = JSON.parse(read('package.json'))
  assert.match(packageJson.scripts['dist:lite:mac'], /electron-builder --config \.release\/electron-builder-lite\.json --mac/)
  assert.match(packageJson.scripts['dist:lite:win'], /electron-builder --config \.release\/electron-builder-lite\.json --win/)
  assert.match(packageJson.scripts['check:release-quality'], /check:lite-release-assets/)

  const writer = read('scripts/write_lite_builder_config.mjs')
  assert.match(writer, /data\/knowledge/)
  assert.match(writer, /manifest\.json/)
  assert.match(writer, /\$\{productName\}-\$\{version\}-\$\{os\}-\$\{arch\}-lite\.\$\{ext\}/)
  assert.match(writer, /\$\{productName\}-\$\{version\}-\$\{os\}-\$\{arch\}-lite-portable\.\$\{ext\}/)

  const generatedPath = join(root, '.release', 'electron-builder-lite.json')
  rmSync(generatedPath, { force: true })
  const result = spawnSync(process.execPath, ['scripts/write_lite_builder_config.mjs'], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(existsSync(generatedPath), 'lite config should be generated')
  const config = JSON.parse(readFileSync(generatedPath, 'utf8'))
  const resources = JSON.stringify(config.extraResources)
  assert.match(resources, /data\/knowledge/)
  assert.match(resources, /data\/katago/)
  assert.match(resources, /manifest\.json/)
  assert.doesNotMatch(resources, /data\/katago\/bin/)
  assert.doesNotMatch(resources, /data\/katago\/models/)
})

test('release workflow publishes lite artifacts next to full packages', () => {
  const workflow = read('.github/workflows/release.yml')
  assert.match(workflow, /package-lite:/)
  assert.match(workflow, /pnpm dist:lite:mac/)
  assert.match(workflow, /pnpm dist:lite:win/)
  assert.match(workflow, /GoAgent-\*-mac-arm64-lite\.dmg/)
  assert.match(workflow, /GoAgent-\*-mac-x64-lite\.dmg/)
  assert.match(workflow, /GoAgent-\*-win-x64-lite\.exe/)
  assert.match(workflow, /GoAgent-\*-win-x64-lite-portable\.zip/)
  assert.match(workflow, /needs\.package-lite\.result == 'success'/)
})
