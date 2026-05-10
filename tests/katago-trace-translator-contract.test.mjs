import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('KataGo Trace Translator defines the full evidence packet', () => {
  const source = read('src/main/services/teacher/katagoTraceTranslator.ts')
  for (const fragment of [
    'buildKataGoTracePacket',
    'buildShallowSearchTree',
    'candidateComparison',
    'scorePerspective',
    'scoreSummaryFromBlackLead',
    'policySearchDelta',
    'pvSupport',
    'ownershipSummary',
    'humanPolicySignals',
    'teachingGuidance'
  ]) {
    assert.match(source, new RegExp(fragment), `translator missing ${fragment}`)
  }
})

test('KataGo trace types are exposed on KataGoMoveAnalysis', () => {
  const types = read('src/main/lib/types.ts')
  assert.match(types, /export interface KataGoTracePacket/)
  assert.match(types, /export interface KataGoScoreSummary/)
  assert.match(types, /export interface KataGoTraceTreeNode/)
  assert.match(types, /scoreLeadPerspective\?: 'black-positive'/)
  assert.match(types, /tracePacket\?: KataGoTracePacket/)
  assert.match(types, /humanPolicy\?: number/)
})

test('KataGo analysis requests policy/PV/ownership fields used by trace translator', () => {
  const katago = read('src/main/services/katago.ts')
  assert.match(katago, /includePolicy: true/)
  assert.match(katago, /includePVVisits: true/)
  assert.match(katago, /includeOwnership: deepEvidence/)
  assert.match(katago, /humanPolicy/)
  assert.match(katago, /analysis\.tracePacket = buildKataGoTracePacket\(analysis\)/)
})

test('Teacher prompt references trace packet as teaching evidence', () => {
  const teacherAgent = read('src/main/services/teacherAgent.ts')
  assert.match(teacherAgent, /formatKataGoTraceForPrompt/)
  assert.match(teacherAgent, /tracePacket\.searchSummary/)
  assert.match(teacherAgent, /tracePacket:\s*analysis\.tracePacket/)
  assert.match(teacherAgent, /scoreSummary\.leadPoints/)
  assert.match(teacherAgent, /policySearchDelta/)
  assert.match(teacherAgent, /humanPolicySignals/)
})

test('package wires eval:katago-trace into teacher quality gate', () => {
  const packageJson = JSON.parse(read('package.json'))
  assert.equal(packageJson.scripts['eval:katago-trace'], 'node scripts/eval_katago_trace.mjs')
  assert.match(packageJson.scripts['check:teacher-quality'], /eval:katago-trace/)
})
