import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConceptModule } from '../scripts/lib/concept_modules.mjs'
const { canReuseTeacherAnalysis } = await loadConceptModule('src/main/services/teacher/analysisReuse.ts')
const analysis = { gameId: 'game', moveNumber: 25, analysisQuality: { totalVisits: 95 }, playedMove: { visits: 1199 } }
const request = { gameId: 'game', moveNumber: 25 }

test('explicit deeper requests cannot reuse shallow roots even with deep forced-played evidence', () => {
  assert.equal(canReuseTeacherAnalysis(analysis, { ...request, requestedMaxVisits: 1200 }), false)
  assert.equal(canReuseTeacherAnalysis(analysis, { ...request, requestedMaxVisits: 96 }), true)
  assert.equal(canReuseTeacherAnalysis({ ...analysis, analysisQuality: { totalVisits: 1199 } }, { ...request, requestedMaxVisits: 1200 }), true)
  assert.equal(canReuseTeacherAnalysis({ ...analysis, analysisQuality: undefined }, { ...request, requestedMaxVisits: 1200 }), false)
  assert.equal(canReuseTeacherAnalysis(analysis, request), true)
})

test('reuse checks game, move and active trial branch in both directions', () => {
  for (const input of [{ ...request, gameId: 'other' }, { ...request, moveNumber: 26 }, { ...request, trialBranchHash: 'trial' }]) {
    assert.equal(canReuseTeacherAnalysis(analysis, input), false)
  }
  const trial = { ...analysis, trialContext: { active: true, branchHash: 'trial' } }
  assert.equal(canReuseTeacherAnalysis(trial, request), false)
  assert.equal(canReuseTeacherAnalysis(trial, { ...request, trialBranchHash: 'trial' }), true)
  assert.equal(canReuseTeacherAnalysis(trial, { ...request, trialBranchHash: 'other' }), false)
})

test('invalid or unknown explicit search depth cannot manufacture reusable evidence', () => {
  for (const totalVisits of [NaN, Infinity, -1, undefined]) {
    assert.equal(canReuseTeacherAnalysis({ ...analysis, analysisQuality: { totalVisits } }, { ...request, requestedMaxVisits: 100 }), false)
  }
  for (const requestedMaxVisits of [NaN, Infinity, -1, 0]) assert.equal(canReuseTeacherAnalysis(analysis, { ...request, requestedMaxVisits }), false)
  assert.equal(canReuseTeacherAnalysis(undefined, request), false)
})
