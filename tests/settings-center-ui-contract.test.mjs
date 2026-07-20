import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('settings center uses five user-facing pages and keeps remote compute in advanced analysis settings', () => {
  const app = read('src/renderer/src/App.tsx')

  assert.match(app, /type SettingsPageId = 'general' \| 'ai' \| 'katago' \| 'voice' \| 'about'/)
  assert.match(app, /const \[activeSettingsPage, setActiveSettingsPage\]/)
  assert.match(app, /className=\{`settings-nav-button/)
  assert.match(app, /aria-current=\{activeSettingsPage === page\.id \? 'page' : undefined\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'ai'\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'katago'\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'voice'\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'general'\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'about'\}/)
  assert.match(app, /settings-remote-advanced" hidden=\{activeSettingsPage !== 'katago'\}/)
  assert.doesNotMatch(app, /id:\s*'remote'/)
  assert.doesNotMatch(app, /<a href="#settings-ai"/)
  assert.doesNotMatch(app, /面向普通用户|每一页只处理一类事情|普通用户只需要|普通用户不需要|普通用户留空|兼容 API、Key/)
})

test('settings center avoids developer-facing AI configuration labels in Chinese copy', () => {
  const i18n = read('src/renderer/src/i18n.ts')

  assert.match(i18n, /llmBaseUrl:\s*'AI 服务地址'/)
  assert.match(i18n, /llmApiKey:\s*'访问密钥'/)
  assert.match(i18n, /currentApi:\s*'当前服务：\{\{url\}\}'/)
  assert.doesNotMatch(i18n, /llmBaseUrl:\s*'LLM Base URL'|llmApiKey:\s*'LLM API Key'|当前 API：/)
  assert.doesNotMatch(i18n, /填好 Base URL 与 API Key|需要支持图片输入的模型 API key/)
})

test('settings center has design-system styles for the focused page shell', () => {
  const css = read('src/renderer/src/styles.css')

  assert.match(css, /\.settings-nav-button\s*\{/)
  assert.match(css, /\.settings-nav-button\.is-active\s*\{/)
  assert.match(css, /\.settings-page-hero\s*\{/)
  assert.match(css, /\.settings-page-hero__icon\s*\{/)
  assert.match(css, /\.settings-about-grid\s*\{/)
  assert.match(css, /\.desktop-preferences \.settings-section\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s)
  assert.match(css, /grid-template-columns:\s*254px minmax\(0,\s*1fr\)/)
})
