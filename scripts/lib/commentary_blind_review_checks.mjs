// Synthetic in-memory checks only: this does not create commentary results or review output.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fixtureBoards, validatePair, reviewHtml, runStatus } from '../build_commentary_blind_review.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const sgf = '(;SZ[5]KM[0]AB[ab];B[cc];W[bc];B[ae];W[cd];B[ee];W[dc];B[aa];W[cb])'
const fixture = { id: 'position-1', sha256: hash(sgf), boardSize: 5, moveNumber: 8 }
const source = { moveNumber: 8, playerColor: 'W', playedMove: 'C4', boardSnapshot: [
  ['A4', 'B'], ['C3', 'B'], ['B3', 'W'], ['A1', 'B'], ['C2', 'W'], ['E1', 'B'], ['D3', 'W'], ['A5', 'B']
].map(([point, color]) => ({ point, color })) }
const boards = fixtureBoards(fixture, source, sgf + '\n')
assert.ok(boards.before.some(stone => stone.point === 'C3' && stone.color === 'B'))
assert.ok(!boards.after.some(stone => stone.point === 'C3'))
assert.ok(boards.after.some(stone => stone.point === 'C4' && stone.color === 'W'))
assert.ok(boards.after.some(stone => stone.point === 'A4' && stone.color === 'B'))
assert.deepEqual(boards.recentMoves.at(-1), { moveNumber: 7, color: 'B', point: 'A5' })
assert.deepEqual(boards.recentMoves[0], { moveNumber: 1, color: 'B', point: 'C3' })
assert.throws(() => fixtureBoards(fixture, { ...source, boardSnapshot: [] }, sgf), /snapshot/)
const passSgf = sgf.slice(0, -1) + ';B[])'
assert.deepEqual(fixtureBoards({ ...fixture, moveNumber: 9, sha256: hash(passSgf) }, { ...source, moveNumber: 9, playerColor: 'B', playedMove: 'pass', boardSnapshot: boards.after }, passSgf).after, boards.after)

const request = { mode: 'current-move', gameId: 'anonymous-hash', moveNumber: 8, prompt: '同一个完整提示', coachLevel: 'intermediate', studentAgeRange: 'adult', teacherStyle: 'rigorous', toolPolicy: 'auto' }
const applicationSettings = { reviewLanguage: 'zh-CN' }; const requestSettings = { coachLevel: 'intermediate', prefetchedMaxVisits: 96 }
function result(variant) {
  const identity = { model: 'gpt-6-luna', provider: 'codex-app-server', variant, phase: 'formal', fixtureHash: fixture.sha256, bundleHash: hash(variant), runtimeHash: hash('same-runtime'), engineConfigHash: hash('same-engine'), promptHash: hash(request.prompt), settingsHash: hash(JSON.stringify({ app: applicationSettings, request: requestSettings })) }
  return { id: fixture.id, success: true, ...identity, identity, profileHash: hash('same-semantic-profile'), analysis: { gameId: request.gameId, boardSize: 5, moveNumber: 8 }, boardVerification: { verified: true, before: Array(25).fill(0), after: Array(25).fill(0) }, applicationSettings, requestSettings, inferenceSettings: { effort: 'provider-default' }, request: { ...request, runId: variant }, result: { markdown: '完整原文\n<script>alert("escape")</script>\n末尾仍保留' } }
}
const candidate = result('candidate'); const baseline = result('baseline')
validatePair(fixture, candidate, baseline)
for (const change of [
  result => { result.success = false },
  result => { result.model = 'commentary-eval-mock'; result.identity.model = result.model },
  result => { result.provider = 'openai-compatible'; result.identity.provider = result.provider },
  result => { result.runtimeHash = hash('other'); result.identity.runtimeHash = result.runtimeHash },
  result => { result.identity.fixtureHash = hash('other') },
  result => { result.request.prompt = 'changed' },
  result => { result.requestSettings.coachLevel = 'beginner' },
  result => { result.identity.settingsHash = undefined }
  ,result => { result.phase = 'diagnostic'; result.identity.phase = 'diagnostic' }
  ,result => { delete result.phase }
  ,result => { result.profileHash = hash('changed-profile') }
  ,result => { delete result.profileHash }
  ,result => { result.analysis.gameId = 'another-game' }
  ,result => { result.boardVerification.before[0] = 1 }
]) { const changed = structuredClone(baseline); change(changed); assert.throws(() => validatePair(fixture, candidate, changed)) }
const cases = ['A', 'B'].map(letter => ({ id: `position-1:${letter}`, ...boards, markdown: candidate.result.markdown }))
const html = reviewHtml({ model: 'gpt-6-luna', reviewSetId: 'synthetic-check', cases })
assert.ok(html.includes('&lt;script&gt;alert(&quot;escape&quot;)&lt;/script&gt;'))
assert.ok(html.includes('末尾仍保留'))
assert.ok(!html.includes('<script>alert('))
assert.ok(html.includes('data-board="before"') && html.includes('data-board="after"'))
assert.ok(html.includes('if(Object.hasOwn(saved,id)||!byId.has(id))return'))
assert.ok(html.includes('/api/feedback') && html.includes('localStorage.setItem') && html.includes('application/json'))
assert.ok(!/localCaseId|candidate|baseline|weakMentions/.test(html))
assert.ok(html.includes('预定 1 局') && html.includes('最近手顺') && html.includes('第 7 手 黑 A5'))
const interruption = { ...baseline, success: false, error: 'Recovery incomplete: evaluator interruption' }
assert.match(runStatus(interruption).text, /讲解已返回.*评测中断/)
assert.equal(runStatus({ ...baseline, phase: 'diagnostic' }).attempted, false)
const statusOnly = reviewHtml({ model: 'gpt-6-luna', reviewSetId: 'synthetic-check', cases: [], positions: [{ id: 'position-11', state: 'unpaired', statuses: ['整链验收已通过', runStatus(interruption).text] }], summary: { plannedPositions: 10, completePairs: 0, unpairedPositions: 10, expectedRuns: 20, passedRuns: 9, unpassedRuns: 1, pendingRuns: 10 } })
assert.ok(statusOnly.includes('预定 10 局') && statusOnly.includes('流水线尚未完成') && statusOnly.includes('position-11'))
assert.ok(!/localCaseId|candidate|baseline|weakMentions/.test(statusOnly))
console.log('Blind review checks passed: real-pair constraints, mismatch rejection, SGF coordinates/setup/capture/pass, full escaped text, local feedback recovery.')
