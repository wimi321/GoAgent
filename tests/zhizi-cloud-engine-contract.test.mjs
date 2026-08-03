import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repoRoot = new URL('..', import.meta.url)

async function text(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('Zhizi official API is a first-class but explicitly enabled engine mode', async () => {
  assert.equal(existsSync(new URL('src/main/services/zhiziApiClient.ts', repoRoot)), true)
  assert.equal(existsSync(new URL('src/main/services/zhiziPayment.ts', repoRoot)), true)
  const types = await text('src/main/lib/types.ts')
  const store = await text('src/main/lib/store.ts')
  const katago = await text('src/main/services/katago.ts')
  const engine = await text('src/main/services/zhiziGtpEngine.ts')

  assert.match(types, /KataGoEngineMode = 'auto' \| 'persistent' \| 'spawn' \| 'ikatago' \| 'zhizi'/)
  assert.match(types, /ZhiziGpuType = 'vip-share' \| '1x' \| '3x' \| '6x' \| '12x' \| '24x'/)
  assert.match(store, /katagoEngineMode: 'auto'/)
  assert.match(store, /zhiziKataName: 'katago-TENSORRT'/)
  assert.match(store, /zhiziKataWeight: '28bnbt'/)
  assert.match(engine, /settings\.katagoEngineMode === 'zhizi'/)
  assert.doesNotMatch(katago, /falling back to Zhizi cloud|canUseZhiziAutoFallback|zhiziUseWhenLocalSlow/)
})

test('remote engine uses official ready, fresh-token reconnect, numeric GTP and full replay', async () => {
  const engine = await text('src/main/services/zhiziGtpEngine.ts')
  const protocol = await text('src/main/services/zhiziGtpProtocol.ts')
  const session = await text('src/main/services/zhiziSocketSession.ts')
  const smoke = await text('scripts/smoke_zhizi_remote.mjs')

  assert.match(session, /socket\.on\('ready'/)
  assert.doesNotMatch(session, /READY_FALLBACK|GTP ready\|beginning main protocol loop/)
  assert.match(session, /createZhiziSocketToken/)
  assert.match(session, /reconnection: false/)
  assert.match(session, /generation \+= 1/)
  assert.match(engine, /formatGtpCommand/)
  assert.match(engine, /findGtpCommandResponse/)
  assert.match(engine, /await channel\.restart/)
  assert.match(engine, /clear_board/)
  assert.match(engine, /\.\.\.query\.moves\.map/)
  assert.match(engine, /captureGeneration/)
  assert.match(protocol, /parseGtpCommandResponses/)
  assert.match(protocol, /--platform', 'all'/)
  assert.match(protocol, /--engine-type', 'go'/)
  assert.match(smoke, /timeoutMs = 60_000/)
  assert.doesNotMatch(protocol, /zhiziExtraArgs|parseExtraArgs|shell/)
})

test('main, preload and settings expose the official account and billing loop without tokens', async () => {
  const main = await text('src/main/index.ts')
  const preload = await text('src/preload/index.ts')
  const panel = await text('src/renderer/src/features/settings/ZhiziCloudSettingsPanel.tsx')
  const app = await text('src/renderer/src/App.tsx')

  for (const channel of [
    'zhizi:login-password', 'zhizi:send-code', 'zhizi:login-code', 'zhizi:reset-password',
    'zhizi:account-data', 'zhizi:usages', 'zhizi:credits', 'zhizi:payment-create',
    'zhizi:payment-refresh', 'zhizi:payment-cancel', 'zhizi:test-connection', 'zhizi:enable', 'zhizi:disable'
  ]) {
    assert.match(main, new RegExp(channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.doesNotMatch(main, /zhizi:get-saved-token/)
  assert.doesNotMatch(preload, /getSavedZhiziToken/)
  const loginHandlers = main.slice(main.indexOf("ipcMain.handle('zhizi:login-password'"), main.indexOf("ipcMain.handle('zhizi:account-data'"))
  assert.equal((loginHandlers.match(/katagoEngineMode: 'auto'/g) ?? []).length, 3)
  assert.match(panel, /MEMBERSHIP_1_MONTH/)
  assert.match(panel, /setInterval[\s\S]*2000/)
  assert.match(panel, /paidConfirmed/)
  assert.match(panel, /ZhiziCloudSettingsPanel/)
  assert.match(panel, /useState<ViewId>\('account'\)/)
  assert.match(panel, /const loggedIn = overview\?\.tokenValid === true/)
  assert.match(panel, /accountChecking/)
  assert.match(panel, /loggedIn \? \['compute', 'account', 'history'\]/)
  assert.match(app, /type SettingsPageId = 'general' \| 'ai' \| 'katago' \| 'zhizi' \| 'voice' \| 'about'/)
  assert.match(app, /id: 'zhizi'/)
})
