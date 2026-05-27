import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repoRoot = new URL('..', import.meta.url)

async function text(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('top3 v2 adds main-side analysis cache and adaptive analysis profile contracts', async () => {
  assert.equal(existsSync(new URL('src/main/services/analysis/cache.ts', repoRoot)), true)
  assert.equal(existsSync(new URL('src/main/services/analysis/adaptiveProfile.ts', repoRoot)), true)
  const cache = await text('src/main/services/analysis/cache.ts')
  const profile = await text('src/main/services/analysis/adaptiveProfile.ts')

  assert.match(cache, /AnalysisCacheTier = 'sweep' \| 'refine' \| 'teaching' \| 'oracle'/)
  assert.match(cache, /analysisCacheKey/)
  assert.match(cache, /readAnalysisCache/)
  assert.match(cache, /writeAnalysisCache/)
  assert.match(cache, /qualityFromAnalysis/)
  assert.match(cache, /summarizeAnalysisCache/)
  assert.match(profile, /AdaptiveAnalysisIntent/)
  assert.match(profile, /buildAdaptiveAnalysisProfile/)
  assert.match(profile, /katagoBenchmarkVisitsPerSecond/)
  assert.match(profile, /katagoAnalysisSpeedMode/)
  assert.match(profile, /describeAdaptiveAnalysisProfile/)
})

test('top3 v2 adds teaching readiness gate on top of evidence bundle', async () => {
  assert.equal(existsSync(new URL('src/main/services/analysis/readinessGate.ts', repoRoot)), true)
  const gate = await text('src/main/services/analysis/readinessGate.ts')
  assert.match(gate, /TeachingReadinessLevel = 'ready' \| 'usable' \| 'needs-deeper' \| 'insufficient'/)
  assert.match(gate, /evaluateTeachingReadiness/)
  assert.match(gate, /buildTeachingEvidenceBundle/)
  assert.match(gate, /formatTeachingReadinessGateForPrompt/)
  assert.match(gate, /canUseInFinalReport/)
  assert.match(gate, /safeWording/)
})

test('top3 v2 adds review session, variation playback, and evidence panel models', async () => {
  assert.equal(existsSync(new URL('src/renderer/src/features/timeline/reviewSession.ts', repoRoot)), true)
  assert.equal(existsSync(new URL('src/renderer/src/features/board/variationPlayback.ts', repoRoot)), true)
  assert.equal(existsSync(new URL('src/renderer/src/features/teacher/evidencePanelModel.ts', repoRoot)), true)
  const session = await text('src/renderer/src/features/timeline/reviewSession.ts')
  const playback = await text('src/renderer/src/features/board/variationPlayback.ts')
  const panel = await text('src/renderer/src/features/teacher/evidencePanelModel.ts')

  assert.match(session, /createReviewNavigatorSession/)
  assert.match(session, /selectReviewRange/)
  assert.match(session, /toggleLockedPv/)
  assert.match(session, /currentPvMove/)
  assert.match(playback, /buildVariationPlaybackState/)
  assert.match(playback, /playbackHighlights/)
  assert.match(playback, /variationPlaybackText/)
  assert.match(panel, /buildTeacherEvidencePanel/)
  assert.match(panel, /evidencePanelCopyText/)
  assert.match(panel, /next-action/)
})
