import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const root = process.cwd()

async function importSpeechChunkingModule() {
  const source = readFileSync(join(root, 'src/renderer/src/features/tts/speechChunking.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      verbatimModuleSyntax: false
    }
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled, 'utf8').toString('base64')}`)
}

test('TTS evidence lists are chunked one fact per spoken segment', async () => {
  const { splitProgressiveSpeech } = await importSpeechChunkingModule()
  const chunks = splitProgressiveSpeech(`KataGo 数据：

实战：黑 F6
AI 首选：F2
胜率损失：约 20.2%
目差损失：约 2.9 目
搜索置信度：medium
首选参考：F2
另一个接近选择：F3`)
  assert.deepEqual(chunks, [
    'KataGo 数据。',
    '实战：黑 F6。',
    'AI 首选：F2。',
    '胜率损失：约 20.2%。',
    '目差损失：约 2.9 目。',
    '搜索置信度：medium。',
    '首选参考：F2。',
    '另一个接近选择：F3。'
  ])
})

test('TTS evidence labels remain separated even when copied as one line', async () => {
  const { splitProgressiveSpeech } = await importSpeechChunkingModule()
  const chunks = splitProgressiveSpeech('KataGo 数据： 实战：黑 F6 AI 首选：F2 胜率损失：约 20.2% 目差损失：约 2.9 目')
  assert.ok(chunks.length >= 5)
  assert.ok(chunks.includes('实战：黑 F6。'))
  assert.ok(chunks.includes('AI 首选：F2。'))
  assert.doesNotMatch(chunks.join('\n'), /实战：黑 F6 AI 首选/)
})

test('TTS chunking strips markdown hash markers before playback', async () => {
  const { splitProgressiveSpeech } = await importSpeechChunkingModule()
  const chunks = splitProgressiveSpeech('# 当前手讲解\n\n## KataGo 数据\nAI 首选：F2 #重点')
  assert.ok(chunks.some((chunk) => chunk.includes('当前手讲解')))
  assert.ok(chunks.some((chunk) => chunk.includes('KataGo 数据')))
  assert.ok(chunks.some((chunk) => chunk.includes('AI 首选：F2 重点')))
  assert.doesNotMatch(chunks.join('\n'), /#|井号/)
})
