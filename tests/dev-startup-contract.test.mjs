import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

test('macOS dev startup uses a real unpacked app instead of raw Electron', () => {
  const packageJson = JSON.parse(read('package.json'))
  const script = read('scripts/start_dev_app.mjs')
  const gitignore = read('.gitignore')

  assert.equal(packageJson.scripts.dev, 'node scripts/start_dev_app.mjs')
  assert.equal(packageJson.scripts.preview, 'node scripts/start_dev_app.mjs --skip-build')
  assert.equal(packageJson.scripts['dev:vite'], 'electron-vite dev')

  assert.match(script, /electron-builder/)
  assert.ok(
    script.indexOf('scripts/prepare_codex_runtime.mjs') > 0 &&
      script.indexOf('scripts/prepare_codex_runtime.mjs') < script.lastIndexOf("'electron-builder'"),
    'the packaged dev app needs the Codex runtime prepared before electron-builder runs'
  )
  assert.match(script, /--mac/)
  assert.match(script, /dir/)
  assert.match(script, /-c\.directories\.output=\.dev-release/)
  assert.match(script, /-c\.mac\.target=dir/)
  assert.match(script, /-c\.mac\.notarize=false/)
  assert.match(script, /-c\.mac\.identity=null/)
  assert.match(script, /ELECTRON_BUILDER_CACHE:\s*builderCacheDir/)
  assert.match(script, /findFirstApp\(devOutputDir\)/)
  assert.match(script, /run\('open', \['-n', appPath\]\)/)

  assert.doesNotMatch(script, /GoAgentElectronDev\.app/)
  assert.doesNotMatch(script, /require\('electron'\)/)
  assert.doesNotMatch(script, /cpSync\(electronApp/)

  assert.match(gitignore, /^\.dev-release$/m)
  assert.match(gitignore, /^\.dev-cache$/m)
})
