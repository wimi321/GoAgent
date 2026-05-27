import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repoRoot = new URL('..', import.meta.url)

async function text(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('top3 development adds analysis scheduler and persistent engine settings', async () => {
  assert.equal(existsSync(new URL('src/main/services/analysis/scheduler.ts', repoRoot)), true)
  const scheduler = await text('src/main/services/analysis/scheduler.ts')
  const persistent = await text('src/main/services/katagoPersistentEngine.ts')
  const types = await text('src/main/lib/types.ts')
  const store = await text('src/main/lib/store.ts')
  const main = await text('src/main/index.ts')

  assert.match(types, /KataGoEngineMode = 'auto' \| 'persistent' \| 'spawn'/)
  assert.match(types, /katagoEngineMode: KataGoEngineMode/)
  assert.match(store, /katagoEngineMode: 'auto'/)
  assert.match(scheduler, /runScheduledAnalysis/)
  assert.match(scheduler, /priorityRank/)
  assert.match(scheduler, /replaceGroup/)
  assert.match(persistent, /persistentKataGoFallbackEnabled/)
  assert.match(persistent, /katagoEngineMode/)
  assert.match(main, /analysis-scheduler:stats/)
  assert.match(main, /runScheduledAnalysis/)
})

test('top3 development adds move classification and pv confidence evidence', async () => {
  const classifier = await text('src/main/services/analysis/classifier.ts')
  const pv = await text('src/main/services/analysis/pvConfidence.ts')
  const bundle = await text('src/main/services/teacher/evidenceBundle.ts')
  const katago = await text('src/main/services/katago.ts')
  const types = await text('src/main/lib/types.ts')

  assert.match(types, /MoveClassificationSeverity/)
  assert.match(types, /PvConfidenceReport/)
  assert.match(types, /moveClassification\?: MoveClassification/)
  assert.match(types, /pvConfidence\?: PvConfidenceReport/)
  assert.match(classifier, /classifyMoveAnalysis/)
  assert.match(classifier, /phaseSeverity/)
  assert.match(classifier, /shouldDeepen/)
  assert.match(pv, /buildPvConfidenceReport/)
  assert.match(pv, /recommendedWording/)
  assert.match(bundle, /buildTeachingEvidenceBundle/)
  assert.match(bundle, /forbiddenClaims/)
  assert.match(bundle, /formatTeachingEvidenceBundleForPrompt/)
  assert.match(katago, /classifyMoveAnalysis\(analysis\)/)
  assert.match(katago, /buildPvConfidenceReport\(analysis\)/)
})

test('top3 development adds review navigator and board pv interaction contracts', async () => {
  assert.equal(existsSync(new URL('src/renderer/src/features/timeline/reviewNavigator.ts', repoRoot)), true)
  assert.equal(existsSync(new URL('src/renderer/src/features/board/pvInteraction.ts', repoRoot)), true)
  assert.equal(existsSync(new URL('src/renderer/src/features/teacher/evidenceChips.ts', repoRoot)), true)
  const timeline = await text('src/renderer/src/features/timeline/reviewNavigator.ts')
  const board = await text('src/renderer/src/features/board/pvInteraction.ts')
  const chips = await text('src/renderer/src/features/teacher/evidenceChips.ts')

  assert.match(timeline, /buildTimelineReviewItems/)
  assert.match(timeline, /keyMoveNumbersForRange/)
  assert.match(timeline, /pvConfidence/)
  assert.match(board, /buildBoardPvPreviewState/)
  assert.match(board, /stepPvPreview/)
  assert.match(board, /buildEvidenceHighlightFromText/)
  assert.match(chips, /evidenceChipsFromAnalysis/)
  assert.match(chips, /TeacherEvidenceChipKind/)
})
