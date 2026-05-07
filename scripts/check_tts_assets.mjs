#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const strict = process.env.GOAGENT_TTS_ASSETS_STRICT === '1'
const dir = join(root, 'data', 'tts', 'kokoro', 'zh-CN')
const manifestPath = join(dir, 'manifest.json')
const failures = []
const warnings = []

function addFailure(message) { (strict ? failures : warnings).push(message) }
function sha256(path) { const h = createHash('sha256'); h.update(readFileSync(path)); return h.digest('hex') }
function checkFileSha(path, expected, label) {
  if (!existsSync(path)) {
    addFailure(`missing ${label}: ${path}`)
    return
  }
  if (expected) {
    const actual = sha256(path)
    if (actual !== expected) failures.push(`${label} SHA256 mismatch: ${actual}`)
  }
}

if (!existsSync(manifestPath)) {
  addFailure(`missing manifest: ${manifestPath}`)
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const [key, expected] of [['provider', 'kokoro-bundled'], ['language', 'zh-CN'], ['license', 'Apache-2.0']]) {
    if (manifest[key] !== expected) failures.push(`manifest ${key} must be ${expected}`)
  }
  const modelPath = join(dir, manifest.modelFile ?? 'onnx/model_int8.onnx')
  checkFileSha(modelPath, manifest.modelSha256, 'Kokoro ONNX model')
  if (existsSync(modelPath)) {
    const sizeMb = statSync(modelPath).size / 1024 / 1024
    if (sizeMb < 100 || sizeMb > 180) failures.push(`unexpected Kokoro model size: ${sizeMb.toFixed(1)} MB`)
  }
  const runtimeModelPath = join(dir, manifest.runtimeModelFile ?? 'onnx/model_quantized.onnx')
  checkFileSha(runtimeModelPath, manifest.runtimeModelSha256, 'Kokoro runtime ONNX model')
  if (existsSync(runtimeModelPath)) {
    const sizeMb = statSync(runtimeModelPath).size / 1024 / 1024
    if (sizeMb < 100 || sizeMb > 180) failures.push(`unexpected Kokoro runtime model size: ${sizeMb.toFixed(1)} MB`)
  }
  if (!Array.isArray(manifest.voices) || manifest.voices.length < 1) failures.push('manifest must list at least one voice')
  for (const voice of manifest.voices ?? []) {
    const voicePath = join(dir, voice.file)
    checkFileSha(voicePath, voice.sha256, `Kokoro voice ${voice.id}`)
  }
  for (const file of ['config.json', 'tokenizer_config.json', 'tokenizer.json']) {
    const path = join(dir, file)
    if (!existsSync(path)) addFailure(`missing Kokoro tokenizer/config file: ${path}`)
    else JSON.parse(readFileSync(path, 'utf8'))
  }
  for (const file of ['LICENSE', 'MODEL_CARD.md']) {
    if (!existsSync(join(dir, file))) failures.push(`missing source notice file: ${file}`)
  }
}

for (const warning of warnings) console.warn(`[check-tts-assets] warning: ${warning}`)
if (failures.length) {
  for (const failure of failures) console.error(`[check-tts-assets] ${failure}`)
  process.exit(1)
}
console.log(strict ? '[check-tts-assets] strict Kokoro asset check OK' : '[check-tts-assets] Kokoro asset contract OK')
