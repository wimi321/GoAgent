import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConceptModule } from '../scripts/lib/concept_modules.mjs'

const { buildGlobalPriorityEvidence: build } = await loadConceptModule('src/main/services/teacher/globalPriorityEvidence.ts')
const candidate = (move, winrate, scoreLead, visits = 128) => ({ move, winrate, scoreLead, visits, order: 0, pv: [] })
function input(overrides = {}) {
  return {
    gameId: 'game', moveNumber: 40, boardSize: 19, boardTiming: 'before-move', boardSnapshot: [], playedMove: 'D4', playerColor: 'B',
    analysis: {
      gameId: 'game', moveNumber: 40, boardSize: 19,
      currentMove: { moveNumber: 40, color: 'B', gtp: 'D4', pass: false },
      before: { topMoves: [candidate('Q16', 65, 5), candidate('D4', 52, 0)] },
      after: { winrate: 1, scoreLead: -99, topMoves: [candidate('A1', 99, 99)] },
      analysisQuality: { confidence: 'medium', totalVisits: 256, deepenRecommended: true }
    }, ...overrides
  }
}

test('far better same-position root choice leads the narrative with explicit comparison and uncertainty', () => {
  const evidence = build(input())
  assert.equal(evidence.narrativePriority, 'global-priority')
  assert.equal(evidence.comparison.distance, 12)
  assert.equal(evidence.comparison.scoreGap, 5)
  assert.equal(evidence.comparison.winrateGapPercentagePoints, 13)
  assert.equal(evidence.comparison.source, 'before-root-candidates')
  assert.match(evidence.prompt, /当前前列搜索更倾向远处，先比较 Q16/)
  assert.match(evidence.prompt, /实战点较差不等于整个局部不值得下/)
  assert.match(evidence.prompt, /不能单独证明分断、封锁大龙/)
  assert.match(evidence.prompt, /当前搜索倾向/)
  assert.doesNotMatch(evidence.prompt, /A1|99\.0/)
})

test('nearby recommendation, same move, and far small gap never imply global priority', () => {
  for (const moves of [
    [candidate('E5', 80, 10), candidate('D4', 40, -10)],
    [candidate('D4', 65, 5)],
    [candidate('Q16', 54, 1), candidate('D4', 52, 0)]
  ]) {
    const value = input()
    value.analysis.before.topMoves = moves
    assert.equal(build(value).narrativePriority, 'local-or-undetermined')
  }
})

test('specific played loss remains actionable with a nearby best choice, but weak searches and small gaps abstain', () => {
  const value = input()
  value.analysis.before.topMoves = [candidate('E5', 99.9, 10), candidate('D4', 99.8, 6.5)]
  const result = build(value)
  assert.equal(result.narrativePriority, 'local-or-undetermined')
  assert.equal(result.comparison.significantGap, true)
  assert.equal(result.comparison.reliableSearch, true)
  assert.equal(result.comparison.winrateSaturated, true)
  assert.equal(result.bestLocalAlternative.move, 'E5')
  assert.match(result.prompt, /具体着手评价：按当前搜索，实战 D4 相比首选 E5/)
  for (const mutate of [
    (v) => { v.analysis.before.topMoves[1].scoreLead = 9 },
    (v) => { v.analysis.analysisQuality.confidence = 'low' },
    (v) => { v.analysis.before.topMoves[0].visits = 1 }
  ]) {
    const alternative = structuredClone(value)
    mutate(alternative)
    assert.doesNotMatch(build(alternative).prompt, /具体着手评价/)
  }
})

test('white evaluation reverses black-positive values exactly once and ignores stored player/loss fields', () => {
  const value = input({ playerColor: 'W' })
  value.analysis.currentMove.color = 'W'
  value.analysis.before.topMoves = [candidate('Q16', 35, -5), candidate('D4', 48, 0)]
  value.analysis.playedMove = { move: 'D4', source: 'candidate', playerWinrate: 99, playerScoreLead: 100, winrateLoss: 0, scoreLoss: 0 }
  const result = build(value)
  assert.equal(result.narrativePriority, 'global-priority')
  assert.equal(result.comparison.bestWinrate, 65)
  assert.equal(result.comparison.playedWinrate, 52)
  assert.equal(result.comparison.scoreGap, 5)
  assert.match(result.prompt, /白方视角/)
})

test('missing played candidate never uses after-root or ambiguous played values; explicit forced query is allowed', () => {
  for (const source of [undefined, 'after-root', 'candidate', 'forced']) {
    const value = input()
    value.analysis.before.topMoves = [candidate('Q16', 65, 5, 256)]
    value.analysis.playedMove = { move: 'D4', source, winrate: 52, scoreLead: 0, visits: 128, winrateLoss: 99, scoreLoss: 99 }
    const result = build(value)
    assert.equal(result.status, source === 'forced' ? 'compared' : 'unavailable')
    if (source === 'forced') {
      assert.equal(result.comparison.source, 'before-root-and-forced-played')
      assert.equal(result.comparison.scoreGap, 5)
    }
  }
})

test('weak visits, low confidence and blocked teaching readiness remain a tentative global question', () => {
  for (const mutate of [
    (v) => { v.analysis.analysisQuality.confidence = 'low' },
    (v) => { v.analysis.before.topMoves[1].visits = 1 },
    (v) => { v.analysis.before.topMoves[0].visits = 1 },
    (v) => { v.analysis.analysisQuality.totalVisits = 128 },
    (v) => { v.analysis.runtimeEvidence = { teachingReadiness: { canUseInFinalReport: false } } }
  ]) {
    const value = input()
    mutate(value)
    const result = build(value)
    assert.equal(result.status, 'compared')
    assert.equal(result.narrativePriority, 'local-or-undetermined')
    assert.equal(result.comparison.reliableSearch, false)
    assert.match(result.prompt, /不能说确定错过急所/)
    assert.match(result.prompt, /当前搜索更建议远处 Q16/)
  }
})

test('separate forced-query visits cannot inflate shallow root confidence and missing quality stays uncertain', () => {
  for (const quality of [undefined, { totalVisits: 95, confidence: 'medium' }, { totalVisits: 1200 }, { confidence: 'high' }]) {
    const value = input()
    value.analysis.analysisQuality = quality
    value.analysis.before.topMoves = [candidate('Q16', 65, 5, 80), candidate('D4', 52, 0, 1200)]
    value.analysis.playedMove = { move: 'D4', source: 'forced', winrate: 52, scoreLead: 0, visits: 1200 }
    const result = build(value)
    assert.equal(result.status, 'compared')
    assert.equal(result.narrativePriority, 'local-or-undetermined')
    assert.equal(result.comparison.reliableSearch, false)
    assert.equal(result.comparison.totalVisits, quality?.totalVisits ?? 0)
    assert.equal(result.comparison.source, 'before-root-and-forced-played')
    assert.match(result.prompt, /当前搜索更建议远处 Q16/)
  }
})

test('merged played display row retains explicit forced provenance and cannot bypass after-root provenance', () => {
  const value = input()
  value.analysis.playedMove = { move: 'D4', source: 'forced', winrate: 52, scoreLead: 0, visits: 1200 }
  // Even a matching display row with different visits does not override the source.
  const forced = build(value)
  assert.equal(forced.status, 'compared')
  assert.equal(forced.comparison.source, 'before-root-and-forced-played')
  assert.equal(forced.comparison.playedVisits, 1200)
  assert.match(forced.prompt, /同一落子前局面估值/)
  assert.match(forced.prompt, /实战估值来自单独强制搜索/)
  value.analysis.playedMove.source = 'after-root'
  const after = build(value)
  assert.equal(after.status, 'unavailable')
  assert.match(after.prompt, /after-root/)
})

test('near-optimal local alternative defeats global-region attribution even when the played point is poor', () => {
  for (const local of [candidate('E4', 64, 4.5), candidate('E4', 63.5, 2), candidate('E4', 50, 4.5)]) {
    const value = input()
    value.analysis.before.topMoves.push(candidate('F5', 55, 1), local)
    const result = build(value)
    assert.equal(result.narrativePriority, 'local-or-undetermined')
    assert.equal(result.bestLocalAlternative.move, 'E4')
    assert.match(result.prompt, /本局部仍可处理，实战点选择有差别/)
  }
})

test('searched weak local alternative supports a qualified preference for the remote area', () => {
  const value = input()
  value.analysis.before.topMoves.push(candidate('E4', 54, 0.5))
  const result = build(value)
  assert.equal(result.narrativePriority, 'global-priority')
  assert.equal(result.bestLocalAlternative.move, 'E4')
  assert.match(result.prompt, /也明显优于已搜索的本地替代 E4/)
})

test('unsearched, occupied or forced played rows do not become local alternatives', () => {
  const value = input()
  value.analysis.before.topMoves.push(candidate('E4', 65, 5, 0), candidate('F4', 65, 5, 128))
  value.boardSnapshot.push({ point: 'F4', color: 'W' })
  value.analysis.playedMove = { move: 'D4', source: 'forced', winrate: 52, scoreLead: 0, visits: 1200 }
  assert.equal(build(value).bestLocalAlternative, undefined)
})

test('saturated winrate cannot establish significance without a meaningful score gap', () => {
  const value = input()
  value.analysis.before.topMoves = [candidate('Q16', 99.9, 20), candidate('D4', 90, 19)]
  assert.equal(build(value).narrativePriority, 'local-or-undetermined')
  value.analysis.before.topMoves[1].scoreLead = 15
  assert.equal(build(value).narrativePriority, 'global-priority')
  assert.match(build(value).prompt, /只采用目差/)
})

test('ordinary winrate gap can establish importance even with less than three points score gap', () => {
  const value = input()
  value.analysis.before.topMoves = [candidate('Q16', 60, 1), candidate('D4', 50, 0)]
  assert.equal(build(value).narrativePriority, 'global-priority')
})

test('wrong move, game, size, timing, color or trial branch never compares unrelated positions', () => {
  for (const mutate of [
    (v) => { v.analysis.moveNumber++ }, (v) => { v.analysis.boardSize = 9 },
    (v) => { v.analysis.gameId = 'other' }, (v) => { v.boardTiming = 'after-move' },
    (v) => { v.analysis.currentMove.color = 'W' }, (v) => { v.analysis.currentMove.gtp = 'E4' },
    (v) => { v.analysis.currentMove.moveNumber++ },
    (v) => { v.analysis.trialContext = { active: true, branchHash: 'other' } },
    (v) => { v.trialBranchHash = 'expected' }
  ]) {
    const value = input(); mutate(value)
    assert.equal(build(value).status, 'unavailable')
  }
  const branch = input({ trialBranchHash: 'expected' })
  branch.analysis.trialContext = { active: true, branchHash: 'expected' }
  assert.equal(build(branch).status, 'compared')
})

test('pass, invalid, occupied and unavailable pre-move boards cannot imply a global mistake', () => {
  for (const mutate of [
    (v) => { v.playedMove = 'pass' }, (v) => { v.playedMove = 'I4' }, (v) => { v.playedMove = 'T99' },
    (v) => { v.analysis.currentMove.pass = true }, (v) => { v.analysis.before.topMoves[0].move = 'pass' },
    (v) => { v.boardSnapshot = undefined }, (v) => { v.boardSnapshot = [{ point: 'D4', color: 'B' }] },
    (v) => { v.boardSnapshot = [{ point: 'Q16', color: 'W' }] },
    (v) => { v.boardSnapshot = [{ point: 'I4', color: 'B' }] }
  ]) {
    const value = input(); mutate(value)
    assert.equal(build(value).status, 'unavailable')
  }
})

test('nonfinite/out-of-range evaluation and malformed visits cannot manufacture a significant gap', () => {
  for (const [key, invalid] of [['winrate', NaN], ['winrate', 101], ['scoreLead', Infinity], ['visits', -1], ['visits', undefined]]) {
    const value = input(); value.analysis.before.topMoves[1][key] = invalid
    assert.equal(build(value).status, 'unavailable')
  }
})

test('distance threshold scales down on small boards and uses engine rank rather than score sorting', () => {
  const value = input({ boardSize: 9, playedMove: 'A1' })
  value.analysis.boardSize = 9
  value.analysis.currentMove.gtp = 'A1'
  value.analysis.before.topMoves = [candidate('H8', 65, 5), candidate('A1', 52, 0), candidate('D4', 99, 90)]
  const result = build(value)
  assert.equal(result.narrativePriority, 'local-or-undetermined')
  assert.equal(result.comparison.bestMove, 'H8')
  assert.equal(result.bestLocalAlternative.move, 'D4')
  assert.equal(result.comparison.distantThreshold, 4)
})
