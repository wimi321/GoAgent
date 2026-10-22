import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repoRoot = new URL('..', import.meta.url)

// Windows checkouts use CRLF; the patterns below are written against LF.
async function text(path) {
  return (await readFile(new URL(path, repoRoot), 'utf8')).replace(/\r\n/g, '\n')
}

test('the local secret key is derived with scrypt once per seed, not on every settings read', async () => {
  const store = await text('src/main/lib/store.ts')
  const localSecretKey = store.match(/function localSecretKey\(\)[\s\S]*?\n}\n/)?.[0] ?? ''
  assert.match(localSecretKey, /derivedLocalSecretKey\?\.seed !== seed/)
  assert.match(localSecretKey, /return derivedLocalSecretKey\.key/)
})

test('dashboard refreshes persist only detected changes onto the latest settings', async () => {
  const main = await text('src/main/index.ts')
  const dashboard = main.match(/async function dashboard\([\s\S]*?\n}\n/)?.[0] ?? ''
  assert.match(dashboard, /await persistDetectedDefaults\(\)/)
  assert.doesNotMatch(dashboard, /replaceSettings\(/)
  const persist = main.match(/async function persistDetectedDefaults\(\)[\s\S]*?\n}\n/)?.[0] ?? ''
  assert.match(persist, /JSON\.stringify\(latest\[key\]\) === JSON\.stringify\(before\[key\]\)/)
  assert.match(persist, /if \(!changedKeys\.length\) return latest/)
  assert.match(persist, /replaceSettings\(\{ \.\.\.latest, \.\.\.changes \}\)/)
})

test('quitting stops every KataGo process', async () => {
  const main = await text('src/main/index.ts')
  const beforeQuit = main.match(/app\.on\('before-quit'[\s\S]*?\n}\)/)?.[0] ?? ''
  assert.match(beforeQuit, /cancelKataGoAnalysis\(\{\}\)/)
  assert.match(beforeQuit, /stopPersistentKataGoEngines\(\)/)
})

test('KataGo child processes tolerate EPIPE and never open console windows', async () => {
  for (const path of ['src/main/services/katago.ts', 'src/main/services/katagoPersistentEngine.ts', 'src/main/services/ikatagoClientEngine.ts']) {
    const source = await text(path)
    assert.match(source, /stdin\.on\('error'/, path)
    assert.match(source, /windowsHide: true/, path)
  }
  assert.match(await text('src/main/services/katagoBenchmark.ts'), /windowsHide: true/)
  assert.match(await text('src/main/services/katagoRuntime.ts'), /timeout: BINARY_PROBE_TIMEOUT_MS,\s*windowsHide: true/)
})

test('partial live and trial results survive cancellation and timeouts from either engine path', async () => {
  const katago = await text('src/main/services/katago.ts')
  assert.match(katago, /function isKataGoCancelledError[\s\S]*?\/已取消\|cancelled\|canceled\/i/)
  assert.doesNotMatch(katago, /String\(error\)\.includes\('已取消'\)\) \{/)
  assert.doesNotMatch(katago, /String\(error\)\.includes\('KataGo 分析超时'\)/)
  assert.match(katago, /\(isKataGoCancelledError\(error\) \|\| isKataGoTimeoutError\(error\)\) && latestBefore\?\.rootInfo/)
})

test('teacher sessions are saved with one compact write', async () => {
  const sessions = await text('src/main/services/teacherSession.ts')
  assert.match(sessions, /serialize: \(value\) => JSON\.stringify\(value\)/)
  const save = sessions.match(/function saveSessions\([\s\S]*?\n}\n/)?.[0] ?? ''
  assert.match(save, /teacherSessionStore\.store = \{ sessions: compacted\.slice\(0, 80\), activeSessionId \}/)
  assert.doesNotMatch(save, /teacherSessionStore\.set\(/)
})

test('renderer navigation ignores stale game loads and stale queued analysis', async () => {
  const app = await text('src/renderer/src/App.tsx')
  const loadRecord = app.match(/async function loadRecord\(gameId: string\)[\s\S]*?\n {2}}\n/)?.[0] ?? ''
  assert.match(loadRecord, /await window\.goagent\.getGameRecord\(gameId\)[\s\S]*?if \(selectedGameIdRef\.current !== gameId\) return[\s\S]*?setRecord\(next\)/)
  assert.match(app, /autoAnalysisRequestId\.current = crypto\.randomUUID\(\)\n {6}setMoveNumber\(nextMove\)/)
})

test('re-analysis after a model change runs with the new settings', async () => {
  const app = await text('src/renderer/src/App.tsx')
  const saveSettings = app.match(/async function saveSettings\([\s\S]*?\n {2}}\n/)?.[0] ?? ''
  const install = app.match(/async function installOfficialKataGoModel\([\s\S]*?\n {2}}\n/)?.[0] ?? ''
  for (const handler of [saveSettings, install]) {
    assert.match(handler, /setModelSwitchReanalysis\(\{ gameId: selectedGame\.id, moveNumber/)
    assert.doesNotMatch(handler, /void warmupEvaluationGraph\(/)
  }
  const cacheKeyEffect = app.indexOf('selectedEvaluationCacheKeyRef.current = selectedGame ? analysisCacheKeyForGame')
  const reanalysisEffect = app.indexOf('if (!modelSwitchReanalysis) return')
  assert.ok(cacheKeyEffect > 0 && reanalysisEffect > cacheKeyEffect, 'the re-analysis effect must run after the cache-key effect')
})
