import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repoRoot = new URL('..', import.meta.url)

async function text(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('GoAgent defaults analysis to local KataGo and migrates old remote preferences once', async () => {
  const types = await text('src/main/lib/types.ts')
  const store = await text('src/main/lib/store.ts')
  const zhizi = await text('src/main/services/zhiziGtpEngine.ts')
  const ikatago = await text('src/main/services/ikatagoClientEngine.ts')
  const katago = await text('src/main/services/katago.ts')
  const renderer = await text('src/renderer/src/App.tsx')

  assert.match(types, /localAnalysisDefaultApplied: boolean/)
  assert.match(store, /katagoEngineMode: 'auto'/)
  assert.match(store, /zhiziUseWhenLocalSlow: false/)
  assert.match(store, /ikatagoUseWhenLocalSlow: false/)
  assert.match(store, /migrateLocalAnalysisDefault/)
  assert.match(store, /localAnalysisDefaultApplied: true/)
  assert.match(store, /katagoEngineMode === 'zhizi' \|\| settings\.katagoEngineMode === 'ikatago' \? 'auto'/)

  assert.match(zhizi, /if \(!settings\.zhiziUseWhenLocalSlow\) return false/)
  assert.match(zhizi, /if \(!localReady\) return false/)
  assert.match(ikatago, /if \(!settings\.ikatagoUseWhenLocalSlow\) return false/)
  assert.match(ikatago, /if \(!localReady\) return false/)
  assert.match(katago, /settings\.zhiziUseWhenLocalSlow/)
  assert.match(katago, /opt-in slow-machine mode/)
  assert.match(renderer, /默认本机：自动选择最佳本地引擎/)
  assert.match(renderer, /当前仍使用本机 KataGo，不会上传局面/)
})
