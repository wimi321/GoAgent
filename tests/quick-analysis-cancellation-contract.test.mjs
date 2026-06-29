import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const mainIndex = readFileSync(join(root, 'src/main/index.ts'), 'utf8')

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
