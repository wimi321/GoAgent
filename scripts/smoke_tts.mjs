#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const root = process.cwd()
const strict = process.env.GOAGENT_TTS_SMOKE_STRICT === '1'
const assetRoot = join(root, 'data', 'tts', 'kokoro', 'zh-CN')
const cacheRoot = join(root, process.env.GOAGENT_APP_HOME || '.goagent-smoke', 'cache', 'tts', 'kokoro-bundled')
const failures = []
let strictSynthesisOk = false

function pythonCandidates() {
  const configured = process.env.GOAGENT_TTS_PYTHON?.trim()
  const candidates = configured ? [configured] : []
  if (process.platform === 'win32') {
    candidates.push('py -3.13', 'py -3.12', 'py -3.11', 'py -3.10', 'python', 'python3')
  } else {
    candidates.push('python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3', 'python')
  }
  return [...new Set(candidates)]
}

function splitLauncher(commandLine) {
  if (/^py(?:\.exe)?(?:\s|$)/i.test(commandLine)) {
    const [command, ...args] = commandLine.split(/\s+/)
    return { command, args }
  }
  return { command: commandLine, args: [] }
}

function runMisakiG2p(text) {
  const script = join(root, 'scripts', 'tts_misaki_zh_g2p.py')
  const errors = []
  for (const candidate of pythonCandidates()) {
    const launcher = splitLauncher(candidate)
    const probe = spawnSync(launcher.command, [
      ...launcher.args,
      '-c',
      'import sys; raise SystemExit(0 if sys.version_info.major == 3 and 10 <= sys.version_info.minor <= 13 else 1)'
    ], { encoding: 'utf8' })
    if (probe.status !== 0) {
      errors.push(`${candidate}: not Python 3.10-3.13`)
      continue
    }
    const result = spawnSync(launcher.command, [...launcher.args, script], {
      input: JSON.stringify({ text }),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    })
    if (result.status === 0) {
      const jsonLine = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse().find((line) => line.startsWith('{') && line.endsWith('}'))
      if (!jsonLine) throw new Error(`Misaki zh G2P returned no JSON: ${result.stdout}`)
      return JSON.parse(jsonLine)
    }
    errors.push(`${candidate}: ${result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`}`)
  }
  throw new Error(`Misaki zh G2P unavailable. Tried ${errors.join('；')}`)
}

function inspectWavAudio(path) {
  const buffer = readFileSync(path)
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`not a WAV file: ${path}`)
  }
  let fmt = null
  let data = null
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    offset += 8
    if (offset + size > buffer.length) break
    if (id === 'fmt ') fmt = { offset, size }
    if (id === 'data') data = { offset, size }
    offset += size + (size % 2)
  }
  if (!fmt || !data) throw new Error(`missing fmt/data chunks: ${path}`)
  const format = buffer.readUInt16LE(fmt.offset)
  const bitsPerSample = buffer.readUInt16LE(fmt.offset + 14)
  let peak = 0
  if (format === 3 && bitsPerSample === 32) {
    for (let offset = data.offset; offset + 4 <= data.offset + data.size; offset += 4) {
      const value = buffer.readFloatLE(offset)
      if (!Number.isFinite(value)) throw new Error(`invalid float sample in Kokoro output: ${path}`)
      peak = Math.max(peak, Math.abs(value))
    }
  } else if (format === 1 && bitsPerSample === 16) {
    for (let offset = data.offset; offset + 2 <= data.offset + data.size; offset += 2) {
      peak = Math.max(peak, Math.abs(buffer.readInt16LE(offset)))
    }
  } else {
    throw new Error(`unsupported WAV format=${format} bits=${bitsPerSample}: ${path}`)
  }
  if (peak <= 0.00001) throw new Error(`silent Kokoro synthesis output: ${path}`)
}

function requireFile(path, label) {
  if (!existsSync(path)) failures.push(`missing ${label}: ${path}`)
}

requireFile(join(assetRoot, 'manifest.json'), 'Kokoro manifest')
requireFile(join(assetRoot, 'onnx', 'model_int8.onnx'), 'Kokoro model')
requireFile(join(assetRoot, 'onnx', 'model_quantized.onnx'), 'Kokoro runtime model')
requireFile(join(assetRoot, 'voices', 'zf_001.bin'), 'Kokoro default voice')

async function strictSynthesizeSmoke() {
  const manifest = JSON.parse(readFileSync(join(assetRoot, 'manifest.json'), 'utf8'))
  mkdirSync(cacheRoot, { recursive: true })
  const output = join(cacheRoot, 'kokoro-zh-cn-smoke.wav')
  const smokeText = '第87手，KataGo 推荐 D4，实战 Q16 方向也可以。第二段继续说明：白棋如果在 C17 扳，黑棋要先看断点。这个 joseki 和 tesuji 不是 OpenAI GPT-5.5 的英文朗读测试。A点也要读出来。'
  const g2p = runMisakiG2p(smokeText)
  if (!g2p.text.includes('迪四') || !g2p.text.includes('丘十六') || g2p.text.includes('坐标迪四') || g2p.text.includes('坐标丘十六') || !g2p.text.includes('第二段') || !g2p.text.includes('定式') || !g2p.text.includes('手筋') || /[A-Za-z]/.test(g2p.text)) {
    throw new Error(`Misaki speech normalization did not preserve multiline coordinate content: ${g2p.text}`)
  }
  await runKokoroWorkerSmoke({
    id: 'smoke-kokoro-worker',
    appPackageJson: join(root, 'package.json'),
    modelRoot: assetRoot,
    dtype: 'q8',
    device: 'cpu',
    language: 'zh-CN',
    voices: (manifest.voices ?? []).map((voice) => ({
      id: voice.id,
      file: join(assetRoot, voice.file)
    })),
    voice: manifest.defaultVoiceId ?? 'zf_001',
    speed: 1,
    phonemes: g2p.phonemes,
    output
  })
  const stat = statSync(output)
  if (stat.size < 4096) failures.push(`suspiciously small Kokoro synthesis output: ${output}`)
  else {
    inspectWavAudio(output)
    strictSynthesisOk = true
  }
}

async function runKokoroWorkerSmoke(request) {
  const worker = spawn(process.execPath, [join(root, 'scripts', 'tts_kokoro_worker.mjs')], {
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  let stderr = ''
  worker.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8')
  })
  await new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      worker.kill()
      reject(new Error(`Kokoro worker smoke timed out. ${stderr.trim()}`))
    }, 120_000)
    worker.stdout.on('data', (chunk) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed) continue
        let response
        try {
          response = JSON.parse(trimmed)
        } catch {
          continue
        }
        if (response.id !== request.id) continue
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (response.ok) resolve()
        else reject(new Error(response.error || `Kokoro worker smoke failed. ${stderr.trim()}`))
      }
    })
    worker.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    worker.on('exit', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`Kokoro worker exited before response: code=${code ?? 'null'} signal=${signal ?? 'null'} ${stderr.trim()}`))
    })
    worker.stdin.end(`${JSON.stringify(request)}\n`)
  })
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
