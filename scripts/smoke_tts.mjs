#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import fsPromises from 'node:fs/promises'
import { basename, join } from 'node:path'

const root = process.cwd()
const strict = process.env.GOAGENT_TTS_SMOKE_STRICT === '1'
const assetRoot = join(root, 'data', 'tts', 'kokoro', 'zh-CN')
const cacheRoot = join(root, process.env.GOAGENT_APP_HOME || '.goagent-smoke', 'cache', 'tts', 'kokoro-bundled')
const failures = []
let strictSynthesisOk = false

function requireFile(path, label) {
  if (!existsSync(path)) failures.push(`missing ${label}: ${path}`)
}

requireFile(join(assetRoot, 'manifest.json'), 'Kokoro manifest')
requireFile(join(assetRoot, 'onnx', 'model_int8.onnx'), 'Kokoro model')
requireFile(join(assetRoot, 'onnx', 'model_quantized.onnx'), 'Kokoro runtime model')
requireFile(join(assetRoot, 'voices', 'zf_001.bin'), 'Kokoro default voice')

async function strictSynthesizeSmoke() {
  const manifest = JSON.parse(readFileSync(join(assetRoot, 'manifest.json'), 'utf8'))
  const voices = new Map((manifest.voices ?? []).map((voice) => [`${voice.id}.bin`, join(assetRoot, voice.file)]))
  const originalReadFile = fsPromises.readFile.bind(fsPromises)
  fsPromises.readFile = async function readLocalVoice(path, ...args) {
    const source = String(path)
    const localVoice = voices.get(basename(source))
    if (localVoice && source.includes('kokoro-js') && /[\\/]voices[\\/]/.test(source)) {
      return originalReadFile(localVoice, ...args)
    }
    return originalReadFile(path, ...args)
  }
  const { KokoroTTS } = await import('kokoro-js')
  const tts = await KokoroTTS.from_pretrained(assetRoot, { dtype: 'q8', device: 'cpu' })
  tts._validate_voice = (voice) => {
    if (voices.has(`${voice}.bin`)) return 'z'
    throw new Error(`Smoke voice is not present in bundled manifest: ${voice}`)
  }
  mkdirSync(cacheRoot, { recursive: true })
  const output = join(cacheRoot, 'kokoro-zh-cn-smoke.wav')
  if (!tts.tokenizer || !tts.generate_from_ids) {
    throw new Error('kokoro-js runtime does not expose direct tokenizer synthesis for zh-CN')
  }
  const encoded = tts.tokenizer('围棋智能体开始复盘。', { truncation: true })
  if (!encoded.input_ids) {
    throw new Error('Kokoro zh-CN tokenizer did not return input_ids')
  }
  const audio = await tts.generate_from_ids(encoded.input_ids, {
    voice: manifest.defaultVoiceId ?? 'zf_001',
    speed: 1
  })
  await audio.save(output)
  const stat = statSync(output)
  if (stat.size < 4096) failures.push(`suspiciously small Kokoro synthesis output: ${output}`)
  else strictSynthesisOk = true
}

if (strict && failures.length === 0) {
  try {
    await strictSynthesizeSmoke()
  } catch (error) {
    failures.push(`Kokoro synthesis failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failures.length) {
  if (strict) {
    for (const failure of failures) console.error(`[smoke-tts] ${failure}`)
    process.exit(1)
  }
  for (const failure of failures) console.warn(`[smoke-tts] warning: ${failure}`)
  console.log('[smoke-tts] non-strict mode: TTS runtime smoke skipped until bundled assets are prepared')
} else {
  console.log(strict && strictSynthesisOk
    ? '[smoke-tts] strict Kokoro offline synthesis smoke OK'
    : '[smoke-tts] Kokoro TTS assets are present for runtime smoke')
}
