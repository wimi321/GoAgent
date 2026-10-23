import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Execute the production dispatcher with only the two engine transports replaced.
const source = readFileSync(new URL('../src/main/services/teacherAgent.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('teacherAgent.ts', source, ts.ScriptTarget.Latest, true)
const dispatch = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'analyzeTeacherPosition')
assert.ok(dispatch)
const code = ts.transpileModule(`export ${dispatch.getText(ast)}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const prefix = `export const calls=[];export let branch='trial';export function setBranch(value){branch=value} const analyzePosition=async(...args)=>{calls.push(['main',args]);return {gameId:args[0],moveNumber:args[1]}};const analyzeTrialPositionWithProgress=async(input)=>{calls.push(['trial',input]);return {trialContext:{branchHash:branch}}};`
const { analyzeTeacherPosition, calls, setBranch } = await import(`data:text/javascript;base64,${Buffer.from(prefix + code).toString('base64')}`)
const trial = { active: true, baseMoveNumber: 9, moves: [{ color: 'B', gtp: 'D4', row: 15, col: 3 }], branchHash: 'trial' }

test('deeper main-line analysis uses the requested budget and teacher cancellation group', async () => {
  calls.length = 0
  await analyzeTeacherPosition({ id: 'run', request: {} }, 'game', 10, 1200)
  assert.deepEqual(calls, [['main', ['game', 10, 1200, { runId: 'run', group: 'teacher' }]]])
})

test('trial deepening calls the trial engine with the exact branch instead of same-number main line', async () => {
  calls.length = 0; setBranch('trial')
  await analyzeTeacherPosition({ id: 'run', request: { gameId: 'game', boardContext: 'trial', trialBranch: trial } }, 'game', 10, 1200)
  assert.deepEqual(calls, [['trial', { gameId: 'game', baseMoveNumber: 9, trialMoves: trial.moves, maxVisits: 1200, runId: 'run', group: 'teacher' }]])
})

test('wrong trial game, move, or returned branch is rejected without silently analyzing main line', async () => {
  const state = { id: 'run', request: { gameId: 'game', boardContext: 'trial', trialBranch: trial } }
  calls.length = 0
  await assert.rejects(analyzeTeacherPosition(state, 'other', 10, 1200), /试下/)
  await assert.rejects(analyzeTeacherPosition(state, 'game', 9, 1200), /试下/)
  assert.equal(calls.length, 0)
  setBranch('wrong')
  await assert.rejects(analyzeTeacherPosition(state, 'game', 10, 1200), /不同分支/)
  assert.equal(calls.some(call => call[0] === 'main'), false)
})
