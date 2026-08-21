import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repoRoot = new URL('..', import.meta.url)

async function text(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('full-game teacher analysis reuses only a complete matching sweep cache', async () => {
  const runtime = await text('src/main/services/analysis/runtimeIntegration.ts')

  assert.match(runtime, /export function readGameAnalysisCacheRuntime/)
  assert.match(runtime, /runtimeCacheKey\(\{/)
  assert.match(runtime, /modelFingerprint/)
  assert.match(runtime, /configFingerprint/)
  assert.match(runtime, /const complete = analyses\.length === totalMoves/)
  assert.match(runtime, /analyses: complete \? analyses : \[\]/)
  assert.match(runtime, /if \(cached\.complete\)/)
  assert.ok(
    runtime.indexOf('if (cached.complete)') < runtime.indexOf('const analyses = await analyzeGameQuick('),
    'cache lookup must happen before a new KataGo sweep starts'
  )
})

test('teacher whole-game tool uses the cancellable runtime path and reports real progress', async () => {
  const teacher = await text('src/main/services/teacherAgent.ts')
  const types = await text('src/main/lib/types.ts')
  const renderer = await text('src/renderer/src/App.tsx')
  const i18n = await text('src/renderer/src/i18n.ts')

  assert.match(teacher, /analyzeGameQuickRuntime\(\{/)
  assert.match(teacher, /group: 'teacher'/)
  assert.match(teacher, /updateRunningToolProgress\(state, 'katago\.analyzeGameBatch'/)
  assert.match(teacher, /cacheStatus: reusedCompleteSweepCache \? 'hit' : 'fresh-analysis'/)
  assert.match(types, /progress\?: \{\s*current: number\s*total: number/s)
  assert.match(renderer, /toolDetailAnalyzeGameProgress/)
  assert.match(i18n, /正在分析 \{\{current\}\} \/ \{\{total\}\} 个局面/)
})

test('full-game screenshots can reuse the analyzed key-move evidence', async () => {
  const teacher = await text('src/main/services/teacherAgent.ts')

  assert.match(teacher, /state\.rangeAnalyses = analyses/)
  assert.match(teacher, /selection === 'top-loss'/)
  assert.match(teacher, /analysisForMoveNumber\(state, moveNumber\)/)
})

test('generated KataGo config keeps a stable fingerprint when settings do not change', async () => {
  const runtime = await text('src/main/services/katagoRuntime.ts')

  assert.match(runtime, /const existingContent = existsSync\(configPath\) \? readFileSync\(configPath, 'utf8'\) : ''/)
  assert.match(runtime, /if \(existingContent !== configContent\)/)
  assert.doesNotMatch(runtime, /writeFileSync\(\s*configPath,\s*\[/)
})
