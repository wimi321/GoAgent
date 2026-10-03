import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

async function loadTs(path, prefix = '', suffix = '') {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const body = ast.statements.filter((node) => !ts.isImportDeclaration(node)).map((node) => node.getText(ast)).join('\n')
  const compiled = ts.transpileModule(`${prefix}\n${body}\n${suffix}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
}

const matcher = await loadTs('../src/main/services/knowledge/matchEngine.ts', `
let library;
export function setLibrary(value) { library = value }
function loadKnowledgeTrainingLibrary() { return library }
function loadKnowledgePatternCards() { return [] }
function searchKnowledgePatterns() { return [] }
function formatPatternForPrompt() { return '' }
`)
const { findLocalPatternMatches } = await loadTs('../src/main/services/knowledge/localPatternMatcher.ts')
const b = (point) => ({ color: 'B', point })
const w = (point) => ({ color: 'W', point })
const initialStones = [b('D5'), b('E4'), w('C4'), w('C3')]
const problem = {
  id: 'eye', title: '真眼假眼', region: 'corner', toPlay: 'B', difficulty: 'standard',
  objective: '判断真眼假眼死活', sourceKind: 'common-pattern', initialStones,
  correctMoves: [{ move: 'D4', explanation: '训练答案' }], failureMoves: [], tags: ['真眼假眼', '死活'],
  teaching: { recognition: '训练棋形', firstFeeling: '先读棋', explanation: '练习眼形', memoryCue: '眼形', firstHint: '先读棋', tesujiIdea: '读棋' }
}
const line = {
  id: 'joseki', title: '星位点三三', family: '星位', phase: ['opening'], levels: ['intermediate'],
  sourceKind: 'common-pattern', relativeSequence: ['D4', 'C3', 'D3', 'C4'], normalizedFeatures: [],
  branches: [], decisionRules: [], commonMistakes: [], katagoEraJudgement: '训练参考', trainingFocus: [], tags: ['定式', '星位点三三']
}
const query = (extra = {}) => ({ boardSize: 19, moveNumber: 80, totalMoves: 180, userLevel: 'intermediate', recentMoves: [],
  text: '真眼假眼死活', playedMove: 'D4', candidateMoves: ['D4'], playerColor: 'B', lossScore: 10, judgement: 'blunder', maxResults: 20, ...extra })
const search = (extra = {}) => matcher.searchKnowledgeMatchEngine('', query(extra))
matcher.setLibrary({ josekiLines: [line], lifeDeathProblems: [problem], tesujiProblems: [{ ...problem, id: 'tesuji', title: '倒扑手筋', tags: ['倒扑', '手筋'] }] })

test('region, loss, tactical keywords and accidental answer coordinates remain training analogies', () => {
  for (const text of ['真眼假眼死活', '倒扑手筋']) {
    const matches = search({ text, boardSnapshot: [b('Q16'), w('R16')] })
    assert.ok(matches.length > 0)
    for (const match of matches) {
      assert.ok(['partial', 'weak'].includes(match.confidence), `${match.id}: ${match.confidence}`)
      assert.ok(!match.reason.some((reason) => /answer-|sequence-overlap/.test(reason)))
      assert.match(match.applicability, /训练|弱相关/)
    }
  }
})

test('absolute answer coincidences in history and whole-board stones do not change score', () => {
  const baseline = search({ playedMove: undefined, candidateMoves: [], boardSnapshot: [b('Q16')] }).find((m) => m.id === 'eye')
  const coincidence = search({ playedMove: undefined, candidateMoves: [], boardSnapshot: [b('D4')],
    recentMoves: [{ moveNumber: 1, color: 'B', gtp: 'D4', row: 15, col: 3, pass: false }] }).find((m) => m.id === 'eye')
  assert.equal(coincidence.score, baseline.score)
  assert.equal(coincidence.confidence, 'partial')
})

test('PV future points and untyped local-window anchors do not establish before-position geometry', () => {
  const before = search({ playedMove: undefined, candidateMoves: [], boardSnapshot: initialStones })
  const future = search({ playedMove: undefined, candidateMoves: [], boardSnapshot: initialStones,
    principalVariation: ['D4', 'C3', 'E4'], localWindows: [{ anchor: 'D4', stones: initialStones }] })
  assert.deepEqual(future, before)
  assert.ok(future.every((m) => !m.reason.some((reason) => reason.startsWith('geometry:'))))
})

test('real relative geometry with the matching player role supports strong shape relevance, never a solved-position claim', () => {
  const matched = search({ boardSnapshot: initialStones }).find((m) => m.id === 'eye')
  assert.equal(matched.confidence, 'strong')
  assert.ok(matched.reason.some((reason) => reason.startsWith('geometry:')))
  assert.match(matched.applicability, /未验证.*是否合法/)
  assert.match(matched.teachingPayload.recognition, /训练类比，尚未确认/)
  const prompt = matcher.formatKnowledgeMatchForPrompt(matched)
  assert.match(prompt, /不代表本局概念或战术成立/)
  assert.match(prompt, /必须另有合法手顺和读棋证据/)
  assert.doesNotMatch(prompt, /可以说“这是/)
  const unknown = search({ boardSnapshot: initialStones, playerColor: undefined }).find((m) => m.id === 'eye')
  assert.equal(unknown.confidence, 'partial')
  const wrongPlayer = search({ boardSnapshot: initialStones, playerColor: 'W' }).find((m) => m.id === 'eye')
  assert.equal(wrongPlayer.confidence, 'partial')
  const windowOnly = search({ localWindows: [{ anchor: 'D4', stones: initialStones }] }).find((m) => m.id === 'eye')
  assert.equal(windowOnly.confidence, 'partial')
  assert.ok(windowOnly.reason.some((reason) => reason.startsWith('incomplete-local-window:')))
})

test('unordered joseki coordinate overlap and explicit keywords cannot authorize exact or strong', () => {
  const found = search({ text: '星位点三三定式', moveNumber: 10, playedMove: 'C3', candidateMoves: ['D3'],
    principalVariation: ['D4', 'C4'], recentMoves: [{ gtp: 'D4', row: 15, col: 3, color: 'B' }] }).find((m) => m.id === 'joseki')
  assert.ok(found)
  assert.equal(found.confidence, 'partial')
})

const card = (anchorRole, points = [{ dx: 0, dy: 0, state: 'any-stone' }, { dx: 1, dy: 0, state: 'friendly' }]) => ({
  id: anchorRole, title: anchorRole, shapeType: 'test', category: 'shape', anchorRole,
  phase: ['any'], regions: ['any'], tags: [], sourceRefs: [], sourceQuality: 'original', points,
  teaching: { recognition: '', wrongThinking: '', correctThinking: '', drillPrompt: '' }
})
const local = (cards, extra = {}) => findLocalPatternMatches(cards, {
  boardSize: 19, boardSnapshot: [b('D4'), b('E4')], anchors: ['D4'], playerColor: 'B', ...extra
})

test('actual and candidate roles require typed source anchors rather than generic windows', () => {
  assert.deepEqual(local([card('actual'), card('candidate')], { localWindows: [{ anchor: 'D4', stones: [] }] }), [])
  assert.equal(local([card('actual')], { playedMove: 'D4' }).length, 1)
  assert.equal(local([card('candidate')], { candidateMoves: ['D4'] }).length, 1)
  assert.equal(local([card('actual')], { playedMove: 'Q16', candidateMoves: ['D4'] }).length, 0)
  assert.equal(local([card('either')], { anchors: [], localWindows: [{ anchor: 'D4', stones: [] }] }).length, 0)
})

test('friendly, enemy and empty anchor roles obey the actual board and known player', () => {
  assert.deepEqual(local([card('friendly-stone'), card('enemy-stone'), card('empty')]).map((m) => m.card.id), ['friendly-stone'])
  assert.equal(local([card('enemy-stone')], { boardSnapshot: [w('D4'), b('E4')] }).length, 1)
  const emptyCard = card('empty', [{ dx: 0, dy: 0, state: 'empty' }, { dx: 1, dy: 0, state: 'friendly' }])
  assert.equal(local([emptyCard], { boardSnapshot: [b('E4')] }).length, 1)
  assert.equal(local([emptyCard]).length, 0)
  assert.equal(local([card('either')], { boardSnapshot: [w('D4'), w('E4')] }).length, 0)
})

test('unknown player perspective is explicit and weak; required points and constraints cannot be ignored', () => {
  const match = local([card('either')], { boardSnapshot: [w('D4'), w('E4')], playerColor: undefined })[0]
  assert.equal(match.perspective, 'W')
  assert.equal(match.confidence, 'weak')
  assert.match(match.evidence.join(' '), /current-player unknown/)
  assert.equal(local([card('either')], { boardSnapshot: undefined }).length, 0)
  assert.equal(local([{ ...card('either'), constraints: [{ type: 'anchor-empty', value: 1 }] }]).length, 0)
  assert.equal(local([card('either')], { boardSnapshot: [b('D4')] }).length, 0)
})
