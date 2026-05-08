#!/usr/bin/env node
import { createRequire } from 'node:module'
import fsPromises from 'node:fs/promises'
import { basename } from 'node:path'
import { createInterface } from 'node:readline'

console.log = (...args) => console.error(...args)

let cachedModelKey = ''
let cachedTts = null
let redirectInstalled = false
const localVoiceFiles = new Map()

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function languageCode(language) {
  if (language === 'zh-CN' || language === 'zh-TW') return 'z'
  if (language === 'ja-JP') return 'j'
  if (language === 'ko-KR') return 'k'
  if (language === 'th-TH') return 't'
  if (language === 'vi-VN') return 'v'
  return 'a'
}

function installLocalVoiceRedirect() {
  if (redirectInstalled) return
  redirectInstalled = true
  const originalReadFile = fsPromises.readFile.bind(fsPromises)
  fsPromises.readFile = async function readLocalVoice(path, ...args) {
    const source = String(path)
    const voiceFile = localVoiceFiles.get(basename(source))
    if (voiceFile && source.includes('kokoro-js') && /[\\/]voices[\\/]/.test(source)) {
      return originalReadFile(voiceFile, ...args)
    }
    return originalReadFile(path, ...args)
  }
}

function numericTokenIds(inputIds) {
  const data = inputIds?.data ?? inputIds
  if (Array.isArray(data)) return data.map((item) => Number(item))
  if (ArrayBuffer.isView(data) && 'length' in data) {
    return Array.from(data, (item) => Number(item))
  }
  return []
}

function assertUsableTokenization(inputIds) {
  const semanticIds = numericTokenIds(inputIds).filter((id) => Number.isFinite(id) && id > 0)
  if (semanticIds.length < 3) {
    throw new Error('Kokoro tokenizer returned too few useful token ids for the Misaki phonemes.')
  }
}

async function importKokoro(appPackageJson) {
  if (appPackageJson) {
    const requireFromApp = createRequire(appPackageJson)
    return import(requireFromApp.resolve('kokoro-js'))
  }
  return import('kokoro-js')
}

async function loadTts(request) {
  installLocalVoiceRedirect()
  for (const voice of request.voices ?? []) {
    localVoiceFiles.set(`${voice.id}.bin`, voice.file)
  }
  const modelKey = `${request.modelRoot}:${request.dtype}:${request.device}`
  if (cachedTts && cachedModelKey === modelKey) return cachedTts
  const module = await importKokoro(request.appPackageJson)
  cachedTts = await module.KokoroTTS.from_pretrained(request.modelRoot, {
    dtype: request.dtype || 'q8',
    device: request.device || 'cpu',
    local_files_only: true
  })
  cachedTts._validate_voice = (voice) => {
    if (localVoiceFiles.has(`${voice}.bin`)) return languageCode(request.language)
    throw new Error(`Kokoro bundled voice is not installed for selected language: ${voice}`)
  }
  cachedModelKey = modelKey
  return cachedTts
}

async function handleRequest(request) {
  const tts = await loadTts(request)
  const encoded = tts.tokenizer(request.phonemes, { truncation: true })
  assertUsableTokenization(encoded.input_ids)
  const audio = await tts.generate_from_ids(encoded.input_ids, {
    voice: request.voice,
    speed: request.speed || 1
  })
  await audio.save(request.output)
  send({ id: request.id, ok: true, output: request.output })
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
let queue = Promise.resolve()

rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  queue = queue
    .then(async () => {
      let request
      try {
        request = JSON.parse(trimmed)
        await handleRequest(request)
      } catch (error) {
        send({
          id: request?.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    })
    .catch((error) => {
      send({ ok: false, error: error instanceof Error ? error.message : String(error) })
    })
})

process.on('uncaughtException', (error) => {
  send({ ok: false, error: error instanceof Error ? error.message : String(error) })
})

process.on('unhandledRejection', (error) => {
  send({ ok: false, error: error instanceof Error ? error.message : String(error) })
})
