import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { createInterface } from 'node:readline'
import type { LlmConnectionProfile, LlmConnectionState, LlmLoginStartResult } from '@main/lib/types'
import type { ChatMessage, ChatTurnResult } from './provider'

interface RpcResponse {
  id?: number | string
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code?: number; message?: string; data?: unknown }
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

interface TurnCompletion {
  status: string
  error?: string
}

class CodexTransportError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CodexTransportError'
  }
}

const PLATFORM_TARGETS: Partial<Record<NodeJS.Platform, Partial<Record<string, { packageName: string; triple: string }>>>> = {
  win32: {
    x64: { packageName: '@openai/codex-win32-x64', triple: 'x86_64-pc-windows-msvc' },
    arm64: { packageName: '@openai/codex-win32-arm64', triple: 'aarch64-pc-windows-msvc' }
  },
  darwin: {
    x64: { packageName: '@openai/codex-darwin-x64', triple: 'x86_64-apple-darwin' },
    arm64: { packageName: '@openai/codex-darwin-arm64', triple: 'aarch64-apple-darwin' }
  },
  linux: {
    x64: { packageName: '@openai/codex-linux-x64', triple: 'x86_64-unknown-linux-musl' },
    arm64: { packageName: '@openai/codex-linux-arm64', triple: 'aarch64-unknown-linux-musl' }
  }
}

function unpackedExecutablePath(path: string): string {
  if (!app.isPackaged) return path
  return path.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`)
}

function bundledCodexExecutable(): string | null {
  const target = PLATFORM_TARGETS[process.platform]?.[process.arch]
  if (!target) return null
  try {
    const require = createRequire(import.meta.url)
    const codexPackageJson = require.resolve('@openai/codex/package.json')
    const codexRequire = createRequire(codexPackageJson)
    const platformPackageJson = codexRequire.resolve(`${target.packageName}/package.json`)
    const executable = unpackedExecutablePath(join(
      dirname(platformPackageJson),
      'vendor',
      target.triple,
      'bin',
      process.platform === 'win32' ? 'codex.exe' : 'codex'
    ))
    return existsSync(executable) ? executable : null
  } catch {
    return null
  }
}

export function resolveCodexExecutable(configuredPath = ''): string {
  const explicit = configuredPath.trim() || process.env.GOAGENT_CODEX_BIN?.trim()
  if (explicit) return explicit
  return bundledCodexExecutable() || 'codex'
}

function startupError(command: string, error: NodeJS.ErrnoException): Error {
  if (process.platform === 'win32' && error.code === 'EPERM') {
    return new Error(
      '无法启动 Codex CLI：Windows PATH 指向了受保护的 Microsoft Store 应用文件。' +
      '请重新安装 GoAgent 的官方 Codex CLI 依赖，或在高级设置中填写可执行的 Codex CLI 路径。' +
      `（${command}）`
    )
  }
  if (error.code === 'ENOENT') {
    return new Error('未找到可执行的 Codex CLI。请重新安装 GoAgent，或在高级设置中填写 Codex CLI 路径。')
  }
  return new Error(`无法启动 Codex CLI（${command}）：${error.message}`)
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function flattenMessages(messages: ChatMessage[]): { text: string; imageUrls: string[] } {
  const sections: string[] = []
  const imageUrls: string[] = []
  for (const message of messages) {
    const role = message.role === 'system' ? '最高优先级讲解规则' : message.role === 'user' ? '用户与证据' : message.role
    if (typeof message.content === 'string') {
      if (message.content.trim()) sections.push(`[${role}]\n${message.content}`)
      continue
    }
    const text = message.content.filter((part) => part.type === 'text').map((part) => part.type === 'text' ? part.text : '').join('\n')
    if (text.trim()) sections.push(`[${role}]\n${text}`)
    for (const part of message.content) {
      if (part.type === 'image_url') imageUrls.push(part.image_url.url)
    }
  }
  return {
    text: [
      '你是 GoAgent 的围棋讲解 provider。只根据下面给出的 KataGo/棋谱事实和棋盘图片生成最终讲解；不要调用工具、不要修改文件、不要声称重新分析。直接输出可展示的 Markdown。',
      ...sections
    ].join('\n\n'),
    imageUrls
  }
}

function writeDataUrlImage(url: string, directory: string, index: number): string | null {
  const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/i.exec(url)
  if (!match) return null
  const extension = match[1].toLowerCase() === 'image/png' ? 'png' : 'jpg'
  const path = join(directory, `board-${index + 1}.${extension}`)
  writeFileSync(path, Buffer.from(match[2], 'base64'))
  return path
}

export class CodexAppServerClient {
  private child: ChildProcessWithoutNullStreams | null = null
  private started: Promise<void> | null = null
  private nextId = 1
  private pending = new Map<number | string, PendingRequest>()
  private events = new EventEmitter()
  private outputByTurn = new Map<string, string>()
  private completionByTurn = new Map<string, TurnCompletion>()
  private stderrTail = ''

  constructor(private executablePath = '') {}

  private async ensureStarted(): Promise<void> {
    if (this.started) return this.started
    this.started = this.startProcess().catch((error) => {
      this.started = null
      throw error
    })
    return this.started
  }

  private async startProcess(): Promise<void> {
    const command = resolveCodexExecutable(this.executablePath)
    this.stderrTail = ''
    const child = spawn(command, ['app-server', '--listen', 'stdio://'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.child = child
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-4000)
    })
    child.on('error', (error) => this.handleProcessFailure(child, startupError(command, error)))
    child.stdin.on('error', (error) => {
      this.handleProcessFailure(child, new CodexTransportError(`Codex App Server 输入通道已断开：${error.message}`, { cause: error }))
    })
    child.once('exit', (code, signal) => {
      this.handleProcessFailure(child, new CodexTransportError(`Codex App Server 已退出（code=${code ?? 'null'}, signal=${signal ?? 'null'}）。`))
    })
    const lines = createInterface({ input: child.stdout })
    lines.on('line', (line) => this.handleLine(line))
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve)
      child.once('error', (error) => reject(startupError(command, error)))
    })
    await this.request('initialize', {
      clientInfo: {
        name: 'goagent',
        title: 'GoAgent',
        version: app.getVersion()
      },
      capabilities: { experimentalApi: false }
    }, false)
    await this.notify('initialized', {})
  }

  private handleLine(line: string): void {
    let message: RpcResponse
    try {
      message = JSON.parse(line) as RpcResponse
    } catch {
      return
    }
    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (message.error) {
        pending.reject(new Error(message.error.message || `Codex RPC error ${message.error.code ?? ''}`))
      } else {
        pending.resolve(message.result)
      }
      return
    }
    if (message.method && message.id !== undefined) {
      void this.write({ id: message.id, error: { code: -32601, message: `Unsupported server request: ${message.method}` } })
        .catch(() => undefined)
      return
    }
    if (!message.method) return
    const params = record(message.params)
    if (message.method === 'item/agentMessage/delta') {
      const turnId = stringValue(params.turnId)
      const delta = stringValue(params.delta)
      if (turnId && delta) {
        this.outputByTurn.set(turnId, `${this.outputByTurn.get(turnId) || ''}${delta}`)
        this.events.emit(`delta:${turnId}`, delta)
      }
    } else if (message.method === 'item/completed') {
      const item = record(params.item)
      if (item.type === 'agentMessage') {
        const turnId = stringValue(params.turnId)
        const text = stringValue(item.text)
        if (turnId && text) this.outputByTurn.set(turnId, text)
      }
    } else if (message.method === 'turn/completed') {
      const turn = record(params.turn)
      const turnId = stringValue(turn.id)
      const error = record(turn.error)
      if (turnId) {
        const completion = { status: stringValue(turn.status), error: stringValue(error.message) }
        this.completionByTurn.set(turnId, completion)
        this.events.emit(`completed:${turnId}`, completion)
      }
    }
    this.events.emit(message.method, params)
  }

  private write(message: unknown): Promise<void> {
    const child = this.child
    const stdin = child?.stdin
    if (!stdin || stdin.destroyed || stdin.writableEnded || !stdin.writable) {
      return Promise.reject(new CodexTransportError('Codex App Server 未运行或输入通道已关闭。'))
    }
    return new Promise<void>((resolve, reject) => {
      try {
        stdin.write(`${JSON.stringify(message)}\n`, (error) => {
          if (!error) {
            resolve()
            return
          }
          const failure = new CodexTransportError(`Codex App Server 输入通道写入失败：${error.message}`, { cause: error })
          this.handleProcessFailure(child, failure)
          reject(failure)
        })
      } catch (error) {
        const cause = error instanceof Error ? error : new Error(String(error))
        const failure = new CodexTransportError(`Codex App Server 输入通道写入失败：${cause.message}`, { cause })
        this.handleProcessFailure(child, failure)
        reject(failure)
      }
    })
  }

  private notify(method: string, params: Record<string, unknown>): Promise<void> {
    return this.write({ method, params })
  }

  private async request(method: string, params: Record<string, unknown> = {}, ensureStarted = true): Promise<unknown> {
    if (ensureStarted) await this.ensureStarted()
    const id = this.nextId++
    const response = new Promise<unknown>((resolve, reject) => this.pending.set(id, { resolve, reject }))
    // The transport can fail while the write callback is still pending. Attach a
    // rejection observer immediately so Node never reports that pending RPC as
    // an unhandled rejection before the write promise settles.
    void response.catch(() => undefined)
    try {
      await this.write({ method, id, params })
      return await response
    } catch (error) {
      this.pending.delete(id)
      throw error
    }
  }

  private handleProcessFailure(child: ChildProcessWithoutNullStreams, error: Error): void {
    if (this.child !== child) return
    this.child = null
    this.started = null
    const stderr = this.stderrTail.trim()
    const failure = error instanceof CodexTransportError
      ? new CodexTransportError(stderr ? `${error.message}\n${stderr}` : error.message, { cause: error })
      : error
    if (child.exitCode === null && !child.killed) child.kill()
    this.failAll(failure)
    this.events.emit('transport-failure', failure)
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }

  private async requestWithRestart(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    try {
      return await this.request(method, params)
    } catch (error) {
      if (!(error instanceof CodexTransportError)) throw error
      await this.ensureStarted()
      return this.request(method, params)
    }
  }

  private waitForTurnCompletion(turnId: string): Promise<TurnCompletion> {
    return new Promise<TurnCompletion>((resolve, reject) => {
      const completedEvent = `completed:${turnId}`
      const cleanup = (): void => {
        this.events.off(completedEvent, onCompleted)
        this.events.off('transport-failure', onTransportFailure)
      }
      const onCompleted = (completion: TurnCompletion): void => {
        cleanup()
        resolve(completion)
      }
      const onTransportFailure = (error: Error): void => {
        cleanup()
        reject(error)
      }
      this.events.once(completedEvent, onCompleted)
      this.events.once('transport-failure', onTransportFailure)
    })
  }

  async connectionState(connectionId: string): Promise<LlmConnectionState> {
    try {
      const result = record(await this.requestWithRestart('account/read', { refreshToken: false }))
      const account = record(result.account)
      const ready = account.type === 'chatgpt'
      return {
        connectionId,
        provider: 'codex-app-server',
        authMode: 'managed-login',
        ready,
        status: ready ? 'ready' : 'signed-out',
        accountLabel: stringValue(account.email) || undefined,
        planLabel: stringValue(account.planType) || undefined,
        message: ready ? 'ChatGPT 已登录。' : '请登录 ChatGPT 后使用套餐额度讲棋。'
      }
    } catch (error) {
      return {
        connectionId,
        provider: 'codex-app-server',
        authMode: 'managed-login',
        ready: false,
        status: 'unavailable',
        message: String(error)
      }
    }
  }

  async startLogin(connectionId: string, useDeviceCode = false): Promise<LlmLoginStartResult> {
    const type = useDeviceCode ? 'chatgptDeviceCode' : 'chatgpt'
    const result = record(await this.request('account/login/start', useDeviceCode
      ? { type }
      : { type, useHostedLoginSuccessPage: true, appBrand: 'chatgpt' }))
    return {
      connectionId,
      type,
      loginId: stringValue(result.loginId),
      authUrl: stringValue(result.authUrl) || undefined,
      verificationUrl: stringValue(result.verificationUrl) || undefined,
      userCode: stringValue(result.userCode) || undefined
    }
  }

  async logout(): Promise<void> {
    await this.request('account/logout')
  }

  async listModels(): Promise<Array<{ id: string; supportsImage: boolean; isDefault: boolean }>> {
    const result = record(await this.requestWithRestart('model/list', { limit: 100, includeHidden: true }))
    const data = Array.isArray(result.data) ? result.data : []
    return data.map((entry) => {
      const model = record(entry)
      const modalities = Array.isArray(model.inputModalities) ? model.inputModalities : ['text', 'image']
      return {
        id: stringValue(model.model) || stringValue(model.id),
        supportsImage: modalities.includes('image'),
        isDefault: model.isDefault === true
      }
    }).filter((model) => model.id)
  }

  async runTurn(profile: LlmConnectionProfile, messages: ChatMessage[], onDelta?: (delta: string) => void, signal?: AbortSignal): Promise<ChatTurnResult> {
    await this.ensureStarted()
    const { text, imageUrls } = flattenMessages(messages)
    const tempRoot = mkdtempSync(join(tmpdir(), 'goagent-codex-'))
    const input: Array<Record<string, unknown>> = [{ type: 'text', text }]
    imageUrls.forEach((url, index) => {
      const localPath = writeDataUrlImage(url, tempRoot, index)
      input.push(localPath ? { type: 'localImage', path: localPath } : { type: 'image', url })
    })
    let threadId = ''
    let turnId = ''
    const abort = (): void => {
      if (threadId && turnId) void this.request('turn/interrupt', { threadId, turnId }).catch(() => undefined)
    }
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const models = await this.listModels()
      const model = profile.model || models.find((item) => item.isDefault)?.id || models[0]?.id
      const selectedModel = models.find((item) => item.id === model)
      if (profile.model && !selectedModel) throw new Error(`当前 ChatGPT 账号没有可用模型：${profile.model}`)
      if (imageUrls.length && selectedModel && !selectedModel.supportsImage) {
        throw new Error(`模型 ${model} 不支持棋盘图片输入，请选择多模态模型。`)
      }
      const threadResult = record(await this.request('thread/start', {
        ...(model ? { model } : {}),
        cwd: tempRoot,
        approvalPolicy: 'never',
        serviceName: 'goagent'
      }))
      threadId = stringValue(record(threadResult.thread).id)
      if (!threadId) throw new Error('Codex 未返回 thread id。')
      const turnResult = record(await this.request('turn/start', {
        threadId,
        input,
        ...(model ? { model } : {}),
        cwd: tempRoot,
        approvalPolicy: 'never',
        // Current App Server versions reject the former readOnly.access shape
        // and route restricted reads through permission profiles. GoAgent does
        // not expose Codex tools here, so the stable read-only sandbox is enough
        // while still allowing the model to consume the localImage input.
        sandboxPolicy: { type: 'readOnly' }
      }))
      const turn = record(turnResult.turn)
      turnId = stringValue(turn.id)
      if (!turnId) throw new Error('Codex 未返回 turn id。')
      if (onDelta) {
        const existing = this.outputByTurn.get(turnId)
        if (existing) onDelta(existing)
        this.events.on(`delta:${turnId}`, onDelta)
      }
      if (signal?.aborted) abort()
      const completion = this.completionByTurn.get(turnId) ?? await this.waitForTurnCompletion(turnId)
      if (completion.status !== 'completed') throw new Error(completion.error || `Codex turn ${completion.status}`)
      const output = (this.outputByTurn.get(turnId) || '').trim()
      if (!output) throw new Error('ChatGPT 没有返回讲解文本。')
      return { text: output, toolCalls: [], finishReason: completion.status }
    } finally {
      if (onDelta && turnId) this.events.off(`delta:${turnId}`, onDelta)
      signal?.removeEventListener('abort', abort)
      this.outputByTurn.delete(turnId)
      this.completionByTurn.delete(turnId)
      if (threadId) await this.request('thread/delete', { threadId }).catch(() => undefined)
      rmSync(tempRoot, { recursive: true, force: true })
    }
  }

  dispose(): void {
    const child = this.child
    this.child = null
    this.started = null
    const failure = new CodexTransportError('Codex App Server 客户端已关闭。')
    this.failAll(failure)
    this.events.emit('transport-failure', failure)
    if (child?.exitCode === null && !child.killed) child.kill()
  }
}
