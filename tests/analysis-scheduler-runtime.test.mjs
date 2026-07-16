import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const source = readFileSync(
  join(process.cwd(), 'src/main/services/analysis/scheduler.ts'),
  'utf8'
)

test('analysis scheduler telemetry stores an explicit IPC-cloneable snapshot', () => {
  const updateStart = source.indexOf('function updateRecent')
  const updateEnd = source.indexOf('function pickNext', updateStart)
  const updateRecent = source.slice(updateStart, updateEnd)
  assert.match(updateRecent, /id:\s*snapshot\.id/)
  assert.match(updateRecent, /status:\s*snapshot\.status/)
  assert.match(updateRecent, /queueWaitMs:\s*snapshot\.queueWaitMs/)
  assert.doesNotMatch(updateRecent, /\{\s*\.\.\.snapshot\s*\}/)
  assert.doesNotMatch(updateRecent, /\btask\b|\bresolve\b|\breject\b/)
})

test('analysis scheduler cancellation covers queued and active engine work', () => {
  const cancelStart = source.indexOf('export function cancelScheduledAnalysis')
  const cancellation = source.slice(cancelStart)
  assert.match(cancellation, /queue\.splice\(index,\s*1\)/)
  assert.match(cancellation, /entry\.reject\(new Error\(entry\.error\)\)/)
  assert.match(cancellation, /cancelKataGoAnalysis\(filter\)/)
})
