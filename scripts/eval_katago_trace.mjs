#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

function assertFile(path) {
  assert.ok(existsSync(join(root, path)), `missing ${path}`)
  return read(path)
}

const translator = assertFile('src/main/services/teacher/katagoTraceTranslator.ts')
const types = assertFile('src/main/lib/types.ts')
const katago = assertFile('src/main/services/katago.ts')
const teacherAgent = assertFile('src/main/services/teacherAgent.ts')

const requiredTranslatorFragments = [
  'buildKataGoTracePacket',
  'buildShallowSearchTree',
  'policySearchDelta',
  'pvSupport',
  'ownershipSummary',
  'humanPolicySignals',
  'natural-but-refuted',
  'low-policy-but-strong-search',
  'pvVisits',
  'scoreStdev'
]

for (const fragment of requiredTranslatorFragments) {
  assert.match(translator, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `katagoTraceTranslator missing ${fragment}`)
}

const requiredTypeFragments = [
  'KataGoTracePacket',
  'KataGoTraceCandidate',
  'KataGoPolicySearchDelta',
  'KataGoPvSupport',
  'KataGoOwnershipRegionSummary',
  'KataGoHumanPolicySignals',
  'KataGoTraceTreeNode',
  'tracePacket?: KataGoTracePacket',
  'humanPolicy?: number'
]

for (const fragment of requiredTypeFragments) {
  assert.ok(types.includes(fragment), `types.ts missing ${fragment}`)
}

for (const fragment of [
  'buildKataGoTracePacket',
  'includePolicy: true',
  'includePVVisits: true',
  'includeOwnership: deepEvidence',
  'humanPolicy',
  'analysis.tracePacket'
]) {
  assert.ok(katago.includes(fragment), `katago.ts missing ${fragment}`)
}

for (const fragment of [
  'formatKataGoTraceForPrompt',
  'tracePacket.searchSummary',
  'tracePacket: analysis.tracePacket',
  'policySearchDelta',
  'pvSupport',
  'ownershipSummary',
  'humanPolicySignals',
  'shallowSearchTree'
]) {
  assert.ok(teacherAgent.includes(fragment), `teacherAgent.ts missing ${fragment}`)
}

console.log(JSON.stringify({
  ok: true,
  checked: 'katago trace translator contract',
  features: ['tracePacket', 'shallowSearchTree', 'policySearchDelta', 'pvSupport', 'ownershipSummary', 'humanPolicySignals']
}, null, 2))
