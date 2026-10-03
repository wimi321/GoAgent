import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const ownershipSource = readFileSync(new URL('../src/main/services/analysis/ownership.ts', import.meta.url), 'utf8')
const katagoSource = readFileSync(new URL('../src/main/services/katago.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('katago.ts', katagoSource, ts.ScriptTarget.Latest, true)
const functionNames = new Set(['blackWinrateFromSideToMove', 'blackScoreLeadFromSideToMove', 'responseSideToMove', 'root', 'candidates'])
const functions = ast.statements
  .filter((statement) => ts.isFunctionDeclaration(statement) && functionNames.has(statement.name?.text))
  .map((statement) => statement.getText(ast))
assert.equal(functions.length, functionNames.size)
const compiled = ts.transpileModule(`${ownershipSource}\n${functions.join('\n')}\nexport { root, candidates };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText
const { readRootOwnership, root, candidates } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const field = (value) => Array(81).fill(value)
const response = (extra = {}, currentPlayer = 'B') => ({ rootInfo: { currentPlayer, winrate: 0.6, scoreLead: 2 }, ...extra })

test('official top-level root ownership and stdev reach the parsed analysis root', () => {
  const parsed = root(response({ ownership: field(0.75), ownershipStdev: field(0.2) }), 'B', 9)
  assert.deepEqual(parsed.ownership, field(0.75))
  assert.deepEqual(parsed.ownershipStdev, field(0.2))
  assert.equal(parsed.winrate, 60)
  assert.equal(parsed.scoreLead, 2)
})

test('top-level fields take priority and missing fields retain legacy nested compatibility', () => {
  const nested = { rootInfo: { ownership: field(-0.8), ownershipStdev: field(0.3) } }
  assert.deepEqual(readRootOwnership(nested, 9), { ownership: field(-0.8), ownershipStdev: field(0.3) })
  assert.deepEqual(readRootOwnership({ ...nested, ownership: field(0.8), ownershipStdev: field(0.1) }, 9), {
    ownership: field(0.8), ownershipStdev: field(0.1)
  })
  assert.deepEqual(readRootOwnership({ ...nested, ownership: field(0.8) }, 9), {
    ownership: field(0.8), ownershipStdev: field(0.3)
  })
})

test('malformed official arrays are discarded without falling back or fabricating zeros', () => {
  const invalid = [null, [], field(0).slice(1), Array(361).fill(0), field(NaN), field(Infinity), field('0'), field(null), field(1.01), field(-1.01), new Array(81)]
  for (const ownership of invalid) {
    const parsed = readRootOwnership({ ownership, rootInfo: { ownership: field(0.8) } }, 9)
    assert.equal(parsed.ownership, undefined)
  }
  assert.equal(readRootOwnership({}, 9).ownership, undefined)
  assert.equal(readRootOwnership({ rootInfo: { ownership: field('0') } }, 9).ownership, undefined)
})

test('ownership length matches the contextual board size, independent of optional response dimensions', () => {
  assert.equal(root(response({ ownership: Array(361).fill(0), boardXSize: 19, boardYSize: 19 }), 'B', 9).ownership, undefined)
  assert.deepEqual(root(response({ ownership: field(0), boardXSize: 19, boardYSize: 19 }), 'B', 9).ownership, field(0))
  assert.equal(readRootOwnership({ ownership: field(0) }, 9.5).ownership, undefined)
  assert.equal(readRootOwnership({ ownership: [] }, 0).ownership, undefined)
})

test('standard deviations require finite numeric values between zero and one', () => {
  for (const ownershipStdev of [field(-0.1), field(1.01), field(NaN), field(Infinity), field('0.1'), field(null), field(0.1).slice(1)]) {
    assert.equal(readRootOwnership({ ownershipStdev, rootInfo: { ownershipStdev: field(0.2) } }, 9).ownershipStdev, undefined)
  }
  assert.deepEqual(readRootOwnership({ ownership: field(-1), ownershipStdev: field(1) }, 9), {
    ownership: field(-1), ownershipStdev: field(1)
  })
})

test('before and after ownership preserve the reported player perspective, as do candidates', () => {
  const before = response({ ownership: field(0.8), moveInfos: [{ move: 'A1', ownership: field(0.7) }] }, 'B')
  const after = response({ ownership: field(-0.8), moveInfos: [{ move: 'B1', ownership: field(-0.7) }] }, 'W')
  assert.deepEqual(root(before, 'W', 9).ownership, field(0.8))
  assert.deepEqual(root(after, 'B', 9).ownership, field(-0.8))
  assert.deepEqual(candidates(before, 'W')[0].ownership, field(0.7))
  assert.deepEqual(candidates(after, 'B')[0].ownership, field(-0.7))
  assert.equal(root(after, 'B', 9).scoreLead, -2)
  assert.equal(root(after, 'B', 9).winrate, 40)
})

test('valid arrays are copied so parsed root data cannot mutate the response', () => {
  const raw = field(0.5)
  const parsed = readRootOwnership({ ownership: raw }, 9)
  parsed.ownership[0] = -1
  assert.equal(raw[0], 0.5)
})
