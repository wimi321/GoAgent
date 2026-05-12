import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('SGF scoring helper normalizes Fox komi and result notation before teaching', () => {
  const source = read('src/main/services/sgfScoring.ts')
  assert.match(source, /export function normalizeSgfKomi/)
  assert.match(source, /parsed \/ 50/)
  assert.match(source, /parsed \/ 100/)
  assert.match(source, /KM\[\$\{rawText\}\].*归一/)
  assert.match(source, /displayLeadPoints = game\.source === 'fox' \? parsed\.margin \* 2 : parsed\.margin/)
  assert.match(source, /comparisonLeadPoints/)
  assert.match(source, /foxAreaPointDifference/)
  assert.match(source, /confidence: 'recorded-result'/)
  assert.match(source, /teacherText = `\$\{colorName\(parsed\.winner\)\}领先/)
  assert.match(source, /不要把原始 B\+22\.75 直接说成 22\.75 目差/)
})

test('Teacher tools expose normalized komi and resultSummary instead of raw Fox-only numbers', () => {
  const teacherAgent = read('src/main/services/teacherAgent.ts')
  assert.match(teacherAgent, /gameResultSummary/)
  assert.match(teacherAgent, /komiSummary/)
  assert.match(teacherAgent, /rawResult: game\.result/)
  assert.match(teacherAgent, /resultSummary: gameResultSummary\(game\)/)
  assert.match(teacherAgent, /komi: komiSummary\(record\.komi\)\.normalized/)
  assert.match(teacherAgent, /棋谱的 result \/ game\.result \/ rawResult 是终局记录/)
  assert.match(teacherAgent, /resultSummary\.confidence=recorded-result/)
  assert.match(teacherAgent, /teacherScore\.text/)
  assert.match(teacherAgent, /不要主动解释内部口径/)
  assert.match(teacherAgent, /function teacherScoreForAnalysis/)
  assert.match(teacherAgent, /source: 'game-record'/)
  assert.match(teacherAgent, /source: 'katago-current-position'/)
})

test('Renderer shows exact Fox record result separately from KataGo estimate at final position', () => {
  const app = read('src/renderer/src/App.tsx')
  assert.match(app, /gameResultLeadForUi/)
  assert.match(app, /game\?\.source === 'fox' \? rawMargin \* 2 : rawMargin/)
  assert.match(app, /finalRecordScore/)
  assert.match(app, /timelineFinalRecordScore/)
  assert.match(app, /ks-timeline-record-score/)
  assert.match(app, /recordScoreLead/)
  assert.match(app, /katagoScoreLead/)
})
