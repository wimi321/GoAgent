import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { io, type Socket } from 'socket.io-client'
import type { AppSettings, GameMove, KataGoAnalysisGroup, ZhiziCloudGpuTier } from '@main/lib/types'

export type ZhiziGtpAnalysisResponse = Record<string, unknown> & {
  id?: string
  error?: string
  isDuringSearch?: boolean
  rootInfo?: {
    currentPlayer?: GameMove['color']
    winrate?: number
    scoreLead?: number
    scoreMean?: number
  }
  moveInfos?: Array<Record<string, unknown>>
}

export interface ZhiziGtpAnalysisBatchRequest {
  settings: AppSettings
  queries: Array<Record<string, unknown> & { id?: string }>
  runId?: string
  group?: KataGoAnalysisGroup
  timeoutMs?: number
  resolvePartialAfterMs?: number
  onResponse?: (response: ZhiziGtpAnalysisResponse) => void
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
const ZHIZI_SOCKET_TOKEN_URL = 'https://www.zhizigo.com/api/cluster/account/fetch-socketio-token'
const GTP_VALUE_KEYS = new Set([
  'move',
  'visits',
  'edgeVisits',
  'utility',
  'winrate',
  'scoreMean',
  'scoreStdev',
  'scoreLead',
  'scoreSelfplay',
  'prior',
  'lcb',
  'order',
  'pv',
  'pvVisits',
  'isSymmetryOf',
  'ownership',
  'ownershipStdev',
  'rootInfo'
])

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

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function zhiziGpuTypeForTier(tier: ZhiziCloudGpuTier): string {
  if (tier === 'deep') return '6x'
  if (tier === 'fast') return '3x'
  return '1x'
}

function hasOption(args: string[], option: string): boolean {
  return args.some((arg) => arg === option || arg.startsWith(`${option}=`))
}

function withoutUnsafeSocketArgs(args: string[]): string[] {
  const filtered: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--token' || arg.startsWith('--token=')) {
      if (arg === '--token') index += 1
      continue
    }
    if (arg === '--zz-socketio-token' || arg.startsWith('--zz-socketio-token=')) {
      if (arg === '--zz-socketio-token') index += 1
      continue
    }
    filtered.push(arg)
  }
  return filtered
}

export function buildZhiziSocketArgs(settings: AppSettings): string {
  const extraArgs = withoutUnsafeSocketArgs(splitCommandLine(settings.zhiziExtraArgs))
  const args: string[] = []
  if (!hasOption(extraArgs, '--platform')) {
    args.push('--platform', settings.zhiziPlatform.trim() || 'all')
  }
  if (!hasOption(extraArgs, '--engine-type')) {
    args.push('--engine-type', 'go')
  }
  if (!hasOption(extraArgs, '--gpu-type')) {
    args.push('--gpu-type', settings.zhiziGpuType.trim() || zhiziGpuTypeForTier(settings.zhiziGpuTier))
  }
  if (!hasOption(extraArgs, '--kata-name')) {
    args.push('--kata-name', settings.zhiziKataName.trim() || 'katago-TENSORRT')
  }
  if (!hasOption(extraArgs, '--kata-weight')) {
    args.push('--kata-weight', settings.zhiziKataWeight.trim() || '28bnbt')
  }
  args.push(...extraArgs)
  return args.map(shellQuote).join(' ')
}

function directSocketArgs(settings: AppSettings): string {
  return buildZhiziSocketArgs(settings)
}

function chunkToText(chunk: unknown): string {
  if (typeof chunk === 'string') return chunk
  if (Buffer.isBuffer(chunk)) return chunk.toString('utf8')
  if (chunk instanceof ArrayBuffer) return Buffer.from(chunk).toString('utf8')
  if (ArrayBuffer.isView(chunk)) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString('utf8')
  return String(chunk ?? '')
}

function redactZhiziLog(text: string): string {
  return text
    .replace(/zz-\d{4,}/g, 'zz-[redacted]')
    .replace(/(token=|--token\s+|zz-socketio-token[=:])\S+/gi, '$1[redacted]')
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

function normalizeRate(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (Math.abs(value) > 1.00001) return value / 10000
  return value
}

function numericToken(tokens: string[], index: number): number | undefined {
  const value = Number(tokens[index])
  return Number.isFinite(value) ? value : undefined
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

function isSocketConnectFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /Socket (连接失败|已断开)|websocket error|xhr poll error|transport error|timeout|KataGo 启动超时/i.test(message)
}

function isZhiziNoCreditError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /not_enough_credit|余额不足|not enough credit/i.test(message)
}

function zhiziNoCreditError(): Error {
  return new Error('智子云余额不足或当前没有可用算力，请在智子云确认额度后重试。')
}

function parseKeyValues(text: string): Record<string, number> {
  const tokens = text.split(/\s+/).filter(Boolean)
  const values: Record<string, number> = {}
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const key = tokens[i]
    const value = numericToken(tokens, i + 1)
    if (value === undefined) continue
    if (key === 'winrate' || key === 'prior' || key === 'lcb') values[key] = normalizeRate(value)
    else values[key] = value
    i += 1
  }
  return values
}

export function parseKataAnalyzeInfo(text: string, player: GameMove['color'], id: string): ZhiziGtpAnalysisResponse {
  const compact = text
    .replace(/\r/g, '\n')
    .replace(/^=.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  const rootInfoText = compact.match(/\brootInfo\s+(.+?)(?:\s+ownership\s+|$)/)?.[1] ?? ''
  const rootInfo = parseKeyValues(rootInfoText)
  const segments = compact.split(/\binfo\s+/).map((segment) => segment.trim()).filter(Boolean)
  const moveInfos: Array<Record<string, unknown>> = []

  for (const segment of segments) {
    const moveSegment = segment.split(/\brootInfo\b/)[0]
    const tokens = moveSegment.split(/\s+/).filter(Boolean)
    const info: Record<string, unknown> = {}
    for (let i = 0; i < tokens.length; i += 1) {
      const key = tokens[i]
      if (!GTP_VALUE_KEYS.has(key)) continue
      if (key === 'rootInfo' || key === 'ownership' || key === 'ownershipStdev') break
      if (key === 'pv') {
        const pv: string[] = []
        for (let j = i + 1; j < tokens.length; j += 1) {
          if (GTP_VALUE_KEYS.has(tokens[j])) break
          pv.push(tokens[j])
          i = j
        }
        info.pv = pv.slice(0, 24)
        continue
      }
      if (key === 'pvVisits') {
        const pvVisits: number[] = []
        for (let j = i + 1; j < tokens.length; j += 1) {
          if (GTP_VALUE_KEYS.has(tokens[j])) break
          const value = Number(tokens[j])
          if (Number.isFinite(value)) pvVisits.push(value)
          i = j
        }
        info.pvVisits = pvVisits.slice(0, 24)
        continue
      }
      if (key === 'move' || key === 'isSymmetryOf') {
        info[key] = tokens[i + 1] ?? ''
        i += 1
        continue
      }
      const value = numericToken(tokens, i + 1)
      if (value !== undefined) {
        if (key === 'winrate' || key === 'prior' || key === 'lcb') info[key] = normalizeRate(value)
        else info[key] = value
        i += 1
      }
    }
    if (typeof info.move === 'string' && info.move) {
      moveInfos.push(info)
    }
  }

  moveInfos.sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999))
  const best = moveInfos[0]
  if (!best) {
    return {
      id,
      error: '智子云 KataGo GTP 没有返回候选点。',
      rootInfo: { currentPlayer: player, winrate: 0.5, scoreLead: 0 },
      moveInfos: []
    }
  }
  return {
    id,
    rootInfo: {
      currentPlayer: player,
      winrate: Number(rootInfo.winrate ?? best.winrate ?? 0.5),
      scoreLead: Number(rootInfo.scoreLead ?? rootInfo.scoreMean ?? best.scoreLead ?? best.scoreMean ?? 0),
      scoreMean: Number(rootInfo.scoreMean ?? rootInfo.scoreLead ?? best.scoreMean ?? best.scoreLead ?? 0)
    },
    moveInfos
  }
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

async function fetchZhiziSocketToken(token: string, args: string): Promise<{ socketIOURL: string; token: string }> {
  let response: Response
  try {
    response = await fetch(ZHIZI_SOCKET_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ args })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`智子云连接令牌获取失败：网络连接中断，请稍后重试。${message ? ` (${redactZhiziLog(message)})` : ''}`)
  }
  const rawText = await response.text()
  let json: Record<string, unknown> = {}
  try {
    json = rawText ? JSON.parse(rawText) as Record<string, unknown> : {}
  } catch {
    json = {}
  }
  if (!response.ok) {
    const key = String(json.key ?? json.error ?? json.message ?? '').trim()
    if (response.status === 401 || /invalid|token|auth/i.test(key)) {
      throw new Error('智子云 token 已失效，请重新登录。')
    }
    if (/not_enough_credit|credit/i.test(key)) {
      throw zhiziNoCreditError()
    }
    throw new Error(`智子云连接令牌获取失败：HTTP ${response.status}${key ? ` · ${key}` : ''}`)
  }
  const socketIOURL = typeof json.socketIOURL === 'string' ? json.socketIOURL.trim() : ''
  const socketToken = typeof json.token === 'string' ? json.token.trim() : ''
  if (!socketIOURL || !socketToken) {
    throw new Error('智子云连接令牌响应不完整，请稍后重试。')
  }
  return { socketIOURL, token: socketToken }
}

async function queryZhiziSocketGtpAnalysisBatch(request: ZhiziGtpAnalysisBatchRequest): Promise<Map<string, ZhiziGtpAnalysisResponse>> {
  const token = request.settings.zhiziToken.trim()
  if (!token) {
    throw new Error('智子云未登录：请先在 GoAgent 中输入账号密码登录。')
  }

  const runId = request.runId || `zhizi-direct-${Date.now()}-${Math.random().toString(36).slice(2)}`
  let socket: Socket | null = null
  const activeEntry: ActiveZhiziProcess = {
    group: request.group,
    cancelled: false,
    stop: () => socket?.disconnect()
  }
  activeZhiziProcesses.set(runId, activeEntry)

  let stdout = ''
  let stderr = ''
  let socketError: Error | null = null
  let closing = false

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
        if (socketError) {
          clearInterval(timer)
          reject(socketError)
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

  function sendRaw(text: string): void {
    if (!socket?.connected) {
      throw new Error('智子云 Socket 未连接。')
    }
    socket.emit('stdin', text)
  }

  async function sendCommands(commandLines: string[], description: string): Promise<string> {
    if (!commandLines.length) return ''
    const start = stdout.length
    sendRaw(`${commandLines.join('\n')}\n`)
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
    const setupCommands = [
      boardXSize === boardYSize ? `boardsize ${boardXSize}` : `rectangular_boardsize ${boardXSize} ${boardYSize}`,
      'clear_board',
      `komi ${Number.isFinite(query.komi) ? query.komi : 7.5}`
    ]
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
    sendRaw(`${commandLine}\n`)
    await new Promise((resolve) => setTimeout(resolve, analysisMillis(query.maxVisits)))
    sendRaw('\n')
    await waitUntil(() => hasGtpTerminator(stdout.slice(start)), 15_000, '智子云 kata-analyze')
    const response = parseKataAnalyzeInfo(stdout.slice(start), player, query.id)
    request.onResponse?.(response)
    return response
  }

  try {
    let connected = false
    const maxConnectAttempts = 3
    for (let attempt = 1; attempt <= maxConnectAttempts; attempt += 1) {
      if (activeEntry.cancelled) throw new Error('智子云分析已取消')
      stdout = ''
      stderr = ''
      socketError = null
      socket?.disconnect()
      const socketInfo = await fetchZhiziSocketToken(token, directSocketArgs(request.settings))
      socket = io(socketInfo.socketIOURL, {
        path: '/socket.io.v4',
        query: { 'zz-socketio-token': socketInfo.token },
        transports: ['websocket'],
        timeout: 20_000,
        reconnection: false,
        forceNew: true
      })
      socket.on('stdout', (chunk) => {
        stdout += chunkToText(chunk)
      })
      socket.on('stderr', (chunk) => {
        stderr = (stderr + chunkToText(chunk)).slice(-40_000)
      })
      socket.on('connect_error', (error) => {
        socketError = new Error(`智子云 Socket 连接失败：${error.message}`)
      })
      socket.on('disconnect', (reason) => {
        if (!closing && !activeEntry.cancelled) {
          const tail = redactZhiziLog(stderr.trim().slice(-1200))
          socketError = /not_enough_credit|not enough credit/i.test(tail)
            ? zhiziNoCreditError()
            : new Error(`智子云 Socket 已断开：${reason}\n${tail}`)
        }
      })
      try {
        await waitUntil(() => /GTP ready|beginning main protocol loop/i.test(stderr + stdout), 90_000, '智子云 KataGo 启动')
        connected = true
        break
      } catch (error) {
        socket?.disconnect()
        if (isZhiziNoCreditError(error)) {
          throw zhiziNoCreditError()
        }
        if (attempt >= maxConnectAttempts || !isSocketConnectFailure(error)) {
          throw error
        }
        console.warn(`Zhizi direct Socket.IO connect attempt ${attempt} failed; retrying.`, error)
        await delay(800 * attempt)
      }
    }
    if (!connected) {
      throw new Error('智子云 Socket 连接失败，请稍后重试。')
    }
    const results = new Map<string, ZhiziGtpAnalysisResponse>()
    for (const rawQuery of request.queries) {
      const response = await analyzeQuery(asGtpQuery(rawQuery))
      if (response.id) results.set(response.id, response)
    }
    closing = true
    if (socket?.connected) {
      socket.emit('stdin', 'quit\n')
    }
    socket?.disconnect()
    cleanup()
    return results
  } catch (error) {
    closing = true
    activeEntry.cancelled = true
    socket?.disconnect()
    cleanup()
    throw error
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
    const setupCommands = [
      boardXSize === boardYSize ? `boardsize ${boardXSize}` : `rectangular_boardsize ${boardXSize} ${boardYSize}`,
      'clear_board',
      `komi ${Number.isFinite(query.komi) ? query.komi : 7.5}`
    ]
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
    await new Promise((resolve) => setTimeout(resolve, analysisMillis(query.maxVisits)))
    child.stdin.write('\n')
    await waitUntil(() => hasGtpTerminator(stdout.slice(start)), 15_000, '智子云 kata-analyze')
    const response = parseKataAnalyzeInfo(stdout.slice(start), player, query.id)
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
