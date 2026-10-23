import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBoardGroupRelations } from '../src/main/services/teacher/boardGroupRelations.ts'

const stones = (color, points) => points.map((point) => ({ point, color }))
const head = () => ({ boardSize: 19, playerColor: 'B', playedMove: 'G9', boardSnapshot: [
  ...stones('W', ['F3', 'F5', 'F7']), ...stones('B', ['D10', 'H7', 'H5'])
] })
const separate = () => ({ boardSize: 19, playerColor: 'B', playedMove: 'L4', boardSnapshot: [
  ...stones('W', ['M3', 'H7']), ...stones('B', ['O3'])
] })
const intents = (input, kind) => buildBoardGroupRelations(input).regionIntents.filter((x) => x.kind === kind)
const columns = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
const rotate = (point) => { const x = columns.indexOf(point[0]); const y = Number(point.slice(1)) - 1; return `${columns[18 - y]}${x + 1}` }

test('full coordinate facts retain independent strings and only potential jump links', () => {
  const result = buildBoardGroupRelations(head())
  assert.equal(result.status, 'observed')
  assert.deepEqual(result.positionFacts.stonesByColor.W, ['F3', 'F5', 'F7'])
  assert.equal(result.positionFacts.connectedGroups.filter((g) => g.color === 'W').length, 3)
  const links = result.positionFacts.potentialLinks.filter((l) => l.color === 'W')
  assert.equal(links.length, 2)
  assert.ok(links.every((l) => l.status === 'potential-not-connected'))
  assert.deepEqual(links.map((l) => l.emptyPath), [['F4'], ['F6']])
  const candidate = result.regionIntents.find((i) => i.kind === 'contest-head')
  assert.deepEqual(candidate.targetStones, ['F3', 'F5', 'F7'])
  assert.equal(candidate.status, 'hypothesis')
  assert.match(result.prompt, /不证明分割、封锁已经成功/)
})

test('real connected group collects its whole string and empty neighbors', () => {
  const result = buildBoardGroupRelations({ ...head(), boardSnapshot: [...stones('W', ['F3', 'F4', 'F5']), ...stones('B', ['D10', 'H7'])] })
  const group = result.positionFacts.connectedGroups.find((g) => g.color === 'W')
  assert.deepEqual(group.stones, ['F3', 'F4', 'F5'])
  assert.ok(group.emptyAdjacentPoints.includes('E4'))
  assert.ok(!group.emptyAdjacentPoints.includes('F4'))
  assert.deepEqual(group.bounds, { minX: 5, maxX: 5, minY: 2, maxY: 4 })
})

test('head intention rotates and changes color without naming the actual player incorrectly', () => {
  const input = head()
  for (let i = 0; i < 4; i++) {
    assert.equal(intents(input, 'contest-head').length, 1)
    input.playedMove = rotate(input.playedMove)
    input.boardSnapshot = input.boardSnapshot.map((s) => ({ point: rotate(s.point), color: s.color }))
  }
  const white = { ...head(), playerColor: 'W', boardSnapshot: head().boardSnapshot.map((s) => ({ ...s, color: s.color === 'W' ? 'B' : 'W' })) }
  assert.equal(intents(white, 'contest-head').length, 1)
  assert.match(buildBoardGroupRelations(white).prompt, /实际W落点=G9/)
})

test('blocked approaches and missing flank support do not claim a head intention', () => {
  assert.equal(intents({ ...head(), boardSnapshot: [...head().boardSnapshot, ...stones('B', ['F8', 'G7'])] }, 'contest-head').length, 0)
  assert.equal(intents({ ...head(), boardSnapshot: head().boardSnapshot.filter((s) => s.point !== 'D10') }, 'contest-head').length, 0)
  assert.equal(intents({ ...head(), boardSnapshot: head().boardSnapshot.filter((s) => s.color === 'W') }, 'contest-head').length, 0)
})

test('regional separation is directional, supported and explicitly hypothetical', () => {
  const input = separate()
  const candidate = intents(input, 'separate-contact')[0]
  assert.ok(candidate)
  assert.equal(candidate.status, 'hypothesis')
  assert.deepEqual(new Set(candidate.targetStones), new Set(['M3', 'H7']))
  assert.ok(candidate.friendlySupport.includes('O3'))
  assert.match(candidate.limitations.join(' '), /其它方向联络/)
  assert.equal(intents({ ...input, playedMove: 'L2' }, 'separate-contact').length, 0)
  assert.equal(intents({ ...input, boardSnapshot: input.boardSnapshot.filter((s) => s.color === 'W') }, 'separate-contact').length, 0)
  const rotated = { ...input, playedMove: rotate(input.playedMove), boardSnapshot: input.boardSnapshot.map((s) => ({ ...s, point: rotate(s.point) })) }
  assert.equal(intents(rotated, 'separate-contact').length, 1)
  const sameRegion = { ...input, boardSnapshot: [...input.boardSnapshot, ...stones('W', ['F9', 'F10'])] }
  assert.equal(intents(sameRegion, 'separate-contact').length, 1, 'same near string and regional direction are not repeated as multiple intentions')
})

test('an occupied jump corridor does not become a potential link', () => {
  const result = buildBoardGroupRelations({ boardSize: 19, playerColor: 'B', playedMove: 'Q10', boardSnapshot: [...stones('W', ['F3', 'F5']), ...stones('B', ['F4'])] })
  assert.equal(result.positionFacts.potentialLinks.length, 0)
  assert.equal(result.positionFacts.connectedGroups.length, 3)
})

test('weak knights and two-space jumps remain context without spanning target regions', () => {
  const input = { ...head(), boardSnapshot: [...head().boardSnapshot, ...stones('W', ['H2', 'K2', 'N2', 'Q2', 'T2'])] }
  const result = buildBoardGroupRelations(input)
  assert.ok(result.positionFacts.potentialLinks.some((l) => l.endpoints.includes('H2') && l.endpoints.includes('K2')))
  assert.ok(result.positionFacts.potentialLinks.some((l) => l.endpoints.includes('F3') && l.endpoints.includes('H2')))
  const target = result.regionIntents.find((i) => i.kind === 'contest-head')
  assert.ok(target)
  assert.deepEqual(target.targetStones, ['F3', 'F5', 'F7'])
  assert.ok(!target.targetStones.includes('T2'))
  assert.ok(result.positionFacts.stonesByColor.W.includes('T2'), 'full facts still include remote weakly related stones')
})

test('strong regional links are locally bounded while complete real strings are preserved', () => {
  const input = { boardSize: 19, playerColor: 'B', playedMove: 'E13', boardSnapshot: [
    ...stones('W', ['C3', 'C5', 'C7', 'C9', 'C11', 'C13', 'C15']), ...stones('B', ['E10', 'E16'])
  ] }
  const result = buildBoardGroupRelations(input)
  const target = result.regionIntents.find((i) => i.kind === 'contest-head')
  assert.ok(target)
  assert.ok(!target.targetStones.includes('C3') && !target.targetStones.includes('C5'))
  assert.ok(target.targetStones.includes('C13'))
  assert.ok(result.positionFacts.stonesByColor.W.includes('C3'))
  assert.ok(result.positionFacts.potentialLinks.some((l) => l.endpoints.includes('C3') && l.endpoints.includes('C5')))
})

test('review positions retain G9 head and L4 regional-separation hypotheses on their full boards', () => {
  const position19 = { boardSize: 19, playerColor: 'B', playedMove: 'G9', boardSnapshot: [
    ...stones('B', ['C3', 'H3', 'D4', 'H5', 'D6', 'H7', 'D10', 'D16', 'Q16']),
    ...stones('W', ['D2', 'F3', 'K3', 'N4', 'Q4', 'F5', 'F7'])
  ] }
  const region = intents(position19, 'contest-head')[0]
  assert.deepEqual(region.targetStones, ['F3', 'F5', 'F7'])
  assert.ok(region.friendlySupport.includes('D10') && region.friendlySupport.includes('H7'))
  assert.ok(buildBoardGroupRelations(position19).positionFacts.stonesByColor.W.includes('D2'))
  const position20 = { boardSize: 19, playerColor: 'B', playedMove: 'L4', boardSnapshot: [
    ...stones('B', ['O3', 'D4', 'B6', 'C6', 'D6', 'D7', 'C8', 'C9', 'H9', 'K9', 'G10', 'G11', 'E12', 'F12', 'B14', 'D14', 'E14', 'F14', 'B15', 'D15', 'K15', 'B16', 'C16', 'O16', 'Q16', 'R16', 'B17', 'K17', 'Q17', 'B18']),
    ...stones('W', ['M3', 'Q4', 'B7', 'C7', 'E7', 'H7', 'D8', 'E8', 'F9', 'C10', 'D10', 'F10', 'J11', 'C12', 'C13', 'G13', 'C14', 'G14', 'R14', 'C15', 'F15', 'D16', 'E16', 'S16', 'C17', 'D17', 'H17', 'R17', 'S17'])
  ] }
  const separation = intents(position20, 'separate-contact')
  assert.equal(separation.length, 1)
  assert.deepEqual(new Set(separation[0].targetStones), new Set(['M3', 'H7']))
  assert.ok(separation[0].friendlySupport.includes('O3'))
})

test('missing, conflicting, occupied, pass and malformed boards abstain', () => {
  for (const change of [
    { boardSnapshot: undefined }, { boardSize: 0 }, { playerColor: 'X' }, { playedMove: 'pass' }, { playedMove: 'I4' },
    { playedMove: 'F3' }, { boardSnapshot: [{ point: 'Z99', color: 'B' }] },
    { boardSnapshot: [...head().boardSnapshot, { point: 'f3', color: 'B' }] }
  ]) {
    const result = buildBoardGroupRelations({ ...head(), ...change })
    assert.equal(result.status, 'abstained')
    assert.deepEqual(result.regionIntents, [])
  }
})

test('dense boards preserve every structured coordinate while limiting the prompt budget', () => {
  const boardSnapshot = Array.from({ length: 360 }, (_, i) => ({ point: `${columns[i % 19]}${Math.floor(i / 19) + 1}`, color: i % 2 ? 'W' : 'B' }))
  const result = buildBoardGroupRelations({ boardSize: 19, boardSnapshot, playerColor: 'W', playedMove: 'T19' })
  assert.equal(result.positionFacts.stonesByColor.B.length + result.positionFacts.stonesByColor.W.length, 360)
  assert.ok(result.prompt.length <= 6000)
  assert.ok(result.regionIntents.length <= 3)
  const serialized = JSON.stringify(result)
  const prefix = serialized.slice(0, 18000)
  assert.ok(prefix.includes('"regionIntents":') && prefix.includes('"prompt":'))
  assert.ok(prefix.includes(`"stonesByColor":${JSON.stringify(result.positionFacts.stonesByColor)}`), 'the complete coordinate list precedes verbose graph data')
  assert.ok(serialized.indexOf('"regionIntents":') < serialized.indexOf('"positionFacts":'))
  assert.ok(serialized.indexOf('"stonesByColor":') < serialized.indexOf('"connectedGroups":'))
  assert.match(result.prompt, /不能把收到的图当作穷尽/)
})
test('own-development evidence is serialized before enemy hypotheses and verbose graph', () => {
  const input={boardSize:19,playerColor:'W',playedMove:'S7',boardSnapshot:[...stones('W',['J3','O5','P2','P4','Q4','R5','S5']),...stones('B',['L4','M6','N3','Q5','Q6','R3','R4','R6'])]}
  const result=buildBoardGroupRelations(input)
  const candidate=result.ownDevelopment.find(d=>d.kind==='own-development')
  assert.equal(candidate.anchor,'S5')
  assert.deepEqual(candidate.groupStones,['R5','S5'])
  assert.deepEqual(candidate.corridor,['S6'])
  assert.ok(candidate.contactPressurePoints.includes('R6'))
  const json=JSON.stringify(result)
  assert.ok(json.indexOf('"ownDevelopment":')<json.indexOf('"regionIntents":'))
  assert.ok(json.indexOf('"ownDevelopment":')<json.indexOf('"positionFacts":'))
  assert.match(result.prompt,/自身发展\[own-development\/hypothesis\]/)
  assert.match(result.prompt,/没有评估棋块死活/)
  const normal=buildBoardGroupRelations({boardSize:19,playerColor:'W',playedMove:'O6',boardSnapshot:[...stones('W',['D16','D4','Q5','R3','R4']),...stones('B',['O4','Q16','Q3','Q9','R2','S2'])]})
  assert.equal(normal.ownDevelopment[0].anchor,'Q5')
  assert.ok(normal.regionIntents.some(i=>i.kind==='separate-contact'),'competing enemy hypothesis remains inspectable')
  assert.ok(normal.prompt.indexOf('自身发展[')<normal.prompt.indexOf('区域意图['))
})
