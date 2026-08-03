import type { AppSettings, GameMove, KataGoAnalysisGroup } from '@main/lib/types'
import {
  classifyZhiziRemoteError,
  getZhiziPersistentSession,
  redactZhiziText,
  type ZhiziPersistentSession
} from './zhiziSocketSession'
import {
  buildZhiziRemoteArgs,
  findGtpCommandResponse,
  formatGtpCommand,
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

interface ActiveZhiziAnalysis {
  group?: KataGoAnalysisGroup
  cancelled: boolean
  stop: () => void
}

type GtpQuery = {
  id: string
  moves: Array<[GameMove['color'], string]>
  initialStones: Array<[GameMove['color'], string]>
  initialPlayer: GameMove['color']
  boardXSize: number
  boardYSize: number
  komi: number
  maxVisits: number
  allowMoves?: Array<{
    player: GameMove['color']
    moves: string[]
    untilDepth: number
  }>
}

const activeZhiziAnalyses = new Map<string, ActiveZhiziAnalysis>()
const GTP_SETUP_TIMEOUT_MS = 60_000

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function cleanVertex(move: string): string {
  return String(move || '').trim() || 'pass'
}

function opposite(color: GameMove['color']): GameMove['color'] {
  return color === 'B' ? 'W' : 'B'
}

function sideToMove(query: GtpQuery): GameMove['color'] {
  const lastMove = query.moves.at(-1)
  return lastMove ? opposite(lastMove[0]) : query.initialPlayer
}

function asGtpQuery(query: Record<string, unknown> & { id?: string }): GtpQuery {
  return {
    id: query.id || `zhizi-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    moves: Array.isArray(query.moves) ? query.moves as Array<[GameMove['color'], string]> : [],
    initialStones: Array.isArray(query.initialStones) ? query.initialStones as Array<[GameMove['color'], string]> : [],
    initialPlayer: query.initialPlayer === 'W' ? 'W' : 'B',
    boardXSize: Math.max(2, Math.round(Number(query.boardXSize ?? 19))),
    boardYSize: Math.max(2, Math.round(Number(query.boardYSize ?? query.boardXSize ?? 19))),
    komi: Number.isFinite(Number(query.komi)) ? Number(query.komi) : 7.5,
    maxVisits: Math.max(1, Math.round(Number(query.maxVisits ?? 120))),
    allowMoves: Array.isArray(query.allowMoves) ? query.allowMoves as GtpQuery['allowMoves'] : undefined
  }
}

function emitAnalyzeProgress(
  request: ZhiziGtpAnalysisBatchRequest,
  queryId: string,
  player: GameMove['color'],
  text: string,
  state: { lastVisits: number; lastSampleAt: number },
  isDuringSearch: boolean
): ZhiziGtpAnalysisResponse | null {
  if (!/\binfo\s+/.test(text)) return null
  const response = parseKataAnalyzeInfo(text, player, queryId)
  if (response.error || !response.moveInfos?.length) return null
  const visits = zhiziResponseVisitTotal(response)
  if (visits > state.lastVisits) {
    const now = Date.now()
    const elapsedSeconds = Math.max(0.1, (now - state.lastSampleAt) / 1000)
    const visitsPerSecond = (visits - state.lastVisits) / elapsedSeconds
    state.lastVisits = visits
    state.lastSampleAt = now
    request.onResponse?.({ ...response, isDuringSearch })
    request.onSearchProgress?.({
      id: queryId,
      visits,
      visitsPerSecond,
      isDuringSearch
    })
  }
  return response
}

export function zhiziGtpConfigured(settings: AppSettings): boolean {
  return Boolean(settings.zhiziToken.trim())
}

export function shouldPreferZhiziGtpEngine(settings: AppSettings, _localReady: boolean): boolean {
  return settings.katagoEngineMode === 'zhizi' && zhiziGtpConfigured(settings)
}

export function cancelZhiziGtpAnalysis(
  filter: { runId?: string; group?: KataGoAnalysisGroup }
): { cancelled: number } {
  let cancelled = 0
  for (const [id, entry] of activeZhiziAnalyses.entries()) {
    const matchesRun = filter.runId ? id === filter.runId : true
    const matchesGroup = filter.group ? entry.group === filter.group : true
    if (!matchesRun || !matchesGroup) continue
    entry.cancelled = true
    entry.stop()
    cancelled += 1
  }
  return { cancelled }
}

async function queryZhiziSocketGtpAnalysisBatch(
  request: ZhiziGtpAnalysisBatchRequest
): Promise<Map<string, ZhiziGtpAnalysisResponse>> {
  if (!request.queries.length) return new Map()
  const accountToken = request.settings.zhiziToken.trim()
  if (!accountToken) throw new Error('智子云未登录，请先登录后再启用远程分析。')

  const runId = request.runId || `zhizi-direct-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const controller = new AbortController()
  const activeEntry: ActiveZhiziAnalysis = {
    group: request.group,
    cancelled: false,
    stop: () => controller.abort()
  }
  activeZhiziAnalyses.set(runId, activeEntry)

  const session = getZhiziPersistentSession({
    accountToken,
    args: buildZhiziRemoteArgs(request.settings),
    gpuType: request.settings.zhiziGpuType
  })
  const deadline = Date.now() + (request.timeoutMs ?? Math.max(240_000, request.queries.length * 9_000))
  let nextCommandId = 1

  async function sendCommand(
    channel: ZhiziPersistentSession,
    command: string,
    description: string,
    timeoutMs = GTP_SETUP_TIMEOUT_MS
  ): Promise<void> {
    const id = nextCommandId++
    const start = channel.output().stdout.length
    const disconnectVersion = channel.captureDisconnectVersion()
    const generation = channel.captureGeneration()
    channel.send(formatGtpCommand(id, command))
    await channel.waitUntil(
      () => Boolean(findGtpCommandResponse(channel.output().stdout.slice(start), id)),
      timeoutMs,
      description,
      controller.signal,
      disconnectVersion
    )
    if (channel.captureGeneration() !== generation) {
      throw new Error('智子云会话已经更新，已丢弃旧会话响应。')
    }
    const response = findGtpCommandResponse(channel.output().stdout.slice(start), id)
    if (!response?.ok) {
      throw new Error(`${description}失败。${response?.firstLine ? ` ${redactZhiziText(response.firstLine)}` : ''}`)
    }
  }

  async function synchronizeBoard(channel: ZhiziPersistentSession, query: GtpQuery): Promise<void> {
    const boardCommand = query.boardXSize === query.boardYSize
      ? `boardsize ${query.boardXSize}`
      : `rectangular_boardsize ${query.boardXSize} ${query.boardYSize}`
    const commands = [
      boardCommand,
      'kata-set-rules chinese',
      'time_settings 0 5 1',
      `komi ${query.komi}`,
      'clear_board',
      ...query.initialStones.map(([color, point]) => `play ${color} ${cleanVertex(point)}`),
      ...query.moves.map(([color, point]) => `play ${color} ${cleanVertex(point)}`)
    ]
    for (const command of commands) {
      await sendCommand(channel, command, '同步远程棋盘')
    }
  }

  async function analyzeQuery(
    channel: ZhiziPersistentSession,
    query: GtpQuery
  ): Promise<ZhiziGtpAnalysisResponse> {
    channel.clearOutput()
    await synchronizeBoard(channel, query)
    const player = sideToMove(query)
    const allow = (query.allowMoves ?? [])
      .filter((entry) => entry.player && entry.moves.length)
      .map((entry) => `allow ${entry.player} ${entry.moves.map(cleanVertex).join(',')} ${Math.max(1, Math.round(entry.untilDepth || 1))}`)
      .join(' ')
    const analyzeId = nextCommandId++
    const start = channel.output().stdout.length
    const disconnectVersion = channel.captureDisconnectVersion()
    const generation = channel.captureGeneration()
    channel.send(formatGtpCommand(
      analyzeId,
      `kata-analyze ${player} 25 rootInfo true maxmoves 20${allow ? ` ${allow}` : ''}`
    ))
    const startedAt = Date.now()
    const progress = { lastVisits: 0, lastSampleAt: startedAt }
    const timeoutMs = Math.max(15_000, Math.min(120_000, query.maxVisits * 220))
    let latest: ZhiziGtpAnalysisResponse | null = null

    while (Date.now() - startedAt < timeoutMs && Date.now() < deadline) {
      if (controller.signal.aborted || activeEntry.cancelled) {
        throw new Error('智子云分析已取消。')
      }
      if (channel.captureDisconnectVersion() !== disconnectVersion || channel.captureGeneration() !== generation) {
        throw new Error('智子云连接在分析过程中断开。')
      }
      await delay(80)
      const output = channel.output().stdout.slice(start)
      const parsed = emitAnalyzeProgress(request, query.id, player, output, progress, true)
      if (!parsed) continue
      latest = parsed
      if (zhiziAnalysisReachedVisits(parsed, query.maxVisits)) break
    }
    if (!latest?.moveInfos?.length) {
      throw new Error('智子云已连接，但没有返回候选点。')
    }

    const stopId = nextCommandId++
    channel.send(formatGtpCommand(stopId, 'stop'))
    await channel.waitUntil(
      () => {
        const output = channel.output().stdout.slice(start)
        return Boolean(findGtpCommandResponse(output, analyzeId) || findGtpCommandResponse(output, stopId))
      },
      12_000,
      '停止远程分析',
      controller.signal,
      disconnectVersion
    )
    if (channel.captureGeneration() !== generation) {
      throw new Error('智子云会话已经更新，已丢弃旧会话结果。')
    }
    const finalOutput = channel.output().stdout.slice(start)
    const final = parseKataAnalyzeInfo(finalOutput, player, query.id)
    const result = final.moveInfos?.length ? final : latest
    emitAnalyzeProgress(request, query.id, player, finalOutput, progress, false)
    request.onResponse?.(result)
    return result
  }

  try {
    return await session.runExclusive(controller.signal, async (channel) => {
      const results = new Map<string, ZhiziGtpAnalysisResponse>()
      let firstCompletedAt = 0
      for (const rawQuery of request.queries) {
        const query = asGtpQuery(rawQuery)
        let lastError: ReturnType<typeof classifyZhiziRemoteError> | null = null
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            if (attempt > 1) {
              nextCommandId = 1
              await channel.restart(controller.signal)
            }
            const response = await analyzeQuery(channel, query)
            results.set(query.id, response)
            firstCompletedAt ||= Date.now()
            lastError = null
            break
          } catch (cause) {
            lastError = classifyZhiziRemoteError(cause, request.settings.zhiziGpuType)
            if (!lastError.retryable || lastError.code === 'cancelled' || activeEntry.cancelled || attempt >= 3) {
              throw lastError
            }
            await delay(attempt * 500)
          }
        }
        if (lastError) throw lastError
        if (
          request.resolvePartialAfterMs &&
          results.size < request.queries.length &&
          firstCompletedAt &&
          Date.now() - firstCompletedAt >= request.resolvePartialAfterMs
        ) break
      }
      return results
    })
  } catch (cause) {
    throw classifyZhiziRemoteError(cause, request.settings.zhiziGpuType)
  } finally {
    if (activeZhiziAnalyses.get(runId) === activeEntry) activeZhiziAnalyses.delete(runId)
  }
}

export async function queryZhiziGtpAnalysisBatch(
  request: ZhiziGtpAnalysisBatchRequest
): Promise<Map<string, ZhiziGtpAnalysisResponse>> {
  if (!request.settings.zhiziToken.trim()) {
    throw new Error('智子云未登录，请先在设置中登录并检测连接。')
  }
  return queryZhiziSocketGtpAnalysisBatch(request)
}
