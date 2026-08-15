import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import {
  compareKataGoVersions,
  kataGoVersionSatisfies,
  parseKataGoVersion
} from '../scripts/lib/katago_asset_metadata.mjs'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('KataGo version metadata parser and comparator enforce the release floor', () => {
  assert.equal(parseKataGoVersion('KataGo v1.17.1\nGit revision: abc'), '1.17.1')
  assert.equal(compareKataGoVersions('1.17.2', '1.17.1'), 1)
  assert.equal(compareKataGoVersions('1.17.1', '1.17.1'), 0)
  assert.equal(kataGoVersionSatisfies('1.16.5', '1.17.1'), false)
  assert.equal(kataGoVersionSatisfies('1.17.1', '1.17.1'), true)
})

test('release manifest defaults to the checksummed official balanced Transformer', () => {
  const manifest = JSON.parse(read('data/katago/manifest.json'))
  assert.equal(manifest.version, 2)
  assert.equal(manifest.defaultModelId, 'official-transformer-balanced')
  assert.equal(manifest.defaultModelFileName, 'b10c512h8nbt3tflrs-fson-silu-rsnh.bin.gz')
  assert.equal(manifest.modelSha256, 'c04db4a503721d948bb720324f3cbdac6088cc9eb243632f020e4b6846f58995')
  assert.equal(manifest.supportedPlatforms['darwin-arm64'].engineVersion, '1.17.1')
  assert.equal(manifest.supportedPlatforms['darwin-x64'].backend, 'metal')
  assert.equal(manifest.supportedPlatforms['win32-x64'].backend, 'opencl')
})

test('runtime exposes all official Transformer sizes and only one recommendation', () => {
  const runtime = read('src/main/services/katagoRuntime.ts')
  for (const id of ['official-transformer-light', 'official-transformer-balanced', 'official-transformer-strong']) {
    assert.match(runtime, new RegExp(`id: '${id}'`))
  }
  assert.equal((runtime.match(/recommended: true/g) ?? []).length, 1)
  assert.match(runtime, /minimumEngineVersion: '1\.17\.0'/)
})

test('release packaging uses current non-TensorRT runtimes and verifies the model', () => {
  const workflow = read('.github/workflows/release.yml')
  const downloader = read('scripts/download_katago_transformer.mjs')
  const assetCheck = read('scripts/check_katago_assets.mjs')
  assert.match(workflow, /next-2026-08-05\.1/)
  assert.equal((workflow.match(/pnpm prepare:katago-transformer/g) ?? []).length, 2)
  assert.equal((workflow.match(/Verify embedded .*KataGo release assets/g) ?? []).length, 2)
  assert.doesNotMatch(workflow, /shasum -a 256/)
  assert.match(downloader, /const VERSION = '1\.17\.1'/)
  assert.match(downloader, /const FILE_NAME = 'b10c512h8nbt3tflrs-fson-silu-rsnh\.bin\.gz'/)
  assert.match(downloader, /lightvector\/KataGo\/releases\/download\/v\$\{VERSION\}\/\$\{FILE_NAME\}/)
  assert.match(downloader, /c04db4a503721d948bb720324f3cbdac6088cc9eb243632f020e4b6846f58995/)
  assert.match(assetCheck, /mode === 'release' \? modelOk/)
  assert.match(assetCheck, /exact default model declared by manifest\.json/)
  assert.doesNotMatch(workflow, /1\.0\.0-next-2026-05-02\.3/)
})
