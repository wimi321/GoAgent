import assert from 'node:assert/strict'
import { test } from 'node:test'

const { recognizeMoveConcepts, formatMoveConceptsForPrompt } = await (await import('../scripts/lib/concept_modules.mjs')).loadConceptModule('src/main/services/knowledge/moveConcepts.ts')
const b = (point) => ({ point, color: 'B' })
const w = (point) => ({ point, color: 'W' })
const run = (boardSnapshot, playedMove, extra = {}) => recognizeMoveConcepts({ boardSize: 19, boardSnapshot, playedMove, playerColor: 'B', ...extra })

test('actual geometry recognizes jump, diagonal and knight relations in every orientation', () => {
  const columns = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
  for (const [dx, dy, kind] of [[0, 2, 'one-space-jump'], [0, 3, 'two-space-jump'], [0, 4, 'three-space-jump'], [1, 1, 'diagonal'], [1, 2, 'small-knight'], [1, 3, 'large-knight']]) {
    for (const swap of [false, true]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = 9 + sx * (swap ? dy : dx); const y = 9 + sy * (swap ? dx : dy)
      const result = run([b('K10')], `${columns[x]}${y + 1}`)
      assert.equal(result.geometry.length, 1)
      assert.equal(result.geometry[0].kind, kind)
      assert.equal(result.geometry[0].status, 'observed')
    }
  }
})

test('multiple friendly anchors remain ambiguous even when nearest anchor is unique', () => {
  const result = run([b('D4'), b('E5')], 'F4')
  assert.equal(result.status, 'ambiguous')
  assert.deepEqual(result.geometry.map((g) => [g.anchor, g.kind]), [['D4', 'one-space-jump'], ['E5', 'diagonal']])
  assert.match(result.wording, /多个己棋/)
  assert.equal(result.intents.length, 0)
})

test('a stone between jump endpoints blocks the named relation', () => {
  for (const blocker of [w('E4'), b('E4')]) {
    const result = run([b('D4'), blocker], 'F4')
    const relation = result.geometry.find((g) => g.anchor === 'D4')
    assert.equal(relation.status, 'blocked')
    assert.deepEqual(relation.blockers, ['E4'])
    assert.match(relation.wording, /不能按完整/)
  }
})

test('jump on an open side yields only a qualified extension hypothesis', () => {
  const result = run([b('D4')], 'G4')
  assert.equal(result.geometry[0].kind, 'two-space-jump')
  assert.equal(result.intents[0].kind, 'side-extension')
  assert.equal(result.intents[0].status, 'hypothesis')
  assert.match(result.intents[0].wording, /不能仅凭间隔确定是拆/)
  assert.ok(result.intents[0].counterEvidence.length)
  assert.equal(run([b('D10')], 'G10').intents.length, 0)
  assert.equal(run([b('D4'), w('G6')], 'G4').intents.length, 0)
  assert.equal(run([b('D4')], 'F4', { boardSize: 9 }).intents.length, 0)
  assert.equal(run([b('A4')], 'D4').intents.length, 0)
})

test('enemy proximity and low liberties never independently become attack, press or escape', () => {
  const result = run([b('D4'), w('C4'), w('D3'), w('E4')], 'D5')
  assert.equal(result.geometry[0].kind, 'connected')
  assert.equal(result.intents.length, 0)
  assert.match(result.limitations.join(' '), /气数.*不能单独证明/)
  const contact = run([w('D4')], 'D5')
  assert.equal(contact.relations[0].kind, 'enemy-contact')
  assert.equal(contact.intents.length, 0)
})

test('external unsettled assessments produce explicitly provisional intentions with provenance', () => {
  const assessment = { stones: ['K4'], color: 'W', status: 'unsettled', source: 'reviewed-variation', evidence: ['应对变化尚未确认两眼'] }
  const result = run([w('K4')], 'K5', { groupAssessments: [assessment] })
  assert.deepEqual(result.intents.map((i) => i.kind), ['attack', 'press'])
  for (const intent of result.intents) {
    assert.equal(intent.status, 'hypothesis')
    assert.match(intent.evidence.join(' '), /reviewed-variation/)
    assert.ok(intent.counterEvidence.length)
  }
  assert.equal(run([w('K4')], 'K5', { groupAssessments: [{ ...assessment, source: '' }] }).intents.length, 0)
  assert.equal(run([w('K4')], 'K5', { groupAssessments: [{ ...assessment, status: 'settled' }] }).intents.length, 0)
  assert.equal(run([w('K4')], 'K5', { groupAssessments: [{ ...assessment, stones: ['E4'] }] }).intents.length, 0)
  const escape = run([b('K4')], 'K6', { groupAssessments: [{ ...assessment, color: 'B' }] })
  assert.deepEqual(escape.intents.map((i) => i.kind), ['escape'])
})

test('ownership indexing uses top row first and explicit perspective without classifying life or intent', () => {
  const ownership = Array(361).fill(0)
  ownership[(19 - 4) * 19 + 3] = 0.81
  for (const ownershipPerspective of ['black', 'white']) {
    const result = run([w('D3')], 'D4', { engineFeatures: { ownership, ownershipPerspective, source: 'KataGo' } })
    const feature = result.relations.find((r) => r.kind === 'ownership-at-move')
    assert.equal(feature.value, 0.81)
    assert.match(feature.evidence, new RegExp(ownershipPerspective))
    assert.equal(result.intents.length, 0)
  }
  assert.ok(run([], 'D4', { engineFeatures: { ownership } }).limitations.some((s) => s.includes('已忽略')))
  assert.equal(run([], 'D4', { engineFeatures: { ownership: [1], ownershipPerspective: 'white' } }).relations.length, 0)
})

test('missing, stale, invalid, duplicate boards and pass fail closed', () => {
  assert.equal(run(undefined, 'D4').status, 'abstained')
  assert.equal(run([b('D4')], 'D4').status, 'abstained')
  assert.equal(run([b('I4')], 'D4').status, 'abstained')
  assert.equal(run([b('D4'), w('D4')], 'F4').status, 'abstained')
  assert.equal(run([], 'pass').status, 'abstained')
  assert.equal(run([], 'T20').status, 'abstained')
  assert.equal(run([], 'D4', { boardSize: 1 }).status, 'abstained')
})

test('unrelated distant friendly stones do not manufacture a named relation', () => {
  const result = run([b('D4')], 'Q16')
  assert.equal(result.status, 'abstained')
  assert.equal(result.geometry.length, 0)
  assert.equal(result.intents.length, 0)
})

test('formatter retains all competing anchors, blockers, provisional intentions and limitations', () => {
  const ambiguous = formatMoveConceptsForPrompt(run([b('D4'), b('E5')], 'F4'))
  assert.match(ambiguous, /锚点=D4/)
  assert.match(ambiguous, /锚点=E5/)
  assert.match(ambiguous, /ambiguous/)
  const provisional = formatMoveConceptsForPrompt(run([b('D4')], 'G4'))
  assert.match(provisional, /side-extension\/hypothesis/)
  assert.match(provisional, /反证\/未验证：尚未确认/)
  assert.match(provisional, /限制：/)
  const blocked = run([b('D4'), b('E4')], 'F4')
  assert.match(blocked.wording, /相邻连接/)
  assert.match(formatMoveConceptsForPrompt(blocked), /阻挡=E4/)
})

// Derived semantic fixtures from the six human-reviewed examples. These are development
// regressions, not an independent sample or an estimate of semantic accuracy.
const reviewedRelations = [
  { id: '004:30', color: 'W', move: 'P12', board: [w('P10'), w('Q10'), w('R10'), b('R12'), b('Q14')], kind: 'cap', target: 'R12', empty: ['Q12'] },
  { id: '018:11', color: 'B', move: 'R5', board: [b('Q3'), b('R9'), w('Q5')], kind: 'attachment-under', target: 'Q5', empty: [] },
  { id: '022:16', color: 'W', move: 'F4', board: [w('D4'), b('F3')], kind: 'contact-press', target: 'F3', empty: ['E4'] },
  { id: '023:2', color: 'B', move: 'E3', board: [b('D4'), b('Q4'), b('D16'), b('Q16'), w('F3')], kind: 'diagonal-contact', target: 'F3', empty: [] },
  { id: '033:41', color: 'B', move: 'C3', board: [w('D4'), b('F3'), w('H3')], kind: 'corner-entry', target: 'D4', empty: [], history: [b('F3'), w('H3')] },
  { id: '047:8', color: 'W', move: 'O16', board: [w('Q17'), b('Q15')], kind: 'knight-pressure', target: 'Q15', empty: ['Q16', 'P16'] }
]
const relationColumns = 'ABCDEFGHJKLMNOPQRST'
function transformPoint(point, rotation, reflection) {
  if (point.toLowerCase() === 'pass') return point
  let x = relationColumns.indexOf(point[0]); let y = Number(point.slice(1)) - 1
  if (reflection) x = 18 - x
  for (let i = 0; i < rotation; i++) [x, y] = [18 - y, x]
  return `${relationColumns[x]}${y + 1}`
}

test('reviewed relationship candidates survive rotations, reflections and color swaps', () => {
  for (const fixture of reviewedRelations) for (const rotation of [0, 1, 2, 3]) for (const reflection of [false, true]) for (const swapColor of [false, true]) {
    const point = (p) => transformPoint(p, rotation, reflection)
    const color = (c) => swapColor ? (c === 'B' ? 'W' : 'B') : c
    const stone = (s) => ({ point: point(s.point), color: color(s.color) })
    const result = run(fixture.board.map(stone), point(fixture.move), { playerColor: color(fixture.color), moveHistory: fixture.history?.map(stone) })
    const candidate = result.relationCandidates.find((r) => r.kind === fixture.kind && r.enemyAnchor === point(fixture.target))
    assert.ok(candidate, `${fixture.id}, rotation=${rotation}, reflection=${reflection}, colors=${swapColor}`)
    assert.equal(candidate.status, 'candidate')
    assert.equal(candidate.geometryStatus, 'observed')
    assert.equal(candidate.purposeHypothesis.status, 'hypothesis')
    assert.ok(candidate.evidence.length && candidate.counterEvidence.length)
    assert.deepEqual(candidate.emptyPoints.sort(), fixture.empty.map(point).sort())
    assert.ok(candidate.supportingFriendPoints.every((p) => fixture.board.map(stone).some((s) => s.point === p && s.color === color(fixture.color))))
    assert.ok(result.wording.startsWith(result.relationCandidates[0].wording))
    assert.equal(result.intents.length, 0)
    if (fixture.history) assert.match(candidate.wording, /被夹后点三三/)
    if (fixture.kind === 'cap' || fixture.kind === 'attachment-under') assert.equal(result.status, 'ambiguous')
  }
})

test('supported enemy candidate remains available alongside all friendly geometry', () => {
  const result = run([w('P10'), w('Q10'), b('R12')], 'P12', { playerColor: 'W' })
  assert.equal(result.status, 'ambiguous')
  assert.equal(result.geometry.length, 2)
  assert.match(result.wording, /敌棋R12.*镇/)
  const prompt = formatMoveConceptsForPrompt(result)
  assert.match(prompt, /比较自身发展与对敌关系/)
  assert.match(prompt, /术语\[cap\/candidate\] 敌棋=R12/)
  assert.match(prompt, /目的\[hypothesis\]/)
  assert.match(prompt, /锚点=P10/)
  assert.match(prompt, /锚点=Q10/)
})

test('cap requires an empty straight gap and supported knight requires open local space', () => {
  for (const color of ['B', 'W']) {
    assert.ok(!run([w('P10'), w('Q10'), b('R12'), { point: 'Q12', color }], 'P12', { playerColor: 'W' }).relationCandidates.some((r) => r.kind === 'cap'))
    for (const point of ['P16', 'Q16']) assert.ok(!run([w('Q17'), b('Q15'), { point, color }], 'O16', { playerColor: 'W' }).relationCandidates.some((r) => r.kind === 'knight-pressure'))
  }
})

test('contact direction, missing support and central isolated enemies do not manufacture terms', () => {
  assert.ok(!run([b('Q3'), w('Q5')], 'Q6').relationCandidates.some((r) => r.kind === 'attachment-under'))
  assert.ok(!run([b('Q3'), w('Q5')], 'Q4').relationCandidates.some((r) => r.kind === 'attachment-under' || r.kind === 'contact-press'))
  assert.ok(!run([b('D4'), w('F3')], 'G3').relationCandidates.some((r) => r.kind === 'contact-press'))
  // A diagonal towards E3 cannot label a contact behind it as尖顶.
  assert.ok(!run([b('D4'), w('D3')], 'E3').relationCandidates.some((r) => r.kind === 'diagonal-contact'))
  for (const move of ['K9', 'K11', 'K12']) assert.equal(run([w('K10')], move).relationCandidates.length, 0)
  for (const move of ['R5', 'P5']) assert.equal(run([w('Q5')], move).relationCandidates.length, 0)
  assert.equal(run([b('K10'), w('M9')], 'L9').relationCandidates.length, 0)
})

test('three-three entry needs an enemy star and pincer wording needs matching current history', () => {
  assert.equal(run([b('D4')], 'C3').relationCandidates.length, 0)
  assert.equal(run([], 'C3').relationCandidates.length, 0)
  const board = [w('D4'), b('F3'), w('H3')]
  const noHistory = run(board, 'C3').relationCandidates.find((r) => r.kind === 'corner-entry')
  assert.equal(noHistory.enemyAnchor, 'D4')
  assert.doesNotMatch(noHistory.wording, /被夹后/)
  for (const moveHistory of [[w('H3'), b('F3')], [b('F3'), w('pass')], [w('F3'), b('H3')], [b('F3'), w('J3')]]) {
    assert.doesNotMatch(run(board, 'C3', { moveHistory }).wording, /被夹后/)
  }
  assert.doesNotMatch(run([w('D4'), w('H3')], 'C3', { moveHistory: [b('F3'), w('H3')] }).wording, /被夹后/)
  assert.equal(run([w('D4')], 'C3').status, 'observed')
})

test('reviewed knight target uses actual opponent color and does not assert a successful enclosure', () => {
  const result = run([w('Q17'), b('Q15')], 'O16', { playerColor: 'W' })
  const candidate = result.relationCandidates.find((r) => r.kind === 'knight-pressure')
  assert.equal(candidate.enemyAnchor, 'Q15')
  assert.deepEqual(candidate.supportingFriendPoints, ['Q17'])
  assert.match(candidate.purposeHypothesis.wording, /可能限制敌棋Q15/)
  assert.doesNotMatch(result.wording, /封锁白角|白子.*封锁/)
  assert.equal(run([b('Q15')], 'O16', { playerColor: 'W' }).relationCandidates.length, 0)
})

test('neutral enemy facts survive all board symmetries without manufacturing a relation term', () => {
  for (const rotation of [0, 1, 2, 3]) for (const reflection of [false, true]) for (const swapColor of [false, true]) {
    const point = (p) => transformPoint(p, rotation, reflection)
    const result = run([{ point: point('D4'), color: swapColor ? 'B' : 'W' }], point('F4'), { playerColor: swapColor ? 'W' : 'B' })
    assert.equal(result.status, 'observed')
    assert.equal(result.relationCandidates.length, 0) // Corner tie has no unique inward edge.
    const fact = result.relations.find((r) => r.kind === 'enemy-position')
    assert.deepEqual(fact.points, [point('D4')])
    assert.ok(Math.abs(fact.offset.dx) + Math.abs(fact.offset.dy) === 2)
    assert.match(result.wording, /敌棋.*坐标差/)
  }
  const contact = run([b('K9'), w('L10')], 'K10')
  assert.equal(contact.relationCandidates.length, 0)
  assert.match(contact.wording, /敌棋L10直接相邻/)
  assert.equal(contact.geometry[0].kind, 'connected')
})

function everySymmetry(board, move, playerColor, check) {
  for (const rotation of [0, 1, 2, 3]) for (const reflection of [false, true]) for (const swapColor of [false, true]) {
    const point = (p) => transformPoint(p, rotation, reflection)
    const color = (c) => swapColor ? (c === 'B' ? 'W' : 'B') : c
    check(run(board.map((s) => ({ point: point(s.point), color: color(s.color) })), point(move), { playerColor: color(playerColor) }), point)
  }
}

test('round-two press needs close along-side support; a large knight remains a neutral contact', () => {
  everySymmetry([b('C12'), w('C9')], 'D9', 'B', (result, point) => {
    assert.equal(result.relationCandidates.some((r) => r.kind === 'contact-press'), false)
    assert.match(result.wording, /直接相邻/)
    assert.equal(result.geometry.find((g) => g.anchor === point('C12')).kind, 'large-knight')
  })
  everySymmetry([b('Q16'), w('R14')], 'Q14', 'B', (result, point) => {
    const candidate = result.relationCandidates.find((r) => r.kind === 'contact-press')
    assert.deepEqual(candidate.supportingFriendPoints, [point('Q16')])
    assert.deepEqual(candidate.emptyPoints, [point('Q15')])
  })
  for (const blocker of [b('Q15'), w('Q15')]) {
    const candidate = run([b('Q16'), w('R14'), blocker], 'Q14').relationCandidates.find((r) => r.kind === 'contact-press')
    if (blocker.color === 'W') assert.equal(candidate, undefined)
    else assert.deepEqual(candidate.supportingFriendPoints, ['Q15']) // A friendly intervening stone is a new direct support, not an empty jump.
  }
  assert.equal(run([b('D11'), w('C9')], 'D9').relationCandidates.some((r) => r.kind === 'contact-press'), true)
  assert.equal(run([b('F9'), w('C9')], 'D9').relationCandidates.some((r) => r.kind === 'contact-press'), false) // support points inward, not along side
})

test('small-knight enclosure has a real friendly corner focus and survives every symmetry', () => {
  everySymmetry([w('D17')], 'C15', 'W', (result, point) => {
    const candidate = result.relationCandidates.find((r) => r.kind === 'corner-enclosure')
    assert.ok(candidate)
    assert.equal(candidate.enemyAnchor, undefined)
    assert.equal(candidate.friendlyAnchor, point('D17'))
    assert.match(candidate.wording, /小飞守角/)
    assert.equal(candidate.purposeHypothesis.status, 'hypothesis')
    const prompt = formatMoveConceptsForPrompt(result)
    assert.ok(prompt.includes(`己方角部锚点=${point('D17')}`))
    assert.doesNotMatch(prompt, /敌棋=undefined/)
  })
  assert.equal(run([w('D17')], 'C15').relationCandidates.some((r) => r.kind === 'corner-enclosure'), false)
  assert.equal(run([b('K10')], 'J8').relationCandidates.some((r) => r.kind === 'corner-enclosure'), false)
  for (const point of ['C16', 'E16', 'F14']) assert.equal(run([w('D17'), b(point)], 'C15', { playerColor: 'W' }).relationCandidates.some((r) => r.kind === 'corner-enclosure'), false)
})

test('shoulder probe uses enemy diagonal, inward direction and open support from the other side', () => {
  everySymmetry([b('J4'), b('Q3'), b('Q5'), w('L3')], 'M4', 'B', (result, point) => {
    const candidate = result.relationCandidates.find((r) => r.kind === 'shoulder-probe')
    assert.ok(candidate)
    assert.equal(candidate.enemyAnchor, point('L3'))
    assert.deepEqual(candidate.supportingFriendPoints, [point('J4')])
    assert.deepEqual(candidate.emptyPoints.sort(), [point('K4'), point('L4')].sort())
    assert.ok(candidate.evidence.join(' ').includes(point('Q3')))
    assert.ok(candidate.evidence.join(' ').includes(point('Q5')))
    assert.match(candidate.purposeHypothesis.wording, /可能.*扩张/)
  })
  for (const board of [[w('L3')], [b('P4'), w('L3')], [b('J4'), w('L3'), w('K4')], [b('J4'), w('L3'), b('L4')]]) {
    assert.equal(run(board, 'M4').relationCandidates.some((r) => r.kind === 'shoulder-probe'), false)
  }
  assert.equal(run([b('J2'), w('L3')], 'M2').relationCandidates.some((r) => r.kind === 'shoulder-probe'), false)
  assert.equal(run([b('J10'), w('L9')], 'M10').relationCandidates.some((r) => r.kind === 'shoulder-probe'), false)
})

test('side expansion tolerates enemies behind its anchor but preserves forward pressure and contact', () => {
  everySymmetry([b('L16'), w('O17'), w('D17'), w('C15')], 'H16', 'B', (result, point) => {
    const intent = result.intents.find((i) => i.kind === 'side-extension')
    assert.ok(intent)
    assert.match(intent.wording, /争取区域/)
    assert.ok(intent.counterEvidence.join(' ').includes(point('O17')))
  })
  for (const point of ['K16', 'J15', 'G16', 'L17', 'M16']) {
    assert.equal(run([b('L16'), w(point)], 'H16').intents.some((i) => i.kind === 'side-extension'), false)
  }
})

test('star diagonal contact describes corner restriction and same-side spacing without inventing replies', () => {
  everySymmetry([b('D4'), w('C6'), w('C9'), b('C11')], 'C5', 'B', (result, point) => {
    const candidate = result.relationCandidates.find((r) => r.kind === 'diagonal-contact')
    assert.ok(candidate)
    assert.match(candidate.purposeHypothesis.wording, /可能.*限制挂角子.*向角部发展/)
    assert.ok(candidate.evidence.join(' ').includes(point('C9')))
    assert.ok(candidate.evidence.join(' ').includes(point('C11')))
    assert.match(candidate.purposeHypothesis.wording, /空间可能受限/)
    assert.doesNotMatch(candidate.wording, /经典定式|守角成功/)
  })
  const noSpacing = run([b('D4'), w('C6')], 'C5').relationCandidates.find((r) => r.kind === 'diagonal-contact')
  assert.doesNotMatch(noSpacing.purposeHypothesis.wording, /空间可能受限/)
  const blocked = run([b('D4'), w('C6'), w('C8'), w('C9'), b('C11')], 'C5').relationCandidates.find((r) => r.kind === 'diagonal-contact')
  assert.doesNotMatch(blocked.purposeHypothesis.wording, /空间可能受限/)
})
// Full reviewed boards are development regressions, never runtime purpose labels.
const developmentFixtures = [
  { move: 'O6', anchor: 'Q5', color: 'W', friends: ['D16','D4','Q5','R3','R4'], enemies: ['O4','Q16','Q3','Q9','R2','S2'] },
  { move: 'S7', anchor: 'S5', color: 'W', friends: ['J3','O5','P2','P4','Q4','R5','S5'], enemies: ['L4','M6','N3','Q5','Q6','R3','R4','R6'] }
]
test('own development retains the pressured real string and frontier geometry in every symmetry and color', () => {
  for (const fixture of developmentFixtures) for (const rotation of [0,1,2,3]) for (const reflection of [false,true]) for (const swap of [false,true]) {
    const point = p => transformPoint(p, rotation, reflection)
    const own = swap ? 'B' : 'W'; const enemy = swap ? 'W' : 'B'
    const result = run([...fixture.friends.map(p=>({point:point(p),color:own})),...fixture.enemies.map(p=>({point:point(p),color:enemy}))], point(fixture.move), {playerColor:own})
    const d = result.ownDevelopment.find(d=>d.kind==='own-development' && d.anchor===point(fixture.anchor))
    assert.ok(d, `${fixture.move}: rotation=${rotation}, reflection=${reflection}, swap=${swap}`)
    assert.equal(result.primaryFriendlyGeometry.anchor, point(fixture.anchor))
    assert.equal(d.status, 'hypothesis')
    assert.ok(d.pressurePoints.length >= 2)
    assert.match(d.counterEvidence.join(' '), /没有评估棋块死活/)
    assert.match(result.wording, /自身出头|沿边跳出|向中腹发展/)
    if (fixture.move==='O6') {
      const cap=result.relationCandidates.find(r=>r.kind==='cap')
      assert.ok(cap)
      assert.ok(cap.counterEvidence.some(e=>e.includes('自身发展竞争解释')))
      assert.equal(cap.enemyAnchor, point('O4'))
    } else {
      assert.equal(result.primaryFriendlyGeometry.kind, 'one-space-jump')
      assert.equal(d.direction,'along-side')
      assert.deepEqual(d.corridor,[point('S6')])
      assert.deepEqual(new Set(d.groupStones),new Set(['R5','S5'].map(point)))
      assert.ok(result.geometry.some(g=>g.anchor===point('R5') && g.kind==='small-knight'))
    }
  }
})
test('blocked corridors, distinct friendly strings and reduced pressure cannot select a guaranteed escape', () => {
  const fixture=developmentFixtures[1]
  const board=[...fixture.friends.map(w),...fixture.enemies.map(b)]
  for (const stone of [w('S6'),b('S6')]) {
    const result=run([...board,stone], 'S7', {playerColor:'W'})
    assert.ok(!result.ownDevelopment.some(d=>d.anchor==='S5'))
    assert.ok(!result.primaryFriendlyGeometry || result.primaryFriendlyGeometry.kind!=='one-space-jump')
  }
  // R5 and S5 are no longer one real string when R5 is moved one column away.
  const distinct=run([...board.filter(s=>s.point!=='R5'),w('Q7')], 'S7', {playerColor:'W'})
  assert.equal(distinct.primaryFriendlyGeometry,undefined)
  const reduced=run(fixture.friends.map(w), 'S7', {playerColor:'W'})
  assert.ok(!reduced.ownDevelopment.some(d=>d.kind==='own-development'))
  const inward=run(developmentFixtures[0].friends.map(w), 'O6', {playerColor:'W'})
  assert.equal(inward.ownDevelopment.length,0)
})
test('multi-anchor side extension keeps enemy competition near the terminal point', () => {
  const fixture=developmentFixtures[0]
  const result=run([...fixture.friends.map(w),...fixture.enemies.map(b)], 'R8', {playerColor:'W'})
  const extension=result.ownDevelopment.find(d=>d.kind==='side-extension' && d.anchor==='R4')
  assert.ok(extension)
  assert.deepEqual(extension.corridor,['R5','R6','R7'])
  assert.ok(extension.counterEvidence.some(e=>e.includes('Q9')))
  assert.match(extension.wording,/拆边/)
  assert.equal(result.primaryFriendlyGeometry,undefined, 'independent Q5 and R3/R4 strings remain separate')
  assert.match(formatMoveConceptsForPrompt(result),/自身发展\[side-extension\/hypothesis\]/)
})
