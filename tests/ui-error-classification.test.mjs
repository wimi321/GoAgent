import assert from 'node:assert/strict'
import test from 'node:test'

import { humanizeUiError } from '../src/renderer/src/i18n.ts'

const llmTitle = 'AI 老师暂时不能生成讲解。'
const katagoTitle = '围棋分析引擎还没准备好。'

test('LLM provider failures that mention a model are not reported as KataGo problems', () => {
  const proxyError = 'Error: LLM 工具流式请求失败: 502 {"error":{"message":"unknown provider for model gpt-5.5","type":"server_error"}}'
  assert.ok(humanizeUiError(proxyError, 'zh-CN', 'teacher-task').startsWith(llmTitle))
  assert.ok(humanizeUiError('LLM 工具请求失败: 404 model not found', 'zh-CN').startsWith(llmTitle))
  assert.ok(humanizeUiError('LLM 工具请求失败: 503 The engine is currently overloaded', 'zh-CN').startsWith(llmTitle))
})

test('KataGo failures are still reported as engine problems', () => {
  assert.ok(humanizeUiError('KataGo Missing: 缺少模型文件: b10c512h8nbt3tflrs-fson-silu-rsnh.bin.gz', 'zh-CN').startsWith(katagoTitle))
  assert.ok(humanizeUiError('Persistent KataGo engine exited with 1', 'zh-CN').startsWith(katagoTitle))
  assert.ok(humanizeUiError('Persistent KataGo analysis timed out after 1401000ms', 'zh-CN').startsWith(katagoTitle))
  assert.ok(humanizeUiError('Unable to load model file', 'zh-CN').startsWith(katagoTitle))
})
