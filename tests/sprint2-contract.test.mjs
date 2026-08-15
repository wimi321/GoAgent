import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()

test('katago manifest includes P0 platform assets', async () => {
  const manifest = JSON.parse(await readFile(join(root, 'data/katago/manifest.json'), 'utf8'))
  assert.equal(manifest.defaultModelId, 'official-transformer-balanced')
  assert.equal(manifest.modelSha256, 'c04db4a503721d948bb720324f3cbdac6088cc9eb243632f020e4b6846f58995')
  assert.match(manifest.modelPath, /^models\/.+\.bin\.gz$/)
  assert.ok(manifest.supportedPlatforms['darwin-arm64'])
  assert.ok(manifest.supportedPlatforms['darwin-x64'])
  assert.ok(manifest.supportedPlatforms['win32-x64'])
  for (const platform of Object.values(manifest.supportedPlatforms)) {
    assert.equal(platform.engineVersion, '1.17.1')
    assert.equal(platform.minimumEngineVersion, '1.17.1')
  }
})

test('knowledge card payload remains available', async () => {
  const cards = JSON.parse(await readFile(join(root, 'data/knowledge/p0-cards.json'), 'utf8'))
  assert.ok(Array.isArray(cards))
  assert.ok(cards.length >= 40)
})
