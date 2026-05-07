import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('TTS provider policy uses explicit selected provider only', () => {
  const types = read('src/main/lib/types.ts')
  const registry = read('src/main/services/tts/index.ts')
  const providerTypes = read('src/main/services/tts/ttsTypes.ts')
  assert.match(types, /kokoro-bundled/)
  assert.match(types, /custom-openai-compatible/)
  assert.match(types, /custom-http-json/)
  assert.match(types, /external-local-service/)
  assert.doesNotMatch(types, /system-web-speech|speechSynthesis/)
  assert.match(providerTypes, /assertSelectedProvider/)
  assert.match(registry, /selectedProvider\(settings\)/)
  assert.doesNotMatch(registry, /tryNextProvider|providerChain|autoSwitchProvider/)
})

test('Kokoro bundled assets and scripts are wired', () => {
  const packageJson = JSON.parse(read('package.json'))
  assert.equal(packageJson.scripts['prepare:tts-assets'], 'node scripts/prepare_tts_assets.mjs')
  assert.equal(packageJson.scripts['check:tts-assets'], 'node scripts/check_tts_assets.mjs')
  assert.equal(packageJson.scripts['smoke:tts'], 'node scripts/smoke_tts.mjs')
  assert.match(packageJson.scripts['check:release-quality'], /check:tts-assets/)
  assert.match(packageJson.scripts['check:release-quality'], /smoke:tts/)
  const manifest = JSON.parse(read('data/tts/kokoro/zh-CN/manifest.json'))
  assert.equal(manifest.provider, 'kokoro-bundled')
  assert.equal(manifest.language, 'zh-CN')
  assert.equal(manifest.license, 'Apache-2.0')
  assert.match(manifest.modelFile, /model_int8\.onnx/)
  assert.match(manifest.runtimeModelFile, /model_quantized\.onnx/)
})

test('Kokoro zh-CN synthesis does not route Chinese text through the English phonemizer', () => {
  const provider = read('src/main/services/tts/kokoroBundledProvider.ts')
  const speechText = read('src/main/services/tts/speechText.ts')
  const smoke = read('scripts/smoke_tts.mjs')
  assert.match(provider, /usesDirectTokenizer/)
  assert.match(provider, /generate_from_ids/)
  assert.match(provider, /assertSpeechLanguageMatches/)
  assert.match(provider, /return 'z'/)
  assert.doesNotMatch(provider, /voiceIds\.has\(voice\)\) return 'a'/)
  assert.match(speechText, /detectSpeechLanguage/)
  assert.match(speechText, /TTS 语言不匹配/)
  assert.match(smoke, /generate_from_ids/)
  assert.match(smoke, /return 'z'/)
  assert.doesNotMatch(smoke, /return 'a'/)
})

test('custom TTS API is explicit and stored separately from public settings', () => {
  const store = read('src/main/lib/store.ts')
  const preload = read('src/preload/index.ts')
  assert.match(store, /ttsCustomApiKey/)
  assert.match(store, /getTtsCustomApiKey/)
  assert.match(preload, /synthesizeTts/)
  assert.match(preload, /getSavedTtsApiKey/)
})
