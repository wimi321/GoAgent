import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMoveBoardEffects } from '../src/main/services/teacher/moveBoardEffects.ts'

const stones = (color, points) => points.map((point) => ({ point, color }))
const ko = () => ({ boardSize: 19, playerColor: 'B', playedMove: 'D4', boardSnapshot: [
  ...stones('B', ['C3', 'D3', 'E3', 'C4', 'E4', 'D5']), ...stones('W', ['C5', 'E5', 'D6'])
] })
const columns = 'ABCDEFGHJKLMNOPQRST'
function transform(point, turns, reflect) {
  let x = columns.indexOf(point[0]); let y = Number(point.slice(1)) - 1
  if (reflect) x = 18 - x
  for (let i = 0; i < turns; i++) [x, y] = [18 - y, x]
  return `${columns[x]}${y + 1}`
}

test('connection closes a structurally verified single-stone ko without claiming legal recapture', () => {
  const input = ko(); const before = JSON.stringify(input)
  const result = buildMoveBoardEffects(input)
  assert.equal(result.status, 'observed')
  assert.deepEqual(result.actual.capturedStones, [])
  assert.equal(result.actual.adjacentFriendlyChains.length, 2)
  assert.equal(result.actual.mergedFriendlyChainIds.length, 2)
  assert.equal(result.actual.resultingChain.stoneCount, 7)
  const singleton = result.actual.libertyChanges.find((change) => change.beforeChainId === 'B:D5')
  assert.deepEqual(singleton.before, ['D4'])
  assert.deepEqual(singleton.lost, ['D4'])
  assert.equal(result.koConnection.kind, 'ko-connection')
  assert.equal(result.koConnection.connectedSingleton, 'D5')
  assert.deepEqual(result.koConnection.opponentProbe.capturedStones, ['D5'])
  assert.deepEqual(result.koConnection.opponentProbe.resultingChain.liberties, ['D5'])
  assert.deepEqual(result.koConnection.structuralRecapture.capturedStones, ['D4'])
  assert.equal(result.koConnection.structuralRecapture.restoresBeforeBoard, true)
  assert.equal(result.legality, 'board-only-not-history-verified')
  assert.match(result.prompt, /粘劫/)
  assert.match(result.prompt, /不是立即合法回提/)
  assert.match(result.prompt, /不证明棋块死活/)
  assert.equal(JSON.stringify(input), before)
})

test('ko structure and endpoints survive all rotations, reflection and color reversal', () => {
  for (const reflect of [false, true]) for (let turns = 0; turns < 4; turns++) for (const swap of [false, true]) {
    const input = ko()
    input.playedMove = transform(input.playedMove, turns, reflect)
    input.playerColor = swap ? 'W' : 'B'
    input.boardSnapshot = input.boardSnapshot.map((stone) => ({ point: transform(stone.point, turns, reflect),
      color: swap ? stone.color === 'B' ? 'W' : 'B' : stone.color }))
    const result = buildMoveBoardEffects(input)
    assert.equal(result.koConnection?.connectedSingleton, transform('D5', turns, reflect))
    assert.equal(result.koConnection?.structuralRecapture.color, input.playerColor)
    assert.equal(result.koConnection?.opponentProbe.resultingChain.stoneCount, 1)
  }
})

test('ordinary connection records distinct chain endpoints without inventing ko or weakness', () => {
  const result = buildMoveBoardEffects({ boardSize: 19, playerColor: 'B', playedMove: 'D4',
    boardSnapshot: stones('B', ['C4', 'E4']) })
  assert.equal(result.status, 'observed')
  assert.equal(result.actual.mergedFriendlyChainIds.length, 2)
  assert.deepEqual(result.actual.adjacentFriendlyChains.map((chain) => chain.neighboringStones), [['C4'], ['E4']])
  assert.equal(result.koConnection, undefined)
  assert.match(result.prompt, /不能直接解释为弱龙补强/)
})

test('multiple neighbors from one string are not reported as a connection', () => {
  const result = buildMoveBoardEffects({ boardSize: 19, playerColor: 'B', playedMove: 'D4',
    boardSnapshot: stones('B', ['C4', 'C3', 'D3', 'E3', 'E4']) })
  assert.equal(result.actual.adjacentFriendlyChains.length, 1)
  assert.deepEqual(result.actual.mergedFriendlyChainIds, [])
  assert.equal(result.koConnection, undefined)
})

test('two-stone threatened chain is not classified as single-stone ko', () => {
  const input = ko()
  input.boardSnapshot = [ ...stones('B', ['C3', 'D3', 'E3', 'C4', 'E4', 'D5', 'D6']),
    ...stones('W', ['C5', 'E5', 'C6', 'E6', 'D7']) ]
  const result = buildMoveBoardEffects(input)
  assert.equal(result.status, 'observed')
  assert.equal(result.actual.mergedFriendlyChainIds.length, 2)
  assert.equal(result.koConnection, undefined)
})

test('single capture without an isolated capturing stone / restoration cycle is not ko', () => {
  // White D4 joins C4/C5 and captures D5; Black D5 would capture three white stones (snapback).
  const result = buildMoveBoardEffects({ boardSize: 19, playerColor: 'B', playedMove: 'D4', boardSnapshot: [
    ...stones('B', ['B4', 'B5', 'C3', 'C6', 'D3', 'E4', 'D5']),
    ...stones('W', ['C4', 'C5', 'E5', 'D6'])
  ] })
  assert.equal(result.status, 'observed')
  assert.deepEqual(result.actual.capturedStones, ['C4', 'C5'])
  assert.equal(result.koConnection, undefined)
})

test('a singleton rescue with open neighboring points is not a ko connection', () => {
  const input = ko()
  input.boardSnapshot = input.boardSnapshot.filter((stone) => !['C3', 'D3', 'E3', 'C4', 'E4'].includes(stone.point))
  const result = buildMoveBoardEffects(input)
  assert.equal(result.status, 'observed')
  assert.equal(result.actual.adjacentFriendlyChains.length, 1)
  assert.equal(result.koConnection, undefined)
})

test('capturing one stone with an additional liberty does not create a ko cycle', () => {
  const input = ko()
  input.boardSnapshot = input.boardSnapshot.filter((stone) => stone.point !== 'C4')
  const result = buildMoveBoardEffects(input)
  assert.equal(result.status, 'observed')
  assert.equal(result.actual.mergedFriendlyChainIds.length, 2)
  assert.equal(result.koConnection, undefined)
})

test('actual capture has exact enemy chain / liberty facts', () => {
  const result = buildMoveBoardEffects({ boardSize: 19, playerColor: 'B', playedMove: 'D4', boardSnapshot: [
    ...stones('B', ['C5', 'E5', 'D6']), ...stones('W', ['D5'])
  ] })
  assert.deepEqual(result.actual.capturedStones, ['D5'])
  assert.equal(result.actual.adjacentEnemyChains[0].stoneCount, 1)
  assert.deepEqual(result.actual.adjacentEnemyChains[0].liberties, ['D4'])
  assert.ok(result.actual.resultingChain.liberties.includes('D5'))
})

test('missing, invalid, occupied, conflicting and suicide inputs abstain without false effects', () => {
  const input = ko()
  const invalid = [
    { ...input, boardSnapshot: undefined }, { ...input, boardSize: 1 }, { ...input, playedMove: 'I4' },
    { ...input, playedMove: 'pass' }, { ...input, playerColor: 'X' },
    { ...input, boardSnapshot: [...input.boardSnapshot, { point: 'D4', color: 'W' }] },
    { ...input, boardSnapshot: [...input.boardSnapshot, { point: 'D5', color: 'W' }] },
    { ...input, boardSnapshot: [...input.boardSnapshot, { point: 'A20', color: 'W' }] },
    { ...input, boardSnapshot: stones('W', ['C4', 'E4', 'D3', 'D5']) },
    { ...input, boardSnapshot: [...stones('B', ['A1']), ...stones('W', ['A2', 'B1'])] }
  ]
  for (const value of invalid) {
    const result = buildMoveBoardEffects(value)
    assert.equal(result.status, 'abstained')
    assert.equal(result.actual, undefined)
    assert.equal(result.koConnection, undefined)
  }
})

test('partial move history never promotes structural probing to rule-aware legality', () => {
  const result = buildMoveBoardEffects({ ...ko(), moveHistory: [{ point: 'pass', color: 'B' }, { point: 'D5', color: 'B' }] })
  assert.equal(result.koConnection.kind, 'ko-connection')
  assert.equal(result.legality, 'board-only-not-history-verified')
  assert.match(result.prompt, /未结合完整棋谱和规则/)
})

test('returned chains retain counts and neighboring representatives without duplicating large stone arrays', () => {
  const input = ko()
  input.boardSnapshot.push(...stones('B', ['B3', 'A3', 'A4', 'A5']))
  const result = buildMoveBoardEffects(input)
  assert.ok(result.actual.adjacentFriendlyChains.some((chain) => chain.stoneCount > chain.neighboringStones.length))
  for (const chain of [...result.actual.adjacentFriendlyChains, result.actual.resultingChain]) {
    assert.equal('stones' in chain, false)
    assert.ok(chain.neighboringStones.length <= 4)
  }
})
