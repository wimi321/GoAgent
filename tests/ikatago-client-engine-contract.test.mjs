import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repoRoot = new URL('..', import.meta.url)

async function text(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('iKataGo remote engine is a first-class KataGo engine mode', async () => {
  assert.equal(existsSync(new URL('src/main/services/ikatagoClientEngine.ts', repoRoot)), true)
  const types = await text('src/main/lib/types.ts')
  const store = await text('src/main/lib/store.ts')
  const katago = await text('src/main/services/katago.ts')
  const persistent = await text('src/main/services/katagoPersistentEngine.ts')

  assert.match(types, /KataGoEngineMode = 'auto' \| 'persistent' \| 'spawn' \| 'ikatago'/)
  assert.match(types, /ikatagoClientBin: string/)
  assert.match(types, /ikatagoUseWhenLocalSlow: boolean/)
  assert.match(store, /ikatagoPlatform: 'all'/)
  assert.match(store, /ikatagoPassword\?: SecretValue/)
  assert.match(katago, /queryIKataGoAnalysisBatch/)
  assert.match(katago, /shouldPreferIKataGoEngine\(settings, runtime\.ready\)/)
  assert.match(katago, /settings\.katagoEngineMode === 'ikatago'/)
  assert.match(persistent, /mode === 'auto' \|\| mode === 'persistent'/)
})

test('iKataGo settings are exposed without using system keychain', async () => {
  const renderer = await text('src/renderer/src/App.tsx')
  const preload = await text('src/preload/index.ts')
  const main = await text('src/main/index.ts')
  const docs = await text('docs/IKATAGO_REMOTE_ENGINE.md')

  assert.match(renderer, /iKataGo 远程算力/)
  assert.match(renderer, /ikatagoClientBin/)
  assert.match(renderer, /ikatagoExtraArgs/)
  assert.match(renderer, /getSavedIkatagoPassword/)
  assert.match(preload, /ikatago:get-saved-password/)
  assert.match(main, /hasIkatagoPassword/)
  assert.doesNotMatch(main, /safeStorage\.encryptString/)
  assert.match(docs, /-- analysis/)
  assert.match(docs, /不会自动上传/)
})
