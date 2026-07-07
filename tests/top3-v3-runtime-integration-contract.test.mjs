import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repoRoot = new URL('..', import.meta.url)

async function text(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('V3 runtime integration wires adaptive profile, cache and readiness into analysis IPC', async () => {
  const runtime = await text('src/main/services/analysis/runtimeIntegration.ts')
  const index = await text('src/main/index.ts')
  const types = await text('src/main/lib/types.ts')

  assert.equal(existsSync(new URL('src/main/services/analysis/runtimeIntegration.ts', repoRoot)), true)
  assert.match(runtime, /buildAdaptiveAnalysisProfile/)
  assert.match(runtime, /readAnalysisCache/)
  assert.match(runtime, /writeAnalysisCache/)
  assert.match(runtime, /evaluateTeachingReadiness/)
  assert.match(runtime, /buildTeachingEvidenceBundle/)
  assert.match(runtime, /analyzePositionRuntimeEnvelope/)
  assert.match(runtime, /analyzePositionWithProgressRuntime/)
  assert.match(runtime, /analyzeGameQuickRuntime/)
  assert.match(index, /analyzePositionRuntime/)
  assert.match(index, /analyzePositionWithProgressRuntime/)
  assert.match(index, /analyzeGameQuickRuntime/)
  assert.match(types, /AnalysisRuntimeEvidence/)
  assert.match(types, /runtimeEvidence\?: AnalysisRuntimeEvidence/)
})

test('V3 runtime integration keeps scheduler and persistent engine as separate layers', async () => {
  const runtime = await text('src/main/services/analysis/runtimeIntegration.ts')
  const scheduler = await text('src/main/services/analysis/scheduler.ts')
  const persistent = await text('src/main/services/katagoPersistentEngine.ts')

  assert.match(scheduler, /runScheduledAnalysis/)
  assert.match(scheduler, /priorityRank/)
  assert.match(persistent, /persistentKataGoFallbackEnabled/)
  assert.doesNotMatch(runtime, /cancelKataGoAnalysis\(/)
  assert.doesNotMatch(runtime, /spawn\(/)
})

test('V3 teacher prompt is aware of runtime readiness evidence', async () => {
  const teacher = await text('src/main/services/teacherAgent.ts')
  assert.match(teacher, /runtimeEvidence\.teachingReadiness/)
  assert.match(teacher, /safeWording/)
  assert.match(teacher, /cacheStatus/)
})

test('V3 runtime review model bridges timeline, PV playback and evidence panel', async () => {
  const model = await text('src/renderer/src/features/timeline/runtimeReviewModel.ts')
  assert.equal(existsSync(new URL('src/renderer/src/features/timeline/runtimeReviewModel.ts', repoRoot)), true)
  assert.match(model, /buildTimelineReviewItems/)
  assert.match(model, /createReviewNavigatorSession/)
  assert.match(model, /buildBoardPvPreviewState/)
  assert.match(model, /buildVariationPlaybackState/)
  assert.match(model, /buildTeacherEvidencePanel/)
  assert.match(model, /runtimeStatus/)
  assert.match(model, /cacheStatus/)
  assert.match(model, /readinessLevel/)
})

test('V3 analysis cache is tiered and runtime cache keys include engine fingerprints', async () => {
  const cache = await text('src/main/services/analysis/cache.ts')
  const runtime = await text('src/main/services/analysis/runtimeIntegration.ts')
  assert.match(cache, /export type AnalysisCacheTier = 'sweep' \| 'refine' \| 'teaching' \| 'oracle'/)
  assert.match(cache, /modelFingerprint/)
  assert.match(cache, /configFingerprint/)
  assert.match(runtime, /gameFingerprint/)
  assert.match(runtime, /runtimeFingerprints/)
  assert.match(runtime, /cacheRequirementForProfile/)
  assert.match(runtime, /requireOwnership: profile\.includeOwnership/)
})
