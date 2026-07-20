import assert from 'node:assert/strict'
import test from 'node:test'

import { detectSystemUiLocale, normalizeUiLocale } from '../src/renderer/src/i18n.ts'

test('system language negotiation recognizes all supported language families', () => {
  assert.equal(detectSystemUiLocale(['zh-Hans-CN']), 'zh-CN')
  assert.equal(detectSystemUiLocale(['zh-Hant-HK']), 'zh-TW')
  assert.equal(detectSystemUiLocale(['zh_TW.UTF-8']), 'zh-TW')
  assert.equal(detectSystemUiLocale(['yue-HK']), 'zh-TW')
  assert.equal(detectSystemUiLocale(['en-GB']), 'en-US')
  assert.equal(detectSystemUiLocale(['ja']), 'ja-JP')
  assert.equal(detectSystemUiLocale(['ko-KR']), 'ko-KR')
  assert.equal(detectSystemUiLocale(['th']), 'th-TH')
  assert.equal(detectSystemUiLocale(['vi-VN']), 'vi-VN')
})

test('system language negotiation follows preference order and falls back to English', () => {
  assert.equal(detectSystemUiLocale(['fr-FR', 'ja-JP', 'en-US']), 'ja-JP')
  assert.equal(detectSystemUiLocale(['de-DE', 'fr-FR']), 'en-US')
  assert.equal(detectSystemUiLocale([]), 'en-US')
})

test('locale normalization handles full Chinese script and region tags', () => {
  assert.equal(normalizeUiLocale('zh-Hant-TW'), 'zh-TW')
  assert.equal(normalizeUiLocale('zh-Hans-SG'), 'zh-CN')
})
