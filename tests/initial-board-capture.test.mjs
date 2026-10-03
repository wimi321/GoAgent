import test from 'node:test'
import assert from 'node:assert/strict'
import { needsInitialBoardCapture, prepareInitialBoardMessages } from '../src/main/services/teacher/initialBoardCapture.ts'

const input = () => ({
  provider: 'codex-app-server', intent: 'current-move', hasCaptureHandler: true,
  request: { mode: 'current-move', gameId: 'game', moveNumber: 12, toolPolicy: 'auto' },
  report: { required: true, attached: false }
})
const image = { role: 'user', content: [{ type: 'text', text: '第12手棋盘' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }] }

test('initial capture is limited to explicit automatic ChatGPT board review', async () => {
  const expected = input()
  assert.equal(needsInitialBoardCapture(expected), true)
  for (const changed of [
    { provider: 'openai-compatible' }, { intent: 'freeform' }, { hasCaptureHandler: false },
    { request: { ...expected.request, mode: 'freeform' } },
    { request: { ...expected.request, toolPolicy: 'manual' } },
    { request: { ...expected.request, gameId: '' } },
    { request: { ...expected.request, moveNumber: 0 } },
    { request: { ...expected.request, moveNumber: 2.5 } },
    { report: { required: false, attached: false } }, { report: { required: true, attached: true } }
  ]) {
    let calls = 0
    assert.deepEqual(await prepareInitialBoardMessages({ ...expected, ...changed }, async () => { calls++; return { ok: true, toolResult: '', followupMessages: [image] } }), [])
    assert.equal(calls, 0)
  }
})
test('one real capture supplies metadata before its initial image, including trial requests', async () => {
  let calls = 0
  const expected = input()
  expected.request.boardContext = 'trial'
  expected.request.trialBranch = { active: true, baseMoveNumber: 11, moves: [{ color: 'W', gtp: 'C15' }] }
  const messages = await prepareInitialBoardMessages(expected, async () => {
    calls++
    return { ok: true, toolResult: '{"moveNumber":12,"visionEvidence":{"attached":true}}', followupMessages: [image] }
  })
  assert.equal(calls, 1)
  assert.match(messages[0].content, /"moveNumber":12/)
  assert.deepEqual(messages[1], image)
  assert.equal(messages.filter(message => Array.isArray(message.content)).length, 1)
})
test('failed, empty-image, and cancelled captures prevent a subsequent model call', async () => {
  for (const capture of [
    async () => ({ ok: false, toolResult: 'renderer failed', followupMessages: [] }),
    async () => ({ ok: true, toolResult: 'metadata only', followupMessages: [] }),
    async () => { throw new Error('cancelled') }
  ]) {
    let modelCalls = 0
    await assert.rejects(async () => { await prepareInitialBoardMessages(input(), capture); modelCalls++ })
    assert.equal(modelCalls, 0)
  }
})
