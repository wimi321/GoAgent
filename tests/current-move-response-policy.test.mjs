import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCurrentMoveResponsePolicy } from '../src/main/services/teacher/currentMoveResponsePolicy.ts'

const policy = (prompt, explanationPace = 'standard') => buildCurrentMoveResponsePolicy({ intent: 'current-move', prompt, explanationPace })

test('ordinary move and why questions stay concise regardless of standard or brief pace', () => {
  for (const prompt of ['', '分析第 25 手', '为什么这手飞？', 'Why this move?']) {
    for (const pace of ['standard', 'brief', undefined]) assert.equal(policy(prompt, pace).mode, 'concise')
  }
})

test('explicit detail, variation and reply questions override a brief setting', () => {
  for (const prompt of ['详细讲解这手', '展开讲讲', '深挖一下', '逐步说明', '列出变化', '对方怎么应？', '对方应手和后续变化呢？', 'Explain in detail', 'Show variations', "What is the opponent's response?"]) {
    assert.equal(policy(prompt, 'brief').mode, 'detailed', prompt)
  }
  assert.equal(policy('分析这手', 'detailed').mode, 'detailed')
})

test('short requests and negated detail take priority over detail settings or words', () => {
  for (const prompt of ['不用详细讲解', '不要详解', '不必展开讲', '无需细讲', '不用展开后续变化', '详细思考，但回答一句话', '简短说明对方应手', 'No need to explain in detail', 'No need detail', 'no need详细', "Don't explain in detail", "Don't elaborate", 'Explain in detail, but answer in one sentence']) {
    assert.equal(policy(prompt, 'detailed').mode, 'concise', prompt)
  }
})

test('policy applies only to current move and preserves evidence verification without claiming success', () => {
  for (const intent of ['game-review', 'move-range', 'training-plan', 'open-ended']) {
    assert.equal(buildCurrentMoveResponsePolicy({ intent, prompt: '一句话', explanationPace: 'brief' }), undefined)
  }
  const concise = policy('为什么这手')
  assert.match(concise.instruction, /内部仍须完整核对/)
  assert.match(concise.instruction, /最多(?:再加一句|补第二句)/)
  assert.match(concise.instruction, /已经封锁成功/)
  assert.match(concise.instruction, /证据支持整片敌棋/)
})
