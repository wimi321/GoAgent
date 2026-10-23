import test from 'node:test'
import assert from 'node:assert/strict'
import { hasInitialCurrentBoardImage, missingTeacherEvidenceTools } from '../src/main/services/teacher/evidenceToolGate.ts'
import { buildVisionEvidenceReport, buildVisionImageContentParts } from '../src/main/services/teacher/visionEvidence.ts'

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSAAAAABJRU5ErkJggg=='
function fixture() {
  const request = { mode: 'current-move', gameId: 'game', moveNumber: 12, boardImageDataUrl: png }
  const report = buildVisionEvidenceReport(request)
  const initialMessage = { role: 'user', content: buildVisionImageContentParts(request, report) }
  return { intent: 'current-move', request, report, initialMessage,
    successfulTools: new Set(['katago_analyzePosition', 'knowledge_matchPosition']) }
}
test('actual valid current-board attachment replaces only the redundant screenshot requirement', () => {
  const input = fixture()
  assert.equal(hasInitialCurrentBoardImage(input.request, input.report, input.initialMessage), true)
  assert.deepEqual(missingTeacherEvidenceTools(input), [])
  input.successfulTools.delete('katago_analyzePosition')
  assert.deepEqual(missingTeacherEvidenceTools(input), ['katago_analyzePosition'])
})
test('attached flag, invalid data, mismatched move, or unsent image never satisfy the tool gate', () => {
  const input = fixture()
  for (const change of [
    { initialMessage: { role: 'user', content: 'metadata only' } },
    { initialMessage: { role: 'user', content: [{ type: 'image_url', image_url: { url: `${png}different` } }] } },
    { request: { ...input.request, boardImageDataUrl: undefined } },
    { request: { ...input.request, boardImageDataUrl: 'data:image/png;base64,AA==' } },
    { request: { ...input.request, moveNumber: 13 } },
    { report: { ...input.report, images: input.report.images.map(image => ({ ...image, valid: false })) } },
    { report: { ...input.report, images: input.report.images.map(image => ({ ...image, moveNumber: 11 })) } },
    { report: { ...input.report, source: 'tool-capture' } }
  ]) assert.deepEqual(missingTeacherEvidenceTools({ ...input, ...change }), ['board_captureTeachingImage'])
})
test('trial attachment must identify the current branch endpoint', () => {
  const input = fixture()
  input.request.boardContext = 'trial'
  input.request.trialBranch = { active: true, baseMoveNumber: 11, moves: [{ color: 'W', gtp: 'D4' }] }
  assert.deepEqual(missingTeacherEvidenceTools(input), [])
  input.request.trialBranch.baseMoveNumber = 10
  assert.deepEqual(missingTeacherEvidenceTools(input), ['board_captureTeachingImage'])
})
test('game and range reviews retain screenshot tools even with a valid current-board attachment', () => {
  const input = fixture()
  for (const intent of ['game-review', 'move-range']) {
    input.successfulTools = new Set(['sgf_readGameRecord', 'katago_analyzeGameBatch', 'katago_analyzeMoveRangeKeyMoves', 'knowledge_matchPosition'])
    assert.deepEqual(missingTeacherEvidenceTools({ ...input, intent }), ['board_captureTeachingImage'])
    input.successfulTools.add('board_captureTeachingImage')
    assert.deepEqual(missingTeacherEvidenceTools({ ...input, intent }), [])
  }
})
