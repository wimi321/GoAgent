import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const mainIndex = readFileSync(join(root, 'src/main/index.ts'), 'utf8')
const katago = readFileSync(join(root, 'src/main/services/katago.ts'), 'utf8')
const runtimeIntegration = readFileSync(join(root, 'src/main/services/analysis/runtimeIntegration.ts'), 'utf8')

test('quick game analysis IPC treats scheduler cancellations as controlled interruptions', () => {
  const start = mainIndex.indexOf("ipcMain.handle('katago:analyze-game-quick'")
  assert.ok(start > 0, 'katago:analyze-game-quick IPC handler should exist')

  const end = mainIndex.indexOf("ipcMain.handle('katago:cancel-analysis'", start)
  assert.ok(end > start, 'quick handler should appear before cancel-analysis handler')

  const handler = mainIndex.slice(start, end)
  assert.match(handler, /try\s*\{[\s\S]*runScheduledAnalysis/, 'quick handler should guard scheduled analysis')
  assert.match(handler, /catch\s*\(error\)/, 'quick handler should catch controlled cancellations')
  assert.match(handler, /已取消\|cancel\|replaced\|替换\|停止/, 'quick handler should recognize cancellation messages')
  assert.match(handler, /return\s+\[\]/, 'cancelled quick sweeps should return an empty graph update instead of throwing')
})

test('cancel-analysis reaches queued scheduler work as well as the active engine', () => {
  assert.match(
    mainIndex,
    /import\s*\{[^}]*cancelScheduledAnalysis[^}]*\}\s*from\s*'\.\/services\/analysis\/scheduler'/,
    'main process should import scheduler-aware cancellation'
  )
  assert.match(
    mainIndex,
    /ipcMain\.handle\('katago:cancel-analysis'[\s\S]*?cancelScheduledAnalysis\(payload\)/,
    'cancel-analysis IPC should cancel queued and active work'
  )
})

test('streaming position analysis preserves the caller run id and group for cancellation', () => {
  assert.match(katago, /runId:\s*options\.runId\s*\?\?/)
  assert.match(katago, /group:\s*options\.group\s*\?\?/)
  assert.match(runtimeIntegration, /runId:\s*input\.runId/)
  assert.match(runtimeIntegration, /group:\s*input\.group/)
})
