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
  const zhiziPanel = await text('src/renderer/src/features/settings/ZhiziCloudSettingsPanel.tsx')

  assert.match(types, /localAnalysisDefaultApplied: boolean/)
  assert.match(store, /katagoEngineMode: 'auto'/)
  assert.match(store, /settingsStore\.delete\('zhiziUseWhenLocalSlow'\)/)
  assert.match(store, /ikatagoUseWhenLocalSlow: false/)
  assert.match(store, /migrateLocalAnalysisDefault/)
  assert.match(store, /localAnalysisDefaultApplied: true/)
  assert.match(store, /katagoEngineMode === 'zhizi' \|\| settings\.katagoEngineMode === 'ikatago' \? 'auto'/)

  assert.match(zhizi, /settings\.katagoEngineMode === 'zhizi'/)
  assert.doesNotMatch(zhizi, /zhiziUseWhenLocalSlow/)
  assert.match(ikatago, /if \(!settings\.ikatagoUseWhenLocalSlow\) return false/)
  assert.match(ikatago, /if \(!localReady\) return false/)
  assert.doesNotMatch(katago, /settings\.zhiziUseWhenLocalSlow|opt-in slow-machine mode|falling back to Zhizi/)
  assert.match(renderer, /katagoEngineMode: 'auto'/)
  assert.match(zhiziPanel, /GoAgent 默认使用本机分析/)
  assert.match(zhiziPanel, /只有你确认启用后/)
})
