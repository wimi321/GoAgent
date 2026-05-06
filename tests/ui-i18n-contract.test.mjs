import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const repoRoot = new URL('..', import.meta.url)

async function text(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

const locales = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR', 'th-TH', 'vi-VN']

test('renderer i18n exposes all target UI locales', async () => {
  const i18n = await text('src/renderer/src/i18n.ts')
  for (const locale of locales) {
    assert.match(i18n, new RegExp(locale), `missing ${locale}`)
  }
  assert.match(i18n, /繁體中文/)
  assert.match(i18n, /createUiTranslator/)
})

test('settings, teacher prompt, and renderer contracts accept all target locales', async () => {
  const types = await text('src/main/lib/types.ts')
  const teacher = await text('src/main/services/teacherAgent.ts')
  const app = await text('src/renderer/src/App.tsx')

  for (const locale of locales) {
    assert.match(types, new RegExp(locale), `types missing ${locale}`)
    assert.match(teacher, new RegExp(locale), `teacher prompt missing ${locale}`)
  }
  assert.match(app, /teacherEmptyPrompts/)
  assert.match(app, /t\('commandAnalyzeCurrent'\)/)
  assert.match(app, /t\('quickAnalyzeGamePrompt'\)/)
  assert.match(app, /localizeKataGoStatus/)
  assert.match(app, /t\('visionLlm'\)/)
  assert.match(app, /translateKataGoPreset/)
  assert.doesNotMatch(app, /本机兼容模型 Ready/)
  assert.doesNotMatch(app, /Vision LLM<\/span>/)
})
