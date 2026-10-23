import assert from 'node:assert/strict'
import test from 'node:test'
import { toolExecutionHistory } from '../src/main/services/llm/toolExecutionHistory.ts'

const call = (id, name, args = {}) => ({
  id,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) }
})

test('repair history preserves actual concept JSON and image with their tool call', () => {
  const toolCall = call('knowledge-1', 'lookup_knowledge', { move: 'D4' })
  const actualConcepts = JSON.stringify({ newConcepts: [{ id: 'liberties', explanation: '实际知识结果' }] })
  const image = { role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,dGVzdA==' } }] }
  const result = { ok: true, toolResult: actualConcepts, followupMessages: [image] }
  const repairMessages = [{ role: 'user', content: '分析此步' }, ...toolExecutionHistory(toolCall, result)]

  assert.deepEqual(repairMessages.slice(1), [
    { role: 'assistant', content: '', tool_calls: [toolCall] },
    { role: 'tool', name: 'lookup_knowledge', tool_call_id: 'knowledge-1', content: actualConcepts },
    image
  ])
  assert.deepEqual(JSON.parse(repairMessages[2].content).newConcepts, [{ id: 'liberties', explanation: '实际知识结果' }])
  assert.equal(repairMessages[3], image)
  assert.deepEqual(result.followupMessages, [image])
})

test('failed tool result remains verbatim and associated with the actual call', () => {
  const toolCall = call('katago-failed', 'analyze_move', { move: 'Q16' })
  const actualFailure = 'KataGo 分析超时，未取得结果。'
  assert.deepEqual(toolExecutionHistory(toolCall, { ok: false, toolResult: actualFailure, followupMessages: [] }), [
    { role: 'assistant', content: '', tool_calls: [toolCall] },
    { role: 'tool', name: 'analyze_move', tool_call_id: 'katago-failed', content: actualFailure }
  ])
})

test('multiple executions retain chronological call/result pairing for a new turn', () => {
  const first = call('katago-1', 'analyze_move')
  const second = call('knowledge-2', 'lookup_knowledge')
  const history = [
    ...toolExecutionHistory(first, { ok: true, toolResult: '{"winrate":0.52}', followupMessages: [] }),
    ...toolExecutionHistory(second, { ok: false, toolResult: '未匹配到知识', followupMessages: [] })
  ]
  assert.deepEqual(history.map(m => m.role), ['assistant', 'tool', 'assistant', 'tool'])
  assert.equal(history[0].tool_calls[0].id, history[1].tool_call_id)
  assert.equal(history[2].tool_calls[0].id, history[3].tool_call_id)
  assert.deepEqual(history.filter(m => m.role === 'tool').map(m => m.content), ['{"winrate":0.52}', '未匹配到知识'])
})
