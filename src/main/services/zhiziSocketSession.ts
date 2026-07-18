import { createHash } from 'node:crypto'
import { io } from 'socket.io-client'

export type ZhiziRemoteErrorCode =
  | 'cancelled'
  | 'auth'
  | 'entitlement'
  | 'capacity'
  | 'network'
  | 'timeout'
  | 'protocol'
  | 'unknown'

export type ZhiziSessionState =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'reconnecting'
  | 'error'
  | 'closed'

export interface ZhiziSocketToken {
  socketIOURL: string
  token: string
}

export interface ZhiziSocketLike {
  connected: boolean
  active?: boolean
  on: (event: string, listener: (...args: unknown[]) => void) => unknown
  emit: (event: string, ...args: unknown[]) => unknown
  connect: () => unknown
  disconnect: () => unknown
  removeAllListeners: () => unknown
}

export interface ZhiziSessionConfig {
  accountToken: string
  args: string
  gpuType: string
}

export interface ZhiziSessionTelemetry {
  state: ZhiziSessionState
  connected: boolean
  ready: boolean
  reusedConnections: number
  connectionCount: number
  lastReadyMillis: number
  lastErrorCode?: ZhiziRemoteErrorCode
  lastError?: string
}

interface ZhiziSessionDependencies {
  fetchSocketToken: (accountToken: string, args: string) => Promise<ZhiziSocketToken>
  createSocket: (url: string, options: Record<string, unknown>) => ZhiziSocketLike
  sleep: (milliseconds: number) => Promise<void>
  now: () => number
}

const READY_TIMEOUT_MS = 60_000
const RECONNECT_WAIT_MS = 8_000
const READY_FALLBACK_MS = 4_000
const MAX_START_ATTEMPTS = 3
const OUTPUT_LIMIT = 8 * 1024 * 1024
const VIP_IDLE_TIMEOUT_MS = 5 * 60_000
const ON_DEMAND_IDLE_TIMEOUT_MS = 90_000

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function decodeZhiziSocketPayload(payload: unknown): string {
  if (typeof payload === 'string') return payload
  if (Buffer.isBuffer(payload)) return payload.toString('utf8')
  if (payload instanceof ArrayBuffer) return Buffer.from(payload).toString('utf8')
  if (ArrayBuffer.isView(payload)) {
    return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).toString('utf8')
  }
  if (Array.isArray(payload) && payload.every((item) => Number.isInteger(item))) {
    return Buffer.from(payload).toString('utf8')
  }
  if (payload && typeof payload === 'object') {
    const object = payload as { type?: unknown; data?: unknown }
    if (object.type === 'Buffer' && Array.isArray(object.data)) {
      return Buffer.from(object.data).toString('utf8')
    }
  }
  return String(payload ?? '')
}

export function redactZhiziText(text: string): string {
  return text
    .replace(/zz[-_][A-Za-z0-9_-]{4,}/g, 'zz-[redacted]')
    .replace(/(Bearer\s+|token=|--token\s+|zz-socketio-token[=:])\S+/gi, '$1[redacted]')
}

export class ZhiziRemoteError extends Error {
  readonly code: ZhiziRemoteErrorCode
  readonly retryable: boolean

  constructor(code: ZhiziRemoteErrorCode, message: string, retryable: boolean) {
    super(message)
    this.name = 'ZhiziRemoteError'
    this.code = code
    this.retryable = retryable
  }
}

export function classifyZhiziRemoteError(
  cause: unknown,
  gpuType = 'vip-share'
): ZhiziRemoteError {
  if (cause instanceof ZhiziRemoteError) return cause
  const raw = redactZhiziText(cause instanceof Error ? cause.message : String(cause))
  const text = raw.toLowerCase()

  if (/cancel|取消|aborted/.test(text)) {
    return new ZhiziRemoteError('cancelled', '智子云分析已取消。', false)
  }
  if (/401|invalid.?token|token.?expired|token 已失效|unauthorized|登录失效/.test(text)) {
    return new ZhiziRemoteError('auth', '智子云登录已失效，请重新登录。', false)
  }
  if (/not_enough_credit|not enough credit|余额不足/.test(text)) {
    if (gpuType === 'vip-share') {
      return new ZhiziRemoteError(
        'entitlement',
        '智子云暂未给当前账号分配 VIP 共享引擎。GoAgent 已使用 VIP 专用参数，这不是独享余额判断；请重新登录后再试，仍失败时请在智子官方 App 确认 VIP 与连接账号已同步。',
        true
      )
    }
    return new ZhiziRemoteError(
      'entitlement',
      '智子云独享算力余额不足或当前档位不可用，请在智子官方 App 确认余额和算力档位。',
      false
    )
  }
  if (
    /no worker|worker unavailable|worker busy|没有可用.*worker|暂无.*算力|无可用.*算力|capacity/.test(text)
  ) {
    return new ZhiziRemoteError(
      'capacity',
      '智子云当前没有空闲算力，GoAgent 会自动重试；如果持续出现，请稍后再试或暂时切回本机分析。',
      true
    )
  }
  if (/403|forbidden|permission|无权限|未开通|套餐/.test(text)) {
    return new ZhiziRemoteError(
      'entitlement',
      '当前智子账号没有所选远程算力的使用权限，请在智子官方 App 确认套餐和连接账号。',
      false
    )
  }
  if (/timeout|timed out|超时/.test(text)) {
    return new ZhiziRemoteError(
      'timeout',
      '智子云连接超时，请检查网络后重试；当前本机分析设置不会被修改。',
      true
    )
  }
  if (
    /websocket|xhr poll|transport|econn|socket|network|fetch failed|连接中断|连接失败|已断开/.test(text)
  ) {
    return new ZhiziRemoteError(
      'network',
      '智子云网络连接中断，GoAgent 会自动重连；如果持续失败，请检查网络后重试。',
      true
    )
  }
  if (/gtp|unknown command|protocol|候选点|返回内容/.test(text)) {
    return new ZhiziRemoteError('protocol', raw || '智子云远程 KataGo 返回了无法识别的结果。', true)
  }
  return new ZhiziRemoteError('unknown', raw || '智子云远程分析失败。', true)
}

export function zhiziStartupRetryDelayMs(completedAttempt: number): number {
  if (completedAttempt <= 1) return 1_500
  if (completedAttempt === 2) return 4_000
  return 10_000
}

async function fetchSocketTokenOnce(
  accountToken: string,
  args: string
): Promise<ZhiziSocketToken> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(
      'https://www.zhizigo.com/api/cluster/account/fetch-socketio-token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accountToken}`
        },
        body: JSON.stringify({ args }),
        signal: controller.signal
      }
    )
    const rawText = await response.text()
    let body: Record<string, unknown> = {}
    try {
      body = rawText ? JSON.parse(rawText) as Record<string, unknown> : {}
    } catch {
      if (!response.ok) {
        throw classifyZhiziRemoteError(`HTTP ${response.status} ${rawText.slice(0, 240)}`)
      }
      const contentType = response.headers.get('content-type') ?? 'unknown'
      const preview = redactZhiziText(rawText.replace(/\s+/g, ' ').trim().slice(0, 180))
      throw new ZhiziRemoteError(
        'protocol',
        `智子云连接接口返回了无法识别的内容（HTTP ${response.status} · ${contentType}）。${preview ? ` ${preview}` : ''}`,
        true
      )
    }
    if (!response.ok) {
      const detail = String(body.key ?? body.error ?? body.message ?? rawText).slice(0, 240)
      throw classifyZhiziRemoteError(`HTTP ${response.status} ${detail}`)
    }
    const socketIOURL = typeof body.socketIOURL === 'string' ? body.socketIOURL.trim() : ''
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!socketIOURL || !token) {
      throw new ZhiziRemoteError(
        'protocol',
        '智子云连接信息不完整，请稍后重试。',
        true
      )
    }
    return { socketIOURL, token }
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new ZhiziRemoteError('timeout', '智子云连接令牌获取超时。', true)
    }
    throw classifyZhiziRemoteError(cause)
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchZhiziSocketToken(
  accountToken: string,
  args: string
): Promise<ZhiziSocketToken> {
  let lastError: ZhiziRemoteError | null = null
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await fetchSocketTokenOnce(accountToken, args)
    } catch (cause) {
      lastError = classifyZhiziRemoteError(cause)
      if (!lastError.retryable || attempt >= 2) throw lastError
      await sleep(650)
    }
  }
  throw lastError ?? new ZhiziRemoteError('unknown', '智子云连接令牌获取失败。', true)
}

const defaultDependencies: ZhiziSessionDependencies = {
  fetchSocketToken: fetchZhiziSocketToken,
  createSocket: (url, options) => io(url, options) as unknown as ZhiziSocketLike,
  sleep,
  now: Date.now
}

export class ZhiziPersistentSession {
  private readonly config: ZhiziSessionConfig
  private readonly dependencies: ZhiziSessionDependencies
  private socket: ZhiziSocketLike | null = null
  private state: ZhiziSessionState = 'idle'
  private ready = false
  private everReady = false
  private closed = false
  private connectionPromise: Promise<void> | null = null
  private queueTail: Promise<void> = Promise.resolve()
  private stdout = ''
  private stderr = ''
  private lastError: ZhiziRemoteError | null = null
  private connectionCount = 0
  private reusedConnections = 0
  private lastReadyMillis = 0
  private disconnectVersion = 0
  private connectErrorCount = 0
  private readyFallbackTimer: NodeJS.Timeout | null = null
  private idleTimer: NodeJS.Timeout | null = null

  constructor(
    config: ZhiziSessionConfig,
    dependencies: Partial<ZhiziSessionDependencies> = {}
  ) {
    this.config = config
    this.dependencies = { ...defaultDependencies, ...dependencies }
  }

  get isClosed(): boolean {
    return this.closed
  }

  telemetry(): ZhiziSessionTelemetry {
    return {
      state: this.state,
      connected: Boolean(this.socket?.connected),
      ready: this.ready,
      reusedConnections: this.reusedConnections,
      connectionCount: this.connectionCount,
      lastReadyMillis: this.lastReadyMillis,
      lastErrorCode: this.lastError?.code,
      lastError: this.lastError?.message
    }
  }

  clearOutput(): void {
    this.stdout = ''
    this.stderr = ''
  }

  output(): { stdout: string; stderr: string } {
    return { stdout: this.stdout, stderr: this.stderr }
  }

  captureDisconnectVersion(): number {
    return this.disconnectVersion
  }

  send(command: string): void {
    if (this.closed) {
      throw new ZhiziRemoteError('network', '智子云连接已经关闭。', true)
    }
    if (!this.socket?.connected || !this.ready) {
      throw this.lastError ?? new ZhiziRemoteError('network', '智子云连接尚未准备好。', true)
    }
    this.socket.emit('stdin', command)
  }

  async waitUntil(
    predicate: () => boolean,
    timeoutMs: number,
    description: string,
    signal: AbortSignal,
    expectedDisconnectVersion = this.disconnectVersion
  ): Promise<void> {
    const started = this.dependencies.now()
    while (true) {
      if (signal.aborted) throw new ZhiziRemoteError('cancelled', '智子云分析已取消。', false)
      if (this.closed) {
        throw new ZhiziRemoteError('cancelled', '智子云连接已释放。', false)
      }
      if (this.disconnectVersion !== expectedDisconnectVersion) {
        throw new ZhiziRemoteError('network', '智子云连接在分析过程中断开。', true)
      }
      if (predicate()) return
      if (this.dependencies.now() - started >= timeoutMs) {
        const stderrDetail = redactZhiziText(this.stderr.trim().slice(-800))
        const stdoutDetail = redactZhiziText(this.stdout.trim().slice(-800))
        const detail = [stderrDetail, stdoutDetail].filter(Boolean).join(' | ')
        throw new ZhiziRemoteError(
          'timeout',
          `${description}超时。${detail ? ` ${detail}` : ''}`,
          true
        )
      }
      await this.dependencies.sleep(40)
    }
  }

  async runExclusive<T>(
    signal: AbortSignal,
    operation: (session: ZhiziPersistentSession) => Promise<T>
  ): Promise<T> {
    const previous = this.queueTail
    let release: () => void = () => undefined
    this.queueTail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    this.clearIdleTimer()
    try {
      if (signal.aborted) throw new ZhiziRemoteError('cancelled', '智子云分析已取消。', false)
      const wasReady = this.ready && Boolean(this.socket?.connected)
      await this.ensureReady(signal)
      if (wasReady) this.reusedConnections += 1
      const onAbort = (): void => this.interrupt()
      signal.addEventListener('abort', onAbort, { once: true })
      try {
        return await operation(this)
      } finally {
        signal.removeEventListener('abort', onAbort)
      }
    } finally {
      release()
      this.scheduleIdleClose()
    }
  }

  async restart(signal: AbortSignal): Promise<void> {
    this.disposeSocket(false)
    this.state = 'idle'
    this.lastError = null
    await this.ensureReady(signal)
  }

  interrupt(): void {
    if (this.socket?.connected && this.ready) {
      this.socket.emit('stdin', 'stop\n')
    }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.state = 'closed'
    this.disconnectVersion += 1
    this.clearIdleTimer()
    this.disposeSocket(true)
  }

  private async ensureReady(signal: AbortSignal): Promise<void> {
    if (this.closed) throw new ZhiziRemoteError('network', '智子云连接已经关闭。', true)
    if (this.ready && this.socket?.connected) return

    if (this.socket && this.everReady && !this.ready) {
      try {
        await this.waitForExistingReconnect(signal)
        if (this.ready && this.socket?.connected) return
      } catch (cause) {
        if (classifyZhiziRemoteError(cause, this.config.gpuType).code === 'cancelled') throw cause
        this.disposeSocket(false)
      }
    }

    if (!this.connectionPromise) {
      this.connectionPromise = this.startWithRetries(signal).finally(() => {
        this.connectionPromise = null
      })
    }
    await this.connectionPromise
  }

  private async waitForExistingReconnect(signal: AbortSignal): Promise<void> {
    const started = this.dependencies.now()
    while (this.dependencies.now() - started < RECONNECT_WAIT_MS) {
      if (signal.aborted) throw new ZhiziRemoteError('cancelled', '智子云分析已取消。', false)
      if (this.ready && this.socket?.connected) return
      await this.dependencies.sleep(50)
    }
    throw new ZhiziRemoteError('network', '智子云自动重连未及时恢复。', true)
  }

  private async startWithRetries(signal: AbortSignal): Promise<void> {
    let lastError: ZhiziRemoteError | null = null
    for (let attempt = 1; attempt <= MAX_START_ATTEMPTS; attempt += 1) {
      if (signal.aborted) throw new ZhiziRemoteError('cancelled', '智子云分析已取消。', false)
      try {
        await this.startAttempt(signal)
        return
      } catch (cause) {
        lastError = classifyZhiziRemoteError(cause, this.config.gpuType)
        this.lastError = lastError
        this.state = 'error'
        this.disposeSocket(false)
        if (!lastError.retryable || attempt >= MAX_START_ATTEMPTS) throw lastError
        await this.dependencies.sleep(zhiziStartupRetryDelayMs(attempt))
      }
    }
    throw lastError ?? new ZhiziRemoteError('unknown', '智子云连接失败。', true)
  }

  private async startAttempt(signal: AbortSignal): Promise<void> {
    this.state = 'connecting'
    this.ready = false
    this.lastError = null
    this.connectErrorCount = 0
    this.clearOutput()

    const socketToken = await this.dependencies.fetchSocketToken(
      this.config.accountToken,
      this.config.args
    )
    if (signal.aborted) throw new ZhiziRemoteError('cancelled', '智子云分析已取消。', false)

    const socket = this.dependencies.createSocket(socketToken.socketIOURL, {
      path: '/socket.io.v4',
      query: { 'zz-socketio-token': socketToken.token },
      transports: ['websocket'],
      timeout: 30_000,
      reconnection: true,
      reconnectionAttempts: Number.POSITIVE_INFINITY,
      reconnectionDelay: 1_200,
      reconnectionDelayMax: 8_000,
      forceNew: true,
      autoConnect: false
    })
    this.socket = socket
    this.connectionCount += 1
    this.attachSocketListeners(socket)
    socket.connect()

    const started = this.dependencies.now()
    while (this.dependencies.now() - started < READY_TIMEOUT_MS) {
      if (signal.aborted) throw new ZhiziRemoteError('cancelled', '智子云分析已取消。', false)
      if (this.ready && socket.connected) {
        this.lastReadyMillis = this.dependencies.now() - started
        return
      }
      const connectionError = this.lastError as ZhiziRemoteError | null
      if (connectionError && (!connectionError.retryable || this.connectErrorCount >= 3)) {
        throw connectionError
      }
      await this.dependencies.sleep(50)
    }
    throw this.lastError ?? new ZhiziRemoteError('timeout', '智子云远程引擎启动超时。', true)
  }

  private attachSocketListeners(socket: ZhiziSocketLike): void {
    const isCurrent = (): boolean => this.socket === socket && !this.closed
    socket.on('connect', () => {
      if (!isCurrent()) return
      this.connectErrorCount = 0
      this.lastError = null
      this.state = this.everReady ? 'reconnecting' : 'connecting'
      if (this.everReady) this.scheduleReadyFallback(socket)
    })
    socket.on('ready', () => {
      if (!isCurrent()) return
      this.markReady()
    })
    socket.on('stdout', (payload) => {
      if (!isCurrent()) return
      this.stdout = this.appendLimited(this.stdout, decodeZhiziSocketPayload(payload))
      if (!this.ready && socket.connected && /GTP ready|beginning main protocol loop/i.test(this.stdout)) {
        this.markReady()
      }
    })
    socket.on('stderr', (payload) => {
      if (!isCurrent()) return
      const text = decodeZhiziSocketPayload(payload)
      this.stderr = this.appendLimited(this.stderr, text)
      if (!this.ready && /not_enough_credit|unauthorized|forbidden|no worker|worker unavailable/i.test(text)) {
        this.lastError = classifyZhiziRemoteError(text, this.config.gpuType)
      }
      if (!this.ready && socket.connected && /GTP ready|beginning main protocol loop/i.test(text)) {
        this.markReady()
      }
    })
    socket.on('connect_error', (cause) => {
      if (!isCurrent()) return
      this.connectErrorCount += 1
      this.lastError = classifyZhiziRemoteError(cause, this.config.gpuType)
      this.state = this.everReady ? 'reconnecting' : 'connecting'
    })
    socket.on('disconnect', (reason) => {
      if (!isCurrent()) return
      this.ready = false
      this.disconnectVersion += 1
      this.clearReadyFallback()
      this.state = 'reconnecting'
      const detail = typeof reason === 'string' ? reason : String(reason ?? '')
      const stderrTail = this.stderr.trim().slice(-800)
      this.lastError = classifyZhiziRemoteError(
        stderrTail || `智子云 Socket 已断开：${detail}`,
        this.config.gpuType
      )
    })
  }

  private markReady(): void {
    this.clearReadyFallback()
    this.ready = true
    this.everReady = true
    this.lastError = null
    this.state = 'ready'
  }

  private scheduleReadyFallback(socket: ZhiziSocketLike): void {
    this.clearReadyFallback()
    this.readyFallbackTimer = setTimeout(() => {
      if (!this.closed && this.socket === socket && socket.connected && !this.ready && this.everReady) {
        this.markReady()
      }
    }, READY_FALLBACK_MS)
  }

  private clearReadyFallback(): void {
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer)
      this.readyFallbackTimer = null
    }
  }

  private appendLimited(current: string, next: string): string {
    const combined = current + next
    return combined.length <= OUTPUT_LIMIT ? combined : combined.slice(-OUTPUT_LIMIT)
  }

  private disposeSocket(sendQuit: boolean): void {
    this.clearReadyFallback()
    const socket = this.socket
    this.socket = null
    this.ready = false
    if (!socket) return
    try {
      if (sendQuit && socket.connected) socket.emit('stdin', 'quit\n')
    } catch {
      // Best effort during shutdown.
    }
    socket.removeAllListeners()
    socket.disconnect()
  }

  private scheduleIdleClose(): void {
    this.clearIdleTimer()
    if (this.closed) return
    const timeout = this.config.gpuType === 'vip-share'
      ? VIP_IDLE_TIMEOUT_MS
      : ON_DEMAND_IDLE_TIMEOUT_MS
    this.idleTimer = setTimeout(() => this.close(), timeout)
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }
}

let managedSession: ZhiziPersistentSession | null = null
let managedFingerprint = ''

function sessionFingerprint(config: ZhiziSessionConfig): string {
  return createHash('sha256')
    .update(config.accountToken)
    .update('\0')
    .update(config.args)
    .digest('hex')
}

export function getZhiziPersistentSession(config: ZhiziSessionConfig): ZhiziPersistentSession {
  const fingerprint = sessionFingerprint(config)
  if (!managedSession || managedSession.isClosed || managedFingerprint !== fingerprint) {
    managedSession?.close()
    managedSession = new ZhiziPersistentSession(config)
    managedFingerprint = fingerprint
  }
  return managedSession
}

export function getZhiziPersistentSessionTelemetry(): ZhiziSessionTelemetry {
  return managedSession?.telemetry() ?? {
    state: 'idle',
    connected: false,
    ready: false,
    reusedConnections: 0,
    connectionCount: 0,
    lastReadyMillis: 0
  }
}

export function resetZhiziPersistentSession(): void {
  managedSession?.close()
  managedSession = null
  managedFingerprint = ''
}
