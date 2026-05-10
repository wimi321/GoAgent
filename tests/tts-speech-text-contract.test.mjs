import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const root = process.cwd()

async function importSpeechTextModule() {
  const source = readFileSync(join(root, 'src/main/services/tts/speechText.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      verbatimModuleSyntax: false
    }
  }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled, 'utf8').toString('base64')}`)
}

test('cloud TTS speech cleanup preserves Go coordinate letters for pronunciation', async () => {
  const { markdownToSpeechText } = await importSpeechTextModule()
  const text = markdownToSpeechText('建议下在 Q16，实战 K5 稍亏。下一手可以看 L 点或 R 处。')
  assert.match(text, /Q 十六/)
  assert.match(text, /K 五/)
  assert.match(text, /L 点/)
  assert.match(text, /R 处/)
  assert.doesNotMatch(text, /丘十六|凯五|艾勒点|阿尔处/)
})

test('TTS keeps normal English words and AI terms instead of spelling every letter', async () => {
  const { markdownToSpeechText } = await importSpeechTextModule()
  const text = markdownToSpeechText('AI 老师认为这是 strong visits 支持，不是 natural-but-refuted。')
  assert.match(text, /AI 老师/)
  assert.match(text, /strong visits/)
  assert.match(text, /natural but refuted/)
  assert.doesNotMatch(text, /人工智能/)
  assert.doesNotMatch(text, /艾斯替阿尔欧恩吉|维艾艾斯艾替艾斯/)
})

test('TTS removes markdown heading hash markers from spoken text', async () => {
  const { markdownToSpeechText } = await importSpeechTextModule()
  const text = markdownToSpeechText('# 当前手讲解\n\n## KataGo 数据\nAI 首选：F2 #重点')
  assert.match(text, /当前手讲解/)
  assert.match(text, /卡塔狗 数据/)
  assert.match(text, /AI 首选：F 二 重点/)
  assert.doesNotMatch(text, /井号|#/)
})

test('Kokoro localized coordinate mode remains available for Chinese G2P', async () => {
  const { markdownToSpeechText } = await importSpeechTextModule()
  const text = markdownToSpeechText('建议下在 Q16，实战 K5 稍亏。', { coordinateLetterMode: 'localized' })
  assert.match(text, /丘十六/)
  assert.match(text, /凯五/)
})
