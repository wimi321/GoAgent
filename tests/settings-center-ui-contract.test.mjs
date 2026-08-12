import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

test('settings center uses focused pages and keeps Zhizi account tasks together', () => {
  const app = read('src/renderer/src/App.tsx')
  const zhiziPanel = read('src/renderer/src/features/settings/ZhiziCloudSettingsPanel.tsx')

  assert.match(app, /type SettingsPageId = 'general' \| 'ai' \| 'katago' \| 'zhizi' \| 'voice' \| 'about'/)
  assert.match(app, /const \[activeSettingsPage, setActiveSettingsPage\]/)
  assert.match(app, /className=\{`settings-nav-button/)
  assert.match(app, /aria-current=\{activeSettingsPage === page\.id \? 'page' : undefined\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'ai'\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'katago'\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'zhizi'\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'voice'\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'general'\}/)
  assert.match(app, /hidden=\{activeSettingsPage !== 'about'\}/)
  assert.match(app, /id:\s*'zhizi'/)
  assert.match(zhiziPanel, /compute: '算力'/)
  assert.match(zhiziPanel, /account: '账户与充值'/)
  assert.match(zhiziPanel, /history: '使用记录'/)
  assert.doesNotMatch(zhiziPanel, /getSavedZhiziToken|zhiziExtraArgs|zhiziClientBin/)
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

test('settings toggles keep their label text on one line (issue #31 regression)', () => {
  const css = read('src/renderer/src/styles.css')
  const zhiziCss = read('src/renderer/src/features/settings/zhizi-cloud.css')

  // The global input rule forces width:100% on every input. A flex-row toggle must
  // restore an auto-sized checkbox and let the label span fill the remaining width,
  // otherwise the text wraps one CJK character per column (vertical text on the
  // right edge of the settings card, as reported in issue #31).
  assert.match(css, /\.settings-inline-toggle input \{/)
  assert.match(css, /width: 16px;/)
  assert.match(css, /min-height: 0;/)
  assert.match(css, /\.settings-inline-toggle span \{/)
  assert.match(css, /flex: 1 1 auto;/)
  assert.match(css, /min-width: 0;/)
  assert.match(css, /\.desktop-preferences \.ghost-button,\r?\n\.desktop-preferences \.primary-button \{/)
  assert.match(css, /white-space: nowrap;/)

  // Zhizi paid-confirm checkbox uses the same flex-row pattern.
  assert.match(zhiziCss, /\.zhizi-paid-confirm input \{/)
  assert.match(zhiziCss, /width: 16px;/)
  assert.match(zhiziCss, /\.zhizi-paid-confirm span \{/)
  assert.match(zhiziCss, /flex: 1 1 auto;/)
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
