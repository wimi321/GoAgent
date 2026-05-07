#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(packageJson.scripts['check:tts-assets'], 'node scripts/check_tts_assets.mjs')
assert.equal(packageJson.scripts['smoke:tts'], 'node scripts/smoke_tts.mjs')
assert.equal(packageJson.scripts['eval:tts-provider-policy'], 'node scripts/eval_tts_provider_policy.mjs')
assert.ok(packageJson.dependencies?.['kokoro-js'], 'kokoro-js dependency is required for bundled Kokoro provider')

const types = readFileSync(join(root, 'src', 'main', 'lib', 'types.ts'), 'utf8')
assert.match(types, /TtsProviderId = 'kokoro-bundled' \| 'custom-openai-compatible' \| 'custom-http-json' \| 'external-local-service'/)
assert.doesNotMatch(types, /system-web-speech|speechSynthesis/)

const serviceDir = join(root, 'src', 'main', 'services', 'tts')
assert.ok(existsSync(join(serviceDir, 'kokoroBundledProvider.ts')), 'missing Kokoro provider')
assert.ok(existsSync(join(serviceDir, 'customOpenAiSpeechProvider.ts')), 'missing custom OpenAI-compatible provider')
assert.ok(existsSync(join(serviceDir, 'index.ts')), 'missing TTS registry')

const implementation = readdirSync(serviceDir)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => readFileSync(join(serviceDir, name), 'utf8'))
  .join('\n')
assert.doesNotMatch(implementation, /system-web-speech|speechSynthesis|webkitSpeechSynthesis/)
assert.doesNotMatch(implementation, /tryNextProvider|providerChain|autoSwitchProvider/)
assert.match(implementation, /assertSelectedProvider/)
assert.match(implementation, /kokoro-bundled/)

const manifest = JSON.parse(readFileSync(join(root, 'data', 'tts', 'kokoro', 'zh-CN', 'manifest.json'), 'utf8'))
assert.equal(manifest.provider, 'kokoro-bundled')
assert.equal(manifest.language, 'zh-CN')
assert.equal(manifest.license, 'Apache-2.0')
assert.ok(manifest.modelSha256)

console.log('TTS provider policy eval passed')
