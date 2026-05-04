import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('engine silver eval and release artifact smoke are wired into package scripts', () => {
  const packageJson = JSON.parse(read('package.json'))
  assert.equal(packageJson.scripts['eval:engine-silver'], 'node scripts/eval_engine_silver.mjs')
  assert.equal(packageJson.scripts['smoke:release-artifacts'], 'node scripts/release_artifact_smoke.mjs')
  assert.match(packageJson.scripts['check:teacher-quality'], /eval:engine-silver/)
  assert.match(packageJson.scripts['check:release-quality'], /smoke:release-artifacts/)
})

test('KataGo engine pool telemetry exists and is touched by katago runtime', () => {
  const pool = read('src/main/services/katagoEnginePool.ts')
  const katago = read('src/main/services/katago.ts')
  assert.match(pool, /beginKataGoEngineTask/)
  assert.match(pool, /getKataGoEnginePoolStats/)
  assert.match(pool, /priorityForGroup/)
  assert.match(katago, /beginKataGoEngineTask/)
  assert.match(katago, /engineLease\.finish\('done'\)/)
})

test('PR #6 valuable pieces were selectively imported without duplicating main moveRange path', () => {
  const progression = read('src/shared/moveRangeAnalysis.ts')
  const boardText = read('src/main/services/go/boardTextRender.ts')
  assert.match(progression, /buildMoveRangeProgression/)
  assert.match(progression, /maxSingleMoveBlackWinrateSwing/)
  assert.match(boardText, /renderBoardText/)
  assert.match(boardText, /buildBoardState/)
})
