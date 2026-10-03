import test from 'node:test'
import assert from 'node:assert/strict'
import { anonymousSgf, assertAnonymousSgf, assertSafeBoundary, gtpToSgf, prepareCases, teacherRequest, validatePipelineEvidence, validateFreshPrefetch, validateMockCapture, canResume, replayResearchBoard, validateImportedRecord, extractCompactJsonField, parseStoredResult, semanticProfile } from '../scripts/lib/commentary_eval.mjs'

const record = { sample_id: 'private:3', board_size: 9, komi: 6.5, rules: 'japanese', initial_stones: [['B', 'D4'], ['W', 'F6']], moves_before: [['W', 'pass'], ['B', 'A1']], played_move: ['W', 'J9'], comment: 'Original "human" commentary\nwith another line.', labels: ['ladder'], source_game_key: 'PRIVATE-SOURCE' }

test('anonymous SGF preserves initial stones, history, played move and pass', () => {
  const result = anonymousSgf(record)
  assert.equal(result.sgf, '(;SZ[9]KM[6.5]RU[japanese]AB[df]AW[fd];W[];B[ai];W[ia])')
  assert.equal(result.moveNumber, 3)
  assert.ok(!result.sgf.includes(record.comment))
})
test('unknown rules remain explicit absence without fabricated source rules', () => {
  const result = anonymousSgf({ ...record, rules: null })
  assert.equal(result.rulesOrigin, 'absent')
  assert.ok(!result.sgf.includes('RU['))
})
test('anonymous engine evidence matches history rather than unrelated anonymous ID', () => {
  const engines = [{ id: 'position-99', positions: { pre: { boardXSize: 9, initialStones: record.initial_stones, moves: record.moves_before, rules: 'chinese', komi: 7.5 } } }]
  const [fixture] = prepareCases([{ id: record.sample_id, moveNumber: 3 }], [record], engines, '.')
  assert.equal(fixture.rules, 'chinese')
  assert.equal(fixture.komi, 7.5)
  assert.equal(fixture.rulesOrigin, 'engine')
})
test('SGF whitelist rejects human comments, people and metadata', () => {
  for (const property of ['C', 'PB', 'PW', 'EV', 'GN', 'SO']) assert.throws(() => assertAnonymousSgf(`(;SZ[19]${property}[private])`))
})
test('invalid coordinates, invalid setup passes and rules injection fail', () => {
  for (const point of ['I3', 'A0', 'K9', 'resign']) assert.throws(() => gtpToSgf(point, 9))
  assert.throws(() => anonymousSgf({ ...record, initial_stones: [['B', 'pass']] }))
  assert.throws(() => anonymousSgf({ ...record, rules: 'japanese]C[private' }))
})
test('external request excludes local original identifiers', () => {
  const request = teacherRequest({ id: 'position-1', moveNumber: 3, localCaseId: record.sample_id }, 'anonymous-hash', 'candidate')
  assertSafeBoundary(request, [{ localCaseId: record.sample_id }], [record])
  assert.throws(() => assertSafeBoundary({ content: `Origin ${record.sample_id}` }, [{ localCaseId: record.sample_id }], [record]))
})
test('boundary checks detect multiline quoted commentary in raw and JSON-encoded tool messages', () => {
  for (const content of [record.comment, JSON.stringify({ annotation: record.comment }), `Context: ${JSON.stringify({ annotation: record.comment })}`]) assert.throws(() => assertSafeBoundary({ content }, [], [record]))
  assert.throws(() => assertSafeBoundary({ content: record.source_game_key }, [], [record]))
  assertSafeBoundary({ comment: '', content: 'Independent board evidence' }, [], [record])
})
test('resume requires all evaluation identity fields and successful validation', () => {
  const identity = { model: 'gpt-6-luna', provider: 'codex-app-server', variant: 'candidate', fixtureHash: 'f', promptHash: 'p', bundleHash: 'b', settingsHash: 's' }
  assert.equal(canResume({ success: true, identity }, identity), true)
  assert.equal(canResume({ success: false, identity }, identity), false)
  for (const key of Object.keys(identity)) assert.equal(canResume({ success: true, identity: { ...identity, [key]: 'different' } }, identity), false)
})
function payload() {
  return { analysis: { moveNumber: 3, boardSize: 9, before: { winrate: 50, scoreLead: 0, topMoves: [{ move: 'A1' }] } }, result: { markdown: 'Evidence-based teaching', visionEvidence: { attached: true, imageCount: 1, images: [{ valid: true, moveNumber: 3, role: 'current-board' }] }, toolLogs: ['katago.analyzePosition', 'board.captureTeachingImage', 'knowledge.matchPosition'].map(name => ({ name, status: 'done' })) } }
}
test('real pipeline acceptance needs engine, valid image and successful domain tools', () => {
  validatePipelineEvidence(payload(), { moveNumber: 3, boardSize: 9 })
  const noImage = payload(); noImage.result.visionEvidence.attached = false
  assert.throws(() => validatePipelineEvidence(noImage, { moveNumber: 3, boardSize: 9 }))
  const noEngine = payload(); noEngine.analysis.before.topMoves = []
  assert.throws(() => validatePipelineEvidence(noEngine, { moveNumber: 3, boardSize: 9 }))
  const failedTool = payload(); failedTool.result.toolLogs[0].status = 'error'
  assert.throws(() => validatePipelineEvidence(failedTool, { moveNumber: 3, boardSize: 9 }))
})
test('mock capture needs four successful actual tool results and image content', () => {
  const messages = ['sgf_readGameRecord', 'knowledge_matchPosition', 'katago_analyzePosition', 'board_captureTeachingImage'].map(name => ({ role: 'tool', tool_call_id: `eval_${name}`, content: '{"ok":true,"result":{}}' }))
  assert.throws(() => validateMockCapture([{ body: { messages } }]))
  messages.push({ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,c2FtcGxl' } }] })
  validateMockCapture([{ body: { messages } }])
  messages[0].content = '{"ok":false}'
  assert.throws(() => validateMockCapture([{ body: { messages } }]))
  messages[0].content = '{"ok": true, "result": {\n[tool result truncated: 200 chars omitted]'
  validateMockCapture([{ body: { messages } }])
  messages[0].content = '{"error": {"ok": true}\n[tool result truncated: 200 chars omitted]'
  assert.throws(() => validateMockCapture([{ body: { messages } }]))
})
test('research replay removes captured stones and validates imported coordinates and setup', () => {
  const source = { board_size: 3, initial_stones: [['B', 'A2'], ['B', 'B1'], ['B', 'C2'], ['W', 'B2']], moves_before: [], played_move: ['B', 'B3'], board_before: [0, 1, 0, 1, -1, 1, 0, 0, 0], board_after: [0, 1, 0, 1, 0, 1, 0, 1, 0] }
  assert.deepEqual(replayResearchBoard(3, source.initial_stones, [source.played_move]), source.board_after)
  const coord = point => { const sgf = gtpToSgf(point, 3); return { row: sgf.charCodeAt(1) - 97, col: sgf.charCodeAt(0) - 97 } }
  const imported = { boardSize: 3, moves: [{ color: 'B', gtp: 'B3', ...coord('B3') }], initialStones: source.initial_stones.map(([color, point]) => ({ color, point, ...coord(point) })) }
  assert.equal(validateImportedRecord(imported, source).verified, true)
  assert.throws(() => validateImportedRecord({ ...imported, moves: [{ ...imported.moves[0], col: 0 }] }, source))
  assert.throws(() => validateImportedRecord(imported, { ...source, board_after: source.board_before }))
})
test('complete prioritized concept evidence survives a truncated tool result', () => {
  const evidence = { moveNumber: 3, boardTiming: 'before-move', prompt: 'Quoted "facts" and {braces}', entries: [{ role: 'played', concepts: { geometry: [] } }] }
  const compact = `{"ok":true,"result":{"moveConceptEvidence":${JSON.stringify(evidence)},"knowledge":[\n[tool result truncated: 100 chars omitted]`
  assert.deepEqual(extractCompactJsonField(compact, 'moveConceptEvidence'), evidence)
  assert.equal(extractCompactJsonField(compact.slice(0, 90), 'moveConceptEvidence'), null)
  assert.equal(extractCompactJsonField('{"ok":true,"result":{}}', 'moveConceptEvidence'), null)
})
test('corrupt artifacts cannot be resumed and semantic profiles ignore only timestamps', () => {
  assert.equal(canResume(parseStoredResult('{"success":true,'), {}), false)
  assert.deepEqual(semanticProfile({ gamesReviewed: 0, createdAt: 'old', updatedAt: 'new' }), { gamesReviewed: 0 })
  const wrote = payload(); wrote.result.toolLogs.push({ name: 'studentProfile.write', status: 'done' })
  assert.throws(() => validatePipelineEvidence(wrote, { moveNumber: 3, boardSize: 9 }))
})

test('paired prefetch must bypass lookup even when a cache miss would otherwise compute fresh', () => {
  validateFreshPrefetch({ runtimeEvidence: { cacheStatus: 'written', cacheReason: 'miss: fresh analysis requested; cache lookup bypassed; wrote visits' } })
  for (const runtimeEvidence of [{ cacheStatus: 'hit', cacheReason: 'cache lookup bypassed' }, { cacheStatus: 'written', cacheReason: 'miss: cache file does not exist' }, {}]) assert.throws(() => validateFreshPrefetch({ runtimeEvidence }))
})
