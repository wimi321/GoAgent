import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { AppSettings, GameMove, KataGoAnalysisGroup } from '@main/lib/types'
import {
  classifyZhiziRemoteError,
  getZhiziPersistentSession,
  redactZhiziText,
  type ZhiziPersistentSession
} from './zhiziSocketSession'
import {
  buildZhiziRemoteArgs,
  parseKataAnalyzeInfo,
  zhiziAnalysisReachedVisits,
  zhiziResponseVisitTotal,
  type ZhiziGtpAnalysisResponse
} from './zhiziGtpProtocol'

export {
  buildZhiziRemoteArgs,
  parseKataAnalyzeInfo,
  zhiziAnalysisReachedVisits
} from './zhiziGtpProtocol'
export type { ZhiziGtpAnalysisResponse } from './zhiziGtpProtocol'

export interface ZhiziGtpAnalysisBatchRequest {
  settings: AppSettings
  queries: Array<Record<string, unknown> & { id?: string }>
  runId?: string
  group?: KataGoAnalysisGroup
  timeoutMs?: number
  resolvePartialAfterMs?: number
  onResponse?: (response: ZhiziGtpAnalysisResponse) => void
  onSearchProgress?: (progress: {
    id?: string
    visits: number
    visitsPerSecond: number
    isDuringSearch: boolean
  }) => void
}

interface ActiveZhiziProcess {
  group?: KataGoAnalysisGroup
  cancelled: boolean
  stop: () => void
}

type GtpQuery = {
  id: string
  moves: Array<[GameMove['color'], string]>
  initialStones?: Array<[GameMove['color'], string]>
  initialPlayer?: GameMove['color']
  boardXSize?: number
  boardYSize?: number
  komi?: number
  maxVisits?: number
  allowMoves?: Array<{
    player: GameMove['color']
    moves: string[]
    untilDepth: number
  }>
}

const activeZhiziProcesses = new Map<string, ActiveZhiziProcess>()
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

function redactZhiziLog(text: string): string {
  return redactZhiziText(text)
}

function cleanVertex(move: string): string {
  const value = String(move || '').trim()
  return value || 'pass'
}

function opposite(color: GameMove['color']): GameMove['color'] {
  return color === 'B' ? 'W' : 'B'
}

function sideToMove(query: GtpQuery): GameMove['color'] {
  const lastMove = query.moves[query.moves.length - 1]
  if (lastMove?.[0] === 'B' || lastMove?.[0] === 'W') {
    return opposite(lastMove[0])
  }
  return query.initialPlayer === 'W' ? 'W' : 'B'
}

function analysisMillis(maxVisits: number | undefined): number {
  const visits = Math.max(1, Number(maxVisits ?? 120) || 120)
  if (visits <= 32) return 350
  if (visits <= 80) return 550
  if (visits <= 180) return 900
  if (visits <= 360) return 1400
  if (visits <= 800) return 2200
  if (visits <= 1600) return 3600
  return 5600
}

function emitAnalyzeProgress(
  request: ZhiziGtpAnalysisBatchRequest,
  queryId: string,
  player: GameMove['color'],
  text: string,
  state: { lastVisits: number; lastSampleAt: number },
  isDuringSearch: boolean
): void {
  if (!/\binfo\s+/.test(text)) return
  const response = parseKataAnalyzeInfo(text, player, queryId)
  if (response.error || !response.moveInfos?.length) return
  const visits = zhiziResponseVisitTotal(response)
  if (visits <= state.lastVisits) return
  const now = Date.now()
  const elapsedSeconds = Math.max(0.1, (now - state.lastSampleAt) / 1000)
  const visitsDelta = visits - state.lastVisits
  state.lastVisits = visits
  state.lastSampleAt = now
  const visitsPerSecond = visitsDelta / elapsedSeconds
  request.onResponse?.({ ...response, isDuringSearch })
  request.onSearchProgress?.({
    id: queryId,
    visits,
    visitsPerSecond,
    isDuringSearch
  })
}

function hasGtpTerminator(text: string): boolean {
  return /\r?\n\r?\n/.test(text)
}

function countGtpResponses(text: string): number {
  return (text.match(/\r?\n\r?\n/g) ?? []).length
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function zhiziGtpConfigured(settings: AppSettings): boolean {
  if (settings.zhiziToken.trim()) {
    return true
  }
  return settings.katagoEngineMode === 'zhizi' && Boolean(settings.zhiziClientBin.trim())
}

export function shouldPreferZhiziGtpEngine(settings: AppSettings, localReady: boolean): boolean {
  const mode = settings.katagoEngineMode ?? 'auto'
  if (mode === 'zhizi') return true
  if (mode !== 'auto' || !zhiziGtpConfigured(settings)) return false
  if (!settings.zhiziUseWhenLocalSlow) return false
  if (!localReady) return false
  const speed = Number(settings.katagoBenchmarkVisitsPerSecond || 0)
  const threshold = Number(settings.ikatagoSlowThresholdVisitsPerSecond || 0)
  return Boolean(speed > 0 && threshold > 0 && speed < threshold)
}

export function buildZhiziGtpCommand(settings: AppSettings): string[] {
  if (!settings.zhiziClientBin.trim()) {
    throw new Error('智子云旧连接器未配置完整：需要填写 zz-ikatago 客户端路径。普通用户请用账号密码或短信验证码登录智子云直连。')
  }
  const args: string[] = []
  if (settings.zhiziToken.trim()) {
    args.push('--token', settings.zhiziToken.trim())
  }
  args.push(...splitCommandLine(settings.zhiziExtraArgs))
  return [settings.zhiziClientBin.trim(), ...args]
}

export function cancelZhiziGtpAnalysis(filter: { runId?: string; group?: KataGoAnalysisGroup }): { cancelled: number } {
  let cancelled = 0
  for (const [id, entry] of activeZhiziProcesses.entries()) {
    const matchesRun = filter.runId ? id === filter.runId : true
    const matchesGroup = filter.group ? entry.group === filter.group : true
    if (!matchesRun || !matchesGroup) continue
    entry.cancelled = true
    cancelled += 1
    entry.stop()
  }
  return { cancelled }
}

function asGtpQuery(query: Record<string, unknown> & { id?: string }): GtpQuery {
  return {
    id: query.id || `zhizi-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    moves: Array.isArray(query.moves) ? query.moves as Array<[GameMove['color'], string]> : [],
    initialStones: Array.isArray(query.initialStones) ? query.initialStones as Array<[GameMove['color'], string]> : [],
    initialPlayer: query.initialPlayer === 'W' ? 'W' : 'B',
    boardXSize: Number(query.boardXSize ?? 19),
    boardYSize: Number(query.boardYSize ?? query.boardXSize ?? 19),
    komi: Number(query.komi ?? 7.5),
    maxVisits: Number(query.maxVisits ?? 120),
    allowMoves: Array.isArray(query.allowMoves) ? query.allowMoves as GtpQuery['allowMoves'] : undefined
  }
}

async function queryZhiziSocketGtpAnalysisBatch(request: ZhiziGtpAnalysisBatchRequest): Promise<Map<string, ZhiziGtpAnalysisResponse>> {
  if (!request.queries.length) return new Map()
  const token = request.settings.zhiziToken.trim()
  if (!token) {
    throw new Error('智子云未登录：请先在 GoAgent 中输入账号密码登录。')
  }

  const runId = request.runId || `zhizi-direct-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const controller = new AbortController()
  const activeEntry: ActiveZhiziProcess = {
    group: request.group,
    cancelled: false,
    stop: () => controller.abort()
  }
  activeZhiziProcesses.set(runId, activeEntry)

  function cleanup(): void {
    const current = activeZhiziProcesses.get(runId)
    if (current === activeEntry) activeZhiziProcesses.delete(runId)
  }

  const args = buildZhiziRemoteArgs(request.settings)
  const session = getZhiziPersistentSession({
    accountToken: token,
    args,
    gpuType: request.settings.zhiziGpuType?.trim() || 'vip-share'
  })
  const overallDeadline = Date.now() + (
    request.timeoutMs ?? Math.max(240_000, request.queries.length * 9_000)
  )

  async function sendCommands(
    channel: ZhiziPersistentSession,
    commandLines: string[],
    description: string
  ): Promise<string> {
    if (!commandLines.length) return ''
    const start = channel.output().stdout.length
    const disconnectVersion = channel.captureDisconnectVersion()
    channel.send(`${commandLines.join('\n')}\n`)
    const timeoutMs = Math.max(10_000, commandLines.length * 600)
    await channel.waitUntil(
      () => countGtpResponses(channel.output().stdout.slice(start)) >= commandLines.length,
      timeoutMs,
      description,
      controller.signal,
      disconnectVersion
    )
    const text = channel.output().stdout.slice(start)
    if (/(?:^|\n)\?/.test(text.trim())) {
      throw new Error(`${description}失败。\n${redactZhiziLog(text.trim().slice(0, 1200))}`)
    }
    return text
  }

  async function analyzeQuery(
    channel: ZhiziPersistentSession,
    query: GtpQuery,
    boardState: { key: string }
  ): Promise<ZhiziGtpAnalysisResponse> {
    channel.clearOutput()
    const boardXSize = Math.max(2, Math.round(query.boardXSize || 19))
    const boardYSize = Math.max(2, Math.round(query.boardYSize || boardXSize))
    const boardKey = `${boardXSize}x${boardYSize}`
    const setupCommands: string[] = []
    if (boardState.key !== boardKey) {
      setupCommands.push(
        boardXSize === boardYSize ? `boardsize ${boardXSize}` : `rectangular_boardsize ${boardXSize} ${boardYSize}`,
        'kata-set-rules chinese',
        'time_settings 0 5 1'
      )
      boardState.key = boardKey
    }
    setupCommands.push(
      `komi ${Number.isFinite(query.komi) ? query.komi : 7.5}`,
      'clear_board'
    )
    for (const [color, point] of query.initialStones ?? []) {
      setupCommands.push(`play ${color} ${cleanVertex(point)}`)
    }
    for (const [color, point] of query.moves) {
      setupCommands.push(`play ${color} ${cleanVertex(point)}`)
    }
    await sendCommands(channel, setupCommands, '智子云 GTP 初始化局面')
    const player = sideToMove(query)
    const allow = (query.allowMoves ?? [])
      .filter((entry) => entry.player && entry.moves?.length)
      .map((entry) => `allow ${entry.player} ${entry.moves.map(cleanVertex).join(',')} ${Math.max(1, Math.round(entry.untilDepth || 1))}`)
      .join(' ')
    const start = channel.output().stdout.length
    const disconnectVersion = channel.captureDisconnectVersion()
    const commandLine = `kata-analyze ${player} 25 rootInfo true maxmoves 20${allow ? ` ${allow}` : ''}`
    channel.send(`${commandLine}\n`)
    const searchStartedAt = Date.now()
    const progressState = { lastVisits: 0, lastSampleAt: searchStartedAt }
    const targetVisits = Math.max(1, Math.round(query.maxVisits ?? 120))
    const queryTimeoutMs = Math.max(15_000, Math.min(120_000, targetVisits * 220))
    let latestResponse: ZhiziGtpAnalysisResponse | null = null

    while (Date.now() - searchStartedAt < queryTimeoutMs && Date.now() < overallDeadline) {
      await delay(100)
      if (activeEntry.cancelled) throw new Error('智子云分析已取消')
      const output = channel.output().stdout.slice(start)
      if (!/\binfo\s+/.test(output)) continue
      const response = parseKataAnalyzeInfo(output, player, query.id)
      if (response.error || !response.moveInfos?.length) continue
      latestResponse = response
      emitAnalyzeProgress(request, query.id, player, output, progressState, true)
      if (zhiziAnalysisReachedVisits(response, targetVisits)) break
    }

    if (!latestResponse?.moveInfos?.length) {
      throw new Error('智子云已连接，但在限定时间内没有返回候选点。')
    }
    channel.send('stop\n')
    await channel.waitUntil(
      () => hasGtpTerminator(channel.output().stdout.slice(start)),
      12_000,
      '智子云 kata-analyze',
      controller.signal,
      disconnectVersion
    )
    const finalOutput = channel.output().stdout.slice(start)
    const parsedFinal = parseKataAnalyzeInfo(finalOutput, player, query.id)
    const response = parsedFinal.moveInfos?.length ? parsedFinal : latestResponse
    emitAnalyzeProgress(request, query.id, player, finalOutput, progressState, false)
    request.onResponse?.(response)
    return response
  }

  try {
    return await session.runExclusive(controller.signal, async (channel) => {
      const results = new Map<string, ZhiziGtpAnalysisResponse>()
      const boardState = { key: '' }
      let firstCompletedAt = 0
      for (const rawQuery of request.queries) {
        const query = asGtpQuery(rawQuery)
        let lastError: ReturnType<typeof classifyZhiziRemoteError> | null = null
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            if (attempt > 1) {
              await channel.restart(controller.signal)
              boardState.key = ''
            }
            const response = await analyzeQuery(channel, query, boardState)
            if (response.id) results.set(response.id, response)
            if (!firstCompletedAt) firstCompletedAt = Date.now()
            lastError = null
            break
          } catch (cause) {
            lastError = classifyZhiziRemoteError(
              cause,
              request.settings.zhiziGpuType?.trim() || 'vip-share'
            )
            if (
              !lastError.retryable ||
              lastError.code === 'cancelled' ||
              activeEntry.cancelled ||
              attempt >= 3
            ) {
              throw lastError
            }
            await delay(attempt * 500)
          }
        }
        if (lastError) throw lastError
        if (
          request.resolvePartialAfterMs &&
          results.size < request.queries.length &&
          firstCompletedAt > 0 &&
          Date.now() - firstCompletedAt >= request.resolvePartialAfterMs
        ) {
          break
        }
      }
      return results
    })
  } catch (cause) {
    throw classifyZhiziRemoteError(
      cause,
      request.settings.zhiziGpuType?.trim() || 'vip-share'
    )
  } finally {
    cleanup()
  }
}

async function queryZhiziSpawnGtpAnalysisBatch(request: ZhiziGtpAnalysisBatchRequest): Promise<Map<string, ZhiziGtpAnalysisResponse>> {
  if (!request.queries.length) return new Map()
  const command = buildZhiziGtpCommand(request.settings)
  const child = spawn(command[0], command.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] })
  const runId = request.runId || `zhizi-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const activeEntry: ActiveZhiziProcess = { group: request.group, cancelled: false, stop: () => child.kill() }
  activeZhiziProcesses.set(runId, activeEntry)

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk)
  })
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + String(chunk)).slice(-40_000)
  })
  let childBoardKey = ''

  function cleanup(): void {
    const current = activeZhiziProcesses.get(runId)
    if (current === activeEntry) activeZhiziProcesses.delete(runId)
  }

  function waitUntil(predicate: () => boolean, timeoutMs: number, description: string): Promise<void> {
    const started = Date.now()
    return new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        if (activeEntry.cancelled) {
          clearInterval(timer)
          reject(new Error('智子云分析已取消'))
          return
        }
        if (predicate()) {
          clearInterval(timer)
          resolve()
          return
        }
        if (Date.now() - started > timeoutMs) {
          clearInterval(timer)
          reject(new Error(`${description}超时。\n${redactZhiziLog(stderr.trim().slice(-1200))}`))
        }
      }, 50)
    })
  }

  async function sendCommands(commandLines: string[], description: string): Promise<string> {
    if (!commandLines.length) return ''
    const start = stdout.length
    child.stdin.write(`${commandLines.join('\n')}\n`)
    const timeoutMs = Math.max(10_000, commandLines.length * 600)
    await waitUntil(() => countGtpResponses(stdout.slice(start)) >= commandLines.length, timeoutMs, description)
    const text = stdout.slice(start)
    if (/(?:^|\n)\?/.test(text.trim())) {
      throw new Error(`${description}失败。\n${redactZhiziLog(text.trim().slice(0, 1200))}`)
    }
    return text
  }

  async function analyzeQuery(query: GtpQuery): Promise<ZhiziGtpAnalysisResponse> {
    const boardXSize = Math.max(2, Math.round(query.boardXSize || 19))
    const boardYSize = Math.max(2, Math.round(query.boardYSize || boardXSize))
    const boardKey = `${boardXSize}x${boardYSize}`
    const setupCommands: string[] = []
    if (childBoardKey !== boardKey) {
      setupCommands.push(
        boardXSize === boardYSize ? `boardsize ${boardXSize}` : `rectangular_boardsize ${boardXSize} ${boardYSize}`,
        'kata-set-rules chinese',
        'time_settings 0 5 1'
      )
      childBoardKey = boardKey
    }
    setupCommands.push(
      `komi ${Number.isFinite(query.komi) ? query.komi : 7.5}`,
      'clear_board'
    )
    for (const [color, point] of query.initialStones ?? []) {
      setupCommands.push(`play ${color} ${cleanVertex(point)}`)
    }
    for (const [color, point] of query.moves) {
      setupCommands.push(`play ${color} ${cleanVertex(point)}`)
    }
    await sendCommands(setupCommands, '智子云 GTP 初始化局面')
    const player = sideToMove(query)
    const allow = (query.allowMoves ?? [])
      .filter((entry) => entry.player && entry.moves?.length)
      .map((entry) => `allow ${entry.player} ${entry.moves.map(cleanVertex).join(',')} ${Math.max(1, Math.round(entry.untilDepth || 1))}`)
      .join(' ')
    const start = stdout.length
    const commandLine = `kata-analyze ${player} 8 rootInfo true maxmoves 20${allow ? ` ${allow}` : ''}`
    child.stdin.write(`${commandLine}\n`)
    const searchStartedAt = Date.now()
    const progressState = { lastVisits: 0, lastSampleAt: searchStartedAt }
    const durationMs = analysisMillis(query.maxVisits)
    while (Date.now() - searchStartedAt < durationMs) {
      await delay(300)
      if (activeEntry.cancelled) throw new Error('智子云分析已取消')
      emitAnalyzeProgress(request, query.id, player, stdout.slice(start), progressState, true)
    }
    child.stdin.write('\n')
    await waitUntil(() => hasGtpTerminator(stdout.slice(start)), 15_000, '智子云 kata-analyze')
    const response = parseKataAnalyzeInfo(stdout.slice(start), player, query.id)
    emitAnalyzeProgress(request, query.id, player, stdout.slice(start), progressState, false)
    request.onResponse?.(response)
    return response
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const results = new Map<string, ZhiziGtpAnalysisResponse>()
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      activeEntry.cancelled = true
      child.kill()
      cleanup()
      reject(new Error(`智子云分析超时。\n${redactZhiziLog(stderr.trim().slice(-1200))}`))
    }, request.timeoutMs ?? Math.max(240_000, request.queries.length * 9000))

    child.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      cleanup()
      reject(error)
    })
    child.once('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      cleanup()
      if (activeEntry.cancelled) reject(new Error('智子云分析已取消'))
      else reject(new Error(redactZhiziLog(stderr.trim()) || `智子云客户端退出: ${code}`))
    })

    ;(async () => {
      try {
        await waitUntil(() => /GTP ready|beginning main protocol loop/i.test(stderr + stdout), 90_000, '智子云 KataGo 启动')
        for (const rawQuery of request.queries) {
          const response = await analyzeQuery(asGtpQuery(rawQuery))
          if (response.id) {
            results.set(response.id, response)
          }
        }
        settled = true
        clearTimeout(timeout)
        child.stdin.write('quit\n')
        child.kill()
        cleanup()
        resolve(results)
      } catch (error) {
        settled = true
        clearTimeout(timeout)
        child.kill()
        cleanup()
        reject(error)
      }
    })().catch((error) => reject(error))
  })
}

export async function queryZhiziGtpAnalysisBatch(request: ZhiziGtpAnalysisBatchRequest): Promise<Map<string, ZhiziGtpAnalysisResponse>> {
  if (request.settings.zhiziToken.trim()) {
    try {
      return await queryZhiziSocketGtpAnalysisBatch(request)
    } catch (error) {
      if (!request.settings.zhiziClientBin.trim()) {
        throw error
      }
      console.warn('Zhizi direct Socket.IO engine failed; falling back to zz-ikatago connector.', error)
    }
  }
  if (request.settings.katagoEngineMode === 'zhizi' && !request.settings.zhiziClientBin.trim()) {
    throw new Error('智子云未登录：请先在设置里用账号密码或短信验证码登录智子云。登录成功后 GoAgent 会自动直连远程算力，不需要填写 zz-ikatago 路径。')
  }
  return queryZhiziSpawnGtpAnalysisBatch(request)
}
