import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { AppSettings, KataGoAnalysisGroup } from '@main/lib/types'

export type IKataGoAnalysisResponse = Record<string, unknown> & {
  id?: string
  error?: string
  isDuringSearch?: boolean
}

export interface IKataGoAnalysisBatchRequest {
  settings: AppSettings
  queries: Array<Record<string, unknown> & { id?: string }>
  runId?: string
  group?: KataGoAnalysisGroup
  timeoutMs?: number
  resolvePartialAfterMs?: number
  onResponse?: (response: IKataGoAnalysisResponse) => void
}

interface ActiveIKataGoProcess {
  child: ChildProcessWithoutNullStreams
  group?: KataGoAnalysisGroup
  cancelled: boolean
}

const activeIKataGoProcesses = new Map<string, ActiveIKataGoProcess>()

function splitCommandLine(input: string): string[] {
  const args: string[] = []
  let current = ''
  let quote: '"' | "'" | '' = ''
  let escaping = false
  for (const char of input) {
    if (escaping) {
      current += char
      escaping = false
      continue
    }
    if (char === '\\') {
      escaping = true
      continue
    }
    if (quote) {
      if (char === quote) quote = ''
      else current += char
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (/\s/.test(char)) {
      if (current) {
        args.push(current)
        current = ''
      }
      continue
    }
    current += char
  }
  if (escaping) current += '\\'
  if (current) args.push(current)
  return args
}

export function ikatagoClientConfigured(settings: AppSettings): boolean {
  return Boolean(
    settings.ikatagoClientBin.trim() &&
    settings.ikatagoPlatform.trim() &&
    settings.ikatagoUsername.trim() &&
    settings.ikatagoPassword.trim()
  )
}

export function shouldPreferIKataGoEngine(settings: AppSettings, localReady: boolean): boolean {
  const mode = settings.katagoEngineMode ?? 'auto'
  if (mode === 'ikatago') return true
  if (mode !== 'auto' || !ikatagoClientConfigured(settings)) return false
  if (!settings.ikatagoUseWhenLocalSlow) return false
  if (!localReady) return false
  const speed = Number(settings.katagoBenchmarkVisitsPerSecond || 0)
  const threshold = Number(settings.ikatagoSlowThresholdVisitsPerSecond || 0)
  return Boolean(speed > 0 && threshold > 0 && speed < threshold)
}

export function buildIKataGoAnalysisCommand(settings: AppSettings): string[] {
  if (!ikatagoClientConfigured(settings)) {
    throw new Error('iKataGo 未配置完整：需要填写客户端路径、platform、用户名和密码。')
  }
  const args: string[] = []
  if (settings.ikatagoWorldUrl.trim()) {
    args.push('--world', settings.ikatagoWorldUrl.trim())
  }
  args.push('--platform', settings.ikatagoPlatform.trim())
  args.push('--username', settings.ikatagoUsername.trim())
  args.push('--password', settings.ikatagoPassword.trim())
  const extraArgs = splitCommandLine(settings.ikatagoExtraArgs)
  args.push(...extraArgs)
  if (!extraArgs.includes('--')) {
    args.push('--', 'analysis')
  }
  return [settings.ikatagoClientBin.trim(), ...args]
}

export function cancelIKataGoAnalysis(filter: { runId?: string; group?: KataGoAnalysisGroup }): { cancelled: number } {
  let cancelled = 0
  for (const [id, entry] of activeIKataGoProcesses.entries()) {
    const matchesRun = filter.runId ? id === filter.runId : true
    const matchesGroup = filter.group ? entry.group === filter.group : true
    if (!matchesRun || !matchesGroup) continue
    entry.cancelled = true
    cancelled += 1
    entry.child.kill()
  }
  return { cancelled }
}

function responseErrorHint(stderr: string, stdoutLine?: string): string {
  const detail = [stderr.trim(), stdoutLine?.trim()].filter(Boolean).join('\n').slice(0, 1200)
  return [
    'iKataGo 远程引擎没有返回 KataGo analysis JSON。',
    '请确认 ikatago-client 支持把子命令透传为 `analysis`，并且附加参数里没有把子命令改回 gtp。',
    detail
  ].filter(Boolean).join('\n')
}

export async function queryIKataGoAnalysisBatch(request: IKataGoAnalysisBatchRequest): Promise<Map<string, IKataGoAnalysisResponse>> {
  if (!request.queries.length) return new Map()
  const command = buildIKataGoAnalysisCommand(request.settings)
  const child = spawn(command[0], command.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] })
  const runId = request.runId || `ikatago-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const activeEntry: ActiveIKataGoProcess = { child, group: request.group, cancelled: false }
  activeIKataGoProcesses.set(runId, activeEntry)

  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + String(chunk)).slice(-20_000)
  })

  function cleanup(): void {
    const current = activeIKataGoProcesses.get(runId)
    if (current === activeEntry) activeIKataGoProcesses.delete(runId)
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let stdout = ''
    let partialTimer: NodeJS.Timeout | undefined
    const results = new Map<string, IKataGoAnalysisResponse>()

    function clearPartialTimer(): void {
      if (partialTimer) {
        clearTimeout(partialTimer)
        partialTimer = undefined
      }
    }

    function finish(status: 'done' | 'error' | 'cancelled', value?: Map<string, IKataGoAnalysisResponse> | Error): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearPartialTimer()
      child.kill()
      cleanup()
      if (status === 'done') resolve(value as Map<string, IKataGoAnalysisResponse>)
      else reject(value instanceof Error ? value : new Error(status === 'cancelled' ? 'iKataGo 分析已取消' : 'iKataGo 分析失败'))
    }

    function schedulePartialResolve(): void {
      const partialAfterMs = request.resolvePartialAfterMs
      if (!partialAfterMs || results.size === 0 || results.size >= request.queries.length || settled) return
      clearPartialTimer()
      partialTimer = setTimeout(() => {
        if (!settled && results.size > 0) finish('done', results)
      }, partialAfterMs)
    }

    const timer = setTimeout(() => {
      finish('error', new Error('iKataGo 远程分析超时'))
    }, request.timeoutMs ?? Math.max(180_000, request.queries.length * 5000))

    child.stdout.on('data', (chunk) => {
      if (settled) return
      stdout += String(chunk)
      while (stdout.includes('\n')) {
        const newline = stdout.indexOf('\n')
        const line = stdout.slice(0, newline).trim()
        stdout = stdout.slice(newline + 1)
        if (!line) continue
        try {
          const parsed = JSON.parse(line) as IKataGoAnalysisResponse
          const id = typeof parsed.id === 'string' ? parsed.id : ''
          if (id) request.onResponse?.(parsed)
          if (id && !parsed.isDuringSearch) {
            results.set(id, parsed)
            schedulePartialResolve()
          }
        } catch {
          finish('error', new Error(responseErrorHint(stderr, line)))
          return
        }
        if (results.size >= request.queries.length) {
          finish('done', results)
          return
        }
      }
    })

    child.once('error', (error) => finish('error', error))
    child.once('close', (code) => {
      if (settled) return
      if (activeEntry.cancelled) {
        finish('cancelled', new Error('iKataGo 分析已取消'))
        return
      }
      if (code !== 0 && code !== null) {
        finish('error', new Error(stderr.trim() || `iKataGo exited with ${code}`))
        return
      }
      finish('error', new Error(responseErrorHint(stderr)))
    })

    for (const query of request.queries) {
      child.stdin.write(`${JSON.stringify(query)}\n`)
    }
    child.stdin.end()
  })
}
