import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { app } from 'electron'
import type { AppSettings } from '@main/lib/types'
import { materializeTtsScript } from './ttsPythonRuntime'

interface KokoroWorkerVoice {
  id: string
  file: string
}

interface KokoroWorkerRequest {
  id: string
  appPackageJson: string
  modelRoot: string
  dtype: AppSettings['ttsKokoroDType']
  device: AppSettings['ttsKokoroDevice']
  language: AppSettings['ttsLanguage']
  voices: KokoroWorkerVoice[]
  voice: string
  speed: number
  phonemes: string
  output: string
}

interface PendingRequest {
  resolve: () => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

let worker: ChildProcessWithoutNullStreams | null = null
let workerReady: Promise<ChildProcessWithoutNullStreams> | null = null
const pending = new Map<string, PendingRequest>()

function appPackageJsonPath(): string {
  try {
    return join(app.getAppPath(), 'package.json')
  } catch {
    return join(process.cwd(), 'package.json')
  }
}

function rejectAll(error: Error): void {
  for (const request of pending.values()) {
    clearTimeout(request.timer)
    request.reject(error)
  }
  pending.clear()
}

async function ensureWorker(): Promise<ChildProcessWithoutNullStreams> {
  if (worker && !worker.killed) return worker
  if (workerReady) return workerReady
  workerReady = (async () => {
    const scriptPath = await materializeTtsScript(process.cwd(), 'tts_kokoro_worker.mjs')
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    child.stderr.on('data', (chunk: Buffer) => {
      const line = chunk.toString('utf8').trim()
      if (line) console.warn(`[tts-worker] ${line}`)
    })
    child.on('exit', (code, signal) => {
      if (worker === child) worker = null
      workerReady = null
      rejectAll(new Error(`Kokoro TTS 后台进程已退出：code=${code ?? 'null'} signal=${signal ?? 'null'}`))
    })
    child.on('error', (error) => {
      if (worker === child) worker = null
      workerReady = null
      rejectAll(error)
    })
    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity })
    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      let response: { id?: string; ok?: boolean; error?: string }
      try {
        response = JSON.parse(trimmed) as { id?: string; ok?: boolean; error?: string }
      } catch {
        console.warn(`[tts-worker] non-json stdout: ${trimmed}`)
        return
      }
      if (!response.id) return
      const request = pending.get(response.id)
      if (!request) return
      pending.delete(response.id)
      clearTimeout(request.timer)
      if (response.ok) request.resolve()
      else request.reject(new Error(response.error || 'Kokoro TTS 后台进程生成失败。'))
    })
    worker = child
    return child
  })()
  return workerReady
}

export async function synthesizeKokoroChunkInWorker(payload: Omit<KokoroWorkerRequest, 'id' | 'appPackageJson'>): Promise<void> {
  const child = await ensureWorker()
  const id = randomUUID()
  const request: KokoroWorkerRequest = {
    ...payload,
    id,
    appPackageJson: appPackageJsonPath()
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Kokoro TTS 后台进程生成超时。'))
    }, 120_000)
    pending.set(id, { resolve, reject, timer })
    child.stdin.write(`${JSON.stringify(request)}\n`, (error) => {
      if (!error) return
      clearTimeout(timer)
      pending.delete(id)
      reject(error)
    })
  })
}
