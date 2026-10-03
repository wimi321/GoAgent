import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConceptModule } from '../scripts/lib/concept_modules.mjs'

const { buildMoveConceptEvidence } = await loadConceptModule('src/main/services/teacher/moveConceptEvidence.ts')
const { extractKataGoShapeFeatures } = await loadConceptModule('src/main/services/knowledge/katagoShapeFeatures.ts')
const snapshot = [{ color: 'B', point: 'D4' }]
const analysis = { moveNumber: 10, boardSize: 19, currentMove: { color: 'B', gtp: 'F4' }, before: { topMoves: [
  { move: 'F4', pv: ['F4', 'Q16', 'E4'] }, { move: 'E6', pv: ['E6', 'E4'] }
] } }

test('played and root candidates use before-move board and never label a PV continuation', () => {
  const evidence = buildMoveConceptEvidence({ moveNumber: 10, boardSize: 19, boardSnapshot: snapshot, analysis })
  assert.equal(evidence.boardTiming, 'before-move')
  assert.deepEqual(evidence.entries.map((entry) => [entry.role, entry.move]), [['played', 'F4'], ['candidate', 'E6']])
  assert.equal(evidence.entries[0].concepts.geometry[0].kind, 'one-space-jump')
  assert.equal(evidence.entries[1].concepts.geometry[0].kind, 'small-knight')
  assert.equal(evidence.moveEffects.actual.move, 'F4')
  assert.deepEqual(evidence.candidateMoveEffects.map(entry => entry.move), ['E6'])
  assert.match(evidence.prompt, /不能仅凭间隔确定是拆/)
  assert.doesNotMatch(evidence.prompt, /Q16/)
})

test('actual ko connection and root candidate effects reach evidence without replaying PV as facts', () => {
  const boardSnapshot = [
    ...['D4', 'E3', 'E5', 'F4'].map(point => ({ point, color: 'B' })),
    ...['C4', 'D3', 'D5'].map(point => ({ point, color: 'W' }))
  ]
  const before = structuredClone(boardSnapshot)
  const evidence = buildMoveConceptEvidence({ moveNumber: 20, boardSize: 9, playerColor: 'B', playedMove: 'E4', boardSnapshot,
    analysis: { moveNumber: 20, boardSize: 9, currentMove: { color: 'B', gtp: 'E4' },
      before: { topMoves: [{ move: 'E4', pv: ['E4', 'D4'] }, { move: 'G7', pv: ['G7', 'D4'] }] } } })
  assert.equal(evidence.moveEffects.koConnection.kind, 'ko-connection')
  assert.equal(evidence.moveEffects.koConnection.connectedSingleton, 'D4')
  assert.deepEqual(evidence.moveEffects.actual.capturedStones, [])
  assert.deepEqual(evidence.candidateMoveEffects.map(entry => entry.move), ['G7'])
  assert.equal(evidence.candidateMoveEffects[0].effects.actual.move, 'G7')
  assert.equal(evidence.candidateMoveEffects[0].effects.koConnection, undefined)
  assert.deepEqual(boardSnapshot, before)
  assert.deepEqual(evidence.boardCoordinates.stonesByColor, evidence.boardGroups.positionFacts.stonesByColor)
  assert.ok(JSON.stringify(evidence).indexOf('"boardCoordinates"') < JSON.stringify(evidence).indexOf('"moveEffects"'))
})

test('complete coordinate facts remain readable before the normal tool truncation budget', () => {
  const columns = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
  const boardSnapshot = Array.from({ length: 360 }, (_, i) => ({
    point: `${columns[i % 19]}${Math.floor(i / 19) + 1}`, color: i % 2 ? 'W' : 'B'
  }))
  const evidence = buildMoveConceptEvidence({ moveNumber: 300, boardSize: 19, playerColor: 'W', playedMove: 'T19', boardSnapshot })
  const transport = JSON.stringify({ moveConceptEvidence: evidence }, null, 2)
  const end = transport.indexOf(',\n    "globalPriority"')
  assert.ok(end > 0 && end < 18000)
  const received = JSON.parse(`${transport.slice(0, end)}\n  }\n}`)
  assert.deepEqual(received.moveConceptEvidence.boardCoordinates.stonesByColor,
    evidence.boardGroups.positionFacts.stonesByColor)
  assert.equal(received.moveConceptEvidence.boardCoordinates.stonesByColor.B.length +
    received.moveConceptEvidence.boardCoordinates.stonesByColor.W.length, 360)
})

test('analysis from a different move or board size cannot provide candidate evidence', () => {
  for (const stale of [{ ...analysis, moveNumber: 9 }, { ...analysis, boardSize: 9 }]) {
    const evidence = buildMoveConceptEvidence({ moveNumber: 10, boardSize: 19, boardSnapshot: snapshot, playedMove: 'F4', playerColor: 'B', analysis: stale })
    assert.deepEqual(evidence.entries.map((entry) => entry.role), ['played'])
  }
})

test('unavailable or occupied pre-move board cannot become a confident term', () => {
  for (const boardSnapshot of [undefined, [...snapshot, { color: 'B', point: 'F4' }]]) {
    const evidence = buildMoveConceptEvidence({ moveNumber: 10, boardSize: 19, boardSnapshot, playedMove: 'F4', playerColor: 'B' })
    assert.equal(evidence.entries[0].concepts.status, 'abstained')
  }
})

test('concept tools carry actual prior moves into corner context without treating PV as history', () => {
  const boardSnapshot = [{ color: 'W', point: 'D4' }, { color: 'B', point: 'F3' }, { color: 'W', point: 'H3' }]
  const moveHistory = [{ color: 'B', point: 'F3' }, { color: 'W', point: 'H3' }]
  const evidence = buildMoveConceptEvidence({ moveNumber: 41, boardSize: 19, boardSnapshot,
    playedMove: 'C3', playerColor: 'B', moveHistory })
  assert.match(evidence.prompt, /三三/)
  assert.match(evidence.prompt, /F3/)
  assert.match(evidence.prompt, /H3/)
  assert.doesNotMatch(evidence.prompt, /已经活棋|一定能活/)
})

test('pass, missing or invalid coordinates do not imply a distant global mistake', () => {
  for (const playedMove of ['pass', undefined, 'I4', 'T99']) {
    const features = extractKataGoShapeFeatures({ boardSize: 19, moveNumber: 90, totalMoves: 200, playedMove, candidateMoves: ['Q16'], lossScore: 8 })
    assert.equal(features.some((feature) => feature.shapeType === 'local_vs_global_shape'), false)
  }
})

test('distance and PV length do not assert a shape cause or reliable reading', () => {
  const features = extractKataGoShapeFeatures({ boardSize: 19, moveNumber: 90, totalMoves: 200, playedMove: 'F4', candidateMoves: ['E4'], lossScore: 4, principalVariation: ['E4', 'F5', 'G5', 'H5', 'J5', 'K5', 'L5', 'M5'] })
  assert.match(features.find((feature) => feature.shapeType === 'local_shape_detail').recognition, /距离和目差本身不能确定原因/)
  assert.match(features.find((feature) => feature.shapeType === 'pv_supported_shape').recognition, /不能证明/)
})

test('teaching evidence carries whole-board facts and regional purpose alongside global comparison', () => {
  const boardSnapshot = [{ color: 'W', point: 'M3' }, { color: 'W', point: 'H7' }, { color: 'B', point: 'O3' }]
  const analysis = { gameId: 'game', moveNumber: 58, boardSize: 19,
    currentMove: { moveNumber: 58, color: 'B', gtp: 'L4' },
    before: { topMoves: [{ move: 'Q16', winrate: 80, scoreLead: 8, visits: 700 }, { move: 'L4', winrate: 55, scoreLead: 1, visits: 200 }] },
    analysisQuality: { totalVisits: 900, confidence: 'high' } }
  const evidence = buildMoveConceptEvidence({ moveNumber: 58, gameId: 'game', boardSize: 19,
    boardSnapshot, playedMove: 'L4', playerColor: 'B', analysis })
  assert.equal(evidence.globalPriority.narrativePriority, 'global-priority')
  assert.deepEqual(evidence.boardGroups.positionFacts.stonesByColor, { B: ['O3'], W: ['M3', 'H7'] })
  assert.ok(evidence.boardGroups.regionIntents.some(intent => intent.kind === 'separate-contact' && intent.status === 'hypothesis'))
  assert.match(evidence.boardGroups.prompt, /分割/)
  assert.equal(evidence.boardGroups.positionFacts.stonesByColor.B.includes('Q16'), false)
  assert.equal(evidence.entries[0].move, 'L4')
})

test('global evidence rejects another game or trial while retaining actual board facts', () => {
  const current = { gameId: 'other', moveNumber: 10, boardSize: 19,
    currentMove: { moveNumber: 10, color: 'B', gtp: 'F4' }, before: { topMoves: [] } }
  for (const analysis of [current, { ...current, gameId: 'game', trialContext: { active: true, branchHash: 'other' } }]) {
    const result = buildMoveConceptEvidence({ gameId: 'game', moveNumber: 10, boardSize: 19,
      playedMove: 'F4', playerColor: 'B', boardSnapshot: snapshot, analysis })
    assert.equal(result.globalPriority.status, 'unavailable')
    assert.deepEqual(result.boardGroups.positionFacts.stonesByColor.B, ['D4'])
  }
})
test('rejected game, branch, move identity and color cannot leak AI candidate concepts or effects', () => {
  const current = { gameId: 'game', moveNumber: 10, boardSize: 19,
    currentMove: { moveNumber: 10, color: 'B', gtp: 'F4' },
    before: { topMoves: [{ move: 'E6', visits: 100, winrate: 70, scoreLead: 2 }] } }
  for (const stale of [
    { ...current, gameId: 'other' },
    { ...current, trialContext: { active: true, branchHash: 'other' } },
    { ...current, currentMove: { ...current.currentMove, moveNumber: 9 } },
    { ...current, currentMove: { ...current.currentMove, color: 'W' } },
    { ...current, currentMove: { ...current.currentMove, gtp: 'Q16' } }
  ]) {
    const result = buildMoveConceptEvidence({ gameId: 'game', moveNumber: 10, boardSize: 19,
      playedMove: 'F4', playerColor: 'B', boardSnapshot: snapshot, analysis: stale })
    assert.equal(result.globalPriority.status, 'unavailable')
    assert.deepEqual(result.entries.map(entry => entry.role), ['played'])
    assert.deepEqual(result.candidateMoveEffects, [])
    assert.deepEqual(result.candidateOwnDevelopment, [])
    assert.equal(result.moveEffects.actual.move, 'F4')
  }
  const main = buildMoveConceptEvidence({ gameId: 'game', trialBranchHash: 'active', moveNumber: 10, boardSize: 19,
    playedMove: 'F4', playerColor: 'B', boardSnapshot: snapshot, analysis: current })
  assert.deepEqual(main.candidateMoveEffects, [])
  const matching = buildMoveConceptEvidence({ gameId: 'game', trialBranchHash: 'active', moveNumber: 10, boardSize: 19,
    playedMove: 'F4', playerColor: 'B', boardSnapshot: snapshot,
    analysis: { ...current, trialContext: { active: true, branchHash: 'active' } } })
  assert.deepEqual(matching.candidateMoveEffects.map(entry => entry.move), ['E6'])
})
test('compact root candidate development survives pretty JSON budget before verbose effects and graph', () => {
  const boardSnapshot=[
    ...['D16','D4','Q5','R3','R4'].map(point=>({point,color:'W'})),
    ...['O4','Q16','Q3','Q9','R2','S2'].map(point=>({point,color:'B'}))
  ]
  const evidence=buildMoveConceptEvidence({moveNumber:12,boardSize:19,playedMove:'O6',playerColor:'W',boardSnapshot,
    analysis:{moveNumber:12,boardSize:19,currentMove:{color:'W',gtp:'O6'},before:{topMoves:[
      {move:'R8',pv:['R8','R9','Q8','P9']},{move:'Q7',pv:['Q7','S9','O7']},{move:'M3',pv:['M3','N3','R8']}
    ]}}})
  const compact=evidence.candidateOwnDevelopment
  const extension=compact.find(c=>c.move==='R8' && c.kind==='side-extension')
  assert.ok(extension)
  assert.equal(extension.anchor,'R4')
  assert.equal(extension.status,'hypothesis')
  assert.deepEqual(extension.groupStones,['R3','R4'])
  assert.equal(extension.direction,'along-side')
  assert.deepEqual(extension.corridor,['R5','R6','R7'])
  assert.ok(extension.counterEvidence.some(e=>e.includes('Q9')))
  for (const entry of evidence.entries.filter(e=>e.role==='candidate')) {
    const projected=compact.filter(c=>c.move===entry.move)
    assert.ok(projected.length<=2)
    assert.deepEqual(projected,entry.concepts.ownDevelopment.slice(0,2).map(c=>({
      move:entry.move,color:entry.color,kind:c.kind,status:c.status,anchor:c.anchor,groupStones:c.groupStones,
      direction:c.direction,corridor:c.corridor,pressurePoints:c.pressurePoints,counterEvidence:c.counterEvidence
    })))
  }
  assert.ok(compact.every(c=>!('wording' in c) && !('evidence' in c)))
  assert.ok(!compact.some(c=>c.move==='O6' || c.move==='R9' || c.move==='Q8'), 'played and PV moves are excluded')
  const transport=JSON.stringify({moveConceptEvidence:evidence},null,2)
  assert.ok(transport.indexOf('"globalPriority":')<transport.indexOf('"candidateOwnDevelopment":'))
  assert.ok(transport.indexOf('"candidateOwnDevelopment":')<transport.indexOf('"moveEffects":'))
  // Parse a complete transport prefix, not a substring that might cut a hypothesis in half.
  const end=transport.indexOf(',\n    "moveEffects":')
  assert.ok(end>0 && end<18000)
  const received=JSON.parse(`${transport.slice(0,end)}\n  }\n}`)
  assert.deepEqual(received.moveConceptEvidence.candidateOwnDevelopment,compact)
})
test('missing, stale and unknown candidate development stays empty without inventing labels', () => {
  const inputs=[
    {boardSnapshot:undefined,analysis},
    {boardSnapshot:snapshot,analysis:{...analysis,moveNumber:11}},
    {boardSnapshot:snapshot,analysis:{...analysis,boardSize:9}},
    {boardSnapshot:snapshot,analysis:{...analysis,before:{topMoves:[{move:'pass',pv:['pass','G4']},{move:'Q16',pv:['Q16','G4']}]}}},
    {boardSnapshot:snapshot}
  ]
  for (const input of inputs) {
    const result=buildMoveConceptEvidence({moveNumber:10,boardSize:19,playedMove:'F4',playerColor:'B',...input})
    assert.deepEqual(result.candidateOwnDevelopment,[])
  }
})
