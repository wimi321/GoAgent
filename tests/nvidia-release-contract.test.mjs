import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { join } from 'node:path'

const root = process.cwd()

test('release workflow publishes standard Windows as a full OpenCL runtime bundle', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8')

  assert.match(workflow, /opencl_katago_asset_repo/)
  assert.match(workflow, /opencl_katago_asset_release_tag/)
  assert.match(workflow, /opencl_katago_asset_pattern/)
  assert.match(workflow, /\*windows64\.opencl\.portable\.zip/)
  assert.match(workflow, /RUNNER_OS.*Windows[\s\S]*7z x "\$\{asset_archive\}" -o\.katago-opencl-source\/extracted/)
  assert.match(workflow, /--copy-runtime-dir/)
  assert.match(workflow, /--preserve-model-name/)
  assert.match(workflow, /--flavor=opencl/)
  assert.match(workflow, /GoAgent-\*-win-x64-portable\.zip/)
  assert.match(workflow, /GoAgent-\*-win-x64\.exe/)
})

test('release workflow publishes a real Windows NVIDIA edition', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8')
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

  assert.match(workflow, /package-nvidia-windows:/)
  assert.match(workflow, /wimi321\/lizzieyzy-next/)
  assert.match(workflow, /\*windows64\.nvidia\.portable\.zip/)
  assert.match(workflow, /--copy-runtime-dir/)
  assert.match(workflow, /--preserve-model-name/)
  assert.match(workflow, /RUNNER_OS.*Windows/)
  assert.match(workflow, /GoAgent-\*-win-x64-nvidia-portable\.7z/)
  assert.match(workflow, /GoAgent-\*-win-x64-nvidia\.exe/)
  assert.match(workflow, /resources\/app\.asar\.unpacked\/data\/katago/)
  assert.match(workflow, /NVIDIA package duplicated KataGo assets/)
  assert.match(workflow, /-mx=7/)
  assert.doesNotMatch(workflow, /-v1900m/)
  assert.doesNotMatch(workflow, /nvidia-portable\.7z\.\*/)
  assert.doesNotMatch(workflow, /SHA256SUMS\.txt/)
  assert.doesNotMatch(workflow, /-ms=off/)
  assert.match(workflow, /\$nvidiaPortableMax = 2560MB/)
  assert.match(workflow, /NVIDIA portable 7z bytes exceed size budget/)

  for (const files of [packageJson.build.files, packageJson.build.win.files]) {
    assert.ok(files.includes('data/knowledge/**/*'))
    assert.ok(files.includes('!data/katago/**/*'))
    assert.ok(files.includes('!data/tts/**/*'))
    assert.equal(files.includes('data/**/*'), false)
  }
  assert.deepEqual(packageJson.build.asarUnpack, [])
})

test('release workflow restores macOS KataGo assets from macOS packages', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8')

  assert.match(workflow, /GoAgent-\*-mac-arm64\.dmg/)
  assert.match(workflow, /GoAgent-\*-mac-x64\.dmg/)
  assert.match(workflow, /\*mac-intel\.with-katago\.dmg/)
  assert.match(workflow, /hdiutil attach/)
  assert.match(workflow, /--platform=darwin-arm64/)
  assert.match(workflow, /--platform=darwin-x64/)
})

test('KataGo asset preparation can scan and copy a runtime directory', () => {
  const prepareScript = readFileSync(join(root, 'scripts', 'prepare_katago_assets.mjs'), 'utf8')

  assert.match(prepareScript, /function hasFlag/)
  assert.match(prepareScript, /async function findRuntimeBinary/)
  assert.match(prepareScript, /async function copyRuntimeDirectory/)
  assert.match(prepareScript, /preserve-model-name/)
  assert.match(prepareScript, /edition\.json/)
  assert.match(prepareScript, /async function writePreparedManifest/)
  assert.match(prepareScript, /modelPath: relative\(join\(root, 'data', 'katago'\), modelTarget\)/)
  assert.match(prepareScript, /supportedPlatforms:[\s\S]*sha256: await sha256\(binaryTarget\)/)
})

test('runtime detection accepts prepared NVIDIA edition metadata and default model names', () => {
  const runtime = readFileSync(join(root, 'src', 'main', 'services', 'katagoRuntime.ts'), 'utf8')
  const assets = readFileSync(join(root, 'src', 'main', 'services', 'katago', 'katagoAssets.ts'), 'utf8')

  assert.match(runtime, /function bundledMetadata/)
  assert.match(runtime, /edition\.json/)
  assert.match(runtime, /join\(directory, 'default\.bin\.gz'\)/)
  assert.match(runtime, /globModelFiles\(directory, \/\^\.\*\\\.bin\\\.gz\$\/\)/)
  assert.match(assets, /interface KataGoEditionMetadata/)
  assert.match(assets, /readEditionMetadata/)
  assert.match(assets, /KataGo NVIDIA bundled model/)
})
