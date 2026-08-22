import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { createInterface } from 'node:readline'
import { appHome } from '@main/lib/store'
import type {
  LlmConnectionState,
  LlmLoginStartResult,
  LlmModelsListResult
} from '@main/lib/types'
import type { ChatMessage, ChatTool, ChatToolCall, ChatTurnResult } from './provider'
import type { AgentRuntimeTurnInput, AgentToolExecutor } from './agentRuntime'

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
  timer: NodeJS.Timeout
}

interface TurnCompletion {
  status: string
  error?: string
}

export interface CodexAvailableModel {
  id: string
  supportsImage?: boolean
  isDefault: boolean
}

interface ActiveToolContext {
  execute: AgentToolExecutor
  allowedTools: Set<string>
  executedTools: string[]
  followupMessages: ChatMessage[]
  policyViolations: string[]
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

export const CODEX_RUNTIME_VERSION = '0.149.0'
const CODEX_HOME = join(appHome, 'codex')
const FORBIDDEN_ITEM_TYPES = new Set([
  'commandExecution',
  'fileChange',
  'mcpToolCall',
  'webSearch',
  'imageGeneration',
  'computerToolCall',
  'collabToolCall'
])
const MAX_DYNAMIC_TOOL_CALLS = 18
const RPC_TIMEOUT_MS = 20_000

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

function packagedCodexExecutable(): string | null {
  const target = PLATFORM_TARGETS[process.platform]?.[process.arch]
  if (!target || !app.isPackaged) return null
  const executable = join(
    process.resourcesPath,
    'data',
    'codex',
    'bin',
    `${process.platform}-${process.arch}`,
    process.platform === 'win32' ? 'codex.exe' : 'codex'
  )
  return existsSync(executable) ? executable : null
}

export function resolveCodexExecutable(configuredPath = ''): string {
  const explicit = configuredPath.trim() || process.env.GOAGENT_CODEX_BIN?.trim()
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`找不到指定的 ChatGPT 运行组件：${explicit}`)
    return explicit
  }
  const packaged = packagedCodexExecutable()
  if (packaged) return packaged
  const bundled = bundledCodexExecutable()
  if (bundled) return bundled
  throw new Error('GoAgent 的 ChatGPT 运行组件缺失，请重新安装完整版本。')
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

function flattenMessages(messages: ChatMessage[]): { instructions: string; text: string; imageUrls: string[] } {
  const sections: string[] = []
  const instructions: string[] = []
  const imageUrls: string[] = []
  for (const message of messages) {
    if (message.role === 'system') {
      const text = typeof message.content === 'string'
        ? message.content
        : message.content.filter((part) => part.type === 'text').map((part) => part.type === 'text' ? part.text : '').join('\n')
      if (text.trim()) instructions.push(text.trim())
      continue
    }
    const role = message.role === 'user' ? '用户与证据' : message.role
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
    instructions: instructions.join('\n\n'),
    text: sections.join('\n\n'),
    imageUrls
  }
}

function dynamicTools(tools: ChatTool[]): Array<Record<string, unknown>> {
  return tools.map((tool) => ({
    type: 'function',
    name: tool.function.name,
    description: tool.function.description,
    inputSchema: tool.function.parameters,
    deferLoading: false
  }))
}

function contentItemsFromToolResult(result: Awaited<ReturnType<AgentToolExecutor>>): Array<Record<string, unknown>> {
  const contentItems: Array<Record<string, unknown>> = [{ type: 'inputText', text: result.toolResult }]
  for (const message of result.followupMessages) {
    if (typeof message.content === 'string') {
      if (message.content.trim()) contentItems.push({ type: 'inputText', text: message.content })
      continue
    }
    for (const part of message.content) {
      if (part.type === 'text' && part.text.trim()) contentItems.push({ type: 'inputText', text: part.text })
      if (part.type === 'image_url' && part.image_url.url.startsWith('data:image/')) {
        contentItems.push({ type: 'inputImage', imageUrl: part.image_url.url })
      }
    }
  }
  return contentItems
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
  private toolContexts = new Map<string, ActiveToolContext>()
  private activeTurns = new Map<string, string>()
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
    mkdirSync(CODEX_HOME, { recursive: true })
    const configOverrides = [
      'cli_auth_credentials_store="file"',
      'features.shell_tool=false',
      'features.unified_exec=false',
      'features.apply_patch_freeform=false',
      'web_search="disabled"',
      'features.web_search_request=false',
      'features.image_generation=false',
      'features.apps=false',
      'features.plugins=false',
      'features.enable_mcp_apps=false',
      'features.browser_use=false',
      'features.computer_use=false',
      'features.multi_agent=false',
      'features.collab=false',
      'features.code_mode=false',
      'features.js_repl=false',
      'features.memory_tool=false',
      'features.tool_search=false',
      'features.connectors=false',
      'features.workspace_dependencies=false'
    ].flatMap((value) => ['-c', value])
    const environmentKeys = [
      'PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL',
      'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
      'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'APPDATA', 'LOCALAPPDATA'
    ]
    const env = Object.fromEntries(environmentKeys.flatMap((key) => process.env[key] ? [[key, process.env[key] as string]] : []))
    const child = spawn(command, [...configOverrides, 'app-server', '--listen', 'stdio://'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...env, CODEX_HOME }
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
      capabilities: { experimentalApi: true }
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
      clearTimeout(pending.timer)
      if (message.error) {
        pending.reject(new Error(message.error.message || `Codex RPC error ${message.error.code ?? ''}`))
      } else {
        pending.resolve(message.result)
      }
      return
    }
    if (message.method && message.id !== undefined) {
      void this.handleServerRequest(message)
      return
    }
    if (!message.method) return
    const params = record(message.params)
    if (message.method === 'item/started') {
      const item = record(params.item)
      const threadId = stringValue(params.threadId)
      const turnId = stringValue(params.turnId)
      const itemType = stringValue(item.type)
      const context = this.toolContexts.get(threadId)
      if (context && FORBIDDEN_ITEM_TYPES.has(itemType)) {
        const violation = `Codex 尝试使用未授权能力：${itemType}`
        context.policyViolations.push(violation)
        if (threadId && turnId) {
          void this.request('turn/interrupt', { threadId, turnId }).catch(() => undefined)
        }
      }
    } else if (message.method === 'item/agentMessage/delta') {
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

  private async handleServerRequest(message: RpcResponse): Promise<void> {
    if (message.method !== 'item/tool/call') {
      await this.write({
        id: message.id,
        error: { code: -32601, message: `Unsupported server request: ${message.method}` }
      }).catch(() => undefined)
      return
    }

    const params = record(message.params)
    const threadId = stringValue(params.threadId)
    const callId = stringValue(params.callId)
    const toolName = stringValue(params.tool)
    const context = this.toolContexts.get(threadId)
    if (!context || !context.allowedTools.has(toolName)) {
      await this.write({
        id: message.id,
        result: {
          contentItems: [{ type: 'inputText', text: `工具不可用或未授权：${toolName || 'unknown'}` }],
          success: false
        }
      }).catch(() => undefined)
      return
    }
    if (context.executedTools.length >= MAX_DYNAMIC_TOOL_CALLS) {
      await this.write({
        id: message.id,
        result: {
          contentItems: [{ type: 'inputText', text: '本轮工具调用次数已达到上限，请根据已有证据给出最终回答。' }],
          success: false
        }
      }).catch(() => undefined)
      return
    }

    const toolCall: ChatToolCall = {
      id: callId || `codex-tool-${Date.now()}`,
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(params.arguments ?? {})
      }
    }
    try {
      const result = await context.execute(toolCall)
      if (result.ok) context.executedTools.push(toolName)
      context.followupMessages.push(...result.followupMessages)
      await this.write({
        id: message.id,
        result: { contentItems: contentItemsFromToolResult(result), success: result.ok }
      })
    } catch (error) {
      await this.write({
        id: message.id,
        result: {
          contentItems: [{ type: 'inputText', text: `工具执行失败：${String(error)}` }],
          success: false
        }
      }).catch(() => undefined)
    }
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
    const response = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return
        const failure = new CodexTransportError(`Codex App Server 请求超时：${method}`)
        const child = this.child
        if (child) {
          this.handleProcessFailure(child, failure)
        } else {
          this.pending.delete(id)
          reject(failure)
        }
      }, RPC_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
    })
    // The transport can fail while the write callback is still pending. Attach a
    // rejection observer immediately so Node never reports that pending RPC as
    // an unhandled rejection before the write promise settles.
    void response.catch(() => undefined)
    try {
      await this.write({ method, id, params })
      return await response
    } catch (error) {
      const pending = this.pending.get(id)
      if (pending) clearTimeout(pending.timer)
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
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
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

  async listModels(): Promise<CodexAvailableModel[]> {
    const result = record(await this.requestWithRestart('model/list', { limit: 100, includeHidden: true }))
    const data = Array.isArray(result.data) ? result.data : []
    return data.map((entry) => {
      const model = record(entry)
      const modalities = Array.isArray(model.inputModalities) ? model.inputModalities : null
      return {
        id: stringValue(model.model) || stringValue(model.id),
        supportsImage: modalities ? modalities.includes('image') : undefined,
        isDefault: model.isDefault === true
      }
    }).filter((model) => model.id)
  }

  async runTurn(inputOptions: AgentRuntimeTurnInput): Promise<ChatTurnResult> {
    await this.ensureStarted()
    const { profile, messages, tools, onDelta, signal, executeTool } = inputOptions
    if (tools.length > 0 && !executeTool) {
      throw new Error('ChatGPT 工具执行器未连接，无法开始围棋分析。')
    }
    const { instructions, text, imageUrls } = flattenMessages(messages)
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
      if (imageUrls.length && selectedModel?.supportsImage === false) {
        throw new Error(`模型 ${model} 不支持棋盘图片输入，请选择多模态模型。`)
      }
      const threadResult = record(await this.request('thread/start', {
        ...(model ? { model } : {}),
        cwd: tempRoot,
        approvalPolicy: 'never',
        sandbox: 'read-only',
        ephemeral: true,
        serviceName: 'goagent',
        baseInstructions: instructions || '你是 GoAgent 的围棋老师。',
        developerInstructions: '你运行在 GoAgent 内。只能使用本轮提供的动态工具；不得执行命令、修改文件、调用外部工具或访问未提供的数据。',
        dynamicTools: dynamicTools(tools),
        config: {
          web_search: 'disabled',
          features: {
            shell_tool: false,
            unified_exec: false,
            apply_patch_freeform: false,
            image_generation: false,
            apps: false,
            plugins: false,
            browser_use: false,
            computer_use: false,
            multi_agent: false,
            collab: false,
            code_mode: false,
            js_repl: false,
            memory_tool: false,
            tool_search: false,
            connectors: false,
            workspace_dependencies: false
          }
        }
      }))
      threadId = stringValue(record(threadResult.thread).id)
      if (!threadId) throw new Error('Codex 未返回 thread id。')
      const toolContext: ActiveToolContext = {
        execute: executeTool ?? (async () => ({ ok: false, toolResult: '工具执行器不可用。', followupMessages: [] })),
        allowedTools: new Set(tools.map((tool) => tool.function.name)),
        executedTools: [],
        followupMessages: [],
        policyViolations: []
      }
      this.toolContexts.set(threadId, toolContext)
      const turnResult = record(await this.request('turn/start', {
        threadId,
        input,
        ...(model ? { model } : {}),
        cwd: tempRoot,
        approvalPolicy: 'never',
        sandboxPolicy: { type: 'readOnly', networkAccess: false }
      }))
      const turn = record(turnResult.turn)
      turnId = stringValue(turn.id)
      if (!turnId) throw new Error('Codex 未返回 turn id。')
      this.activeTurns.set(threadId, turnId)
      if (onDelta) {
        const existing = this.outputByTurn.get(turnId)
        if (existing) onDelta(existing)
        this.events.on(`delta:${turnId}`, onDelta)
      }
      if (signal?.aborted) abort()
      const completion = this.completionByTurn.get(turnId) ?? await this.waitForTurnCompletion(turnId)
      const completedContext = this.toolContexts.get(threadId)
      if (completedContext?.policyViolations.length) {
        throw new Error(completedContext.policyViolations.join('；'))
      }
      if (completion.status !== 'completed') throw new Error(completion.error || `Codex turn ${completion.status}`)
      const output = (this.outputByTurn.get(turnId) || '').trim()
      if (!output) throw new Error('ChatGPT 没有返回讲解文本。')
      return {
        text: output,
        toolCalls: [],
        executedToolCalls: completedContext?.executedTools ?? [],
        toolFollowupMessages: completedContext?.followupMessages ?? [],
        finishReason: completion.status
      }
    } finally {
      if (onDelta && turnId) this.events.off(`delta:${turnId}`, onDelta)
      signal?.removeEventListener('abort', abort)
      this.outputByTurn.delete(turnId)
      this.completionByTurn.delete(turnId)
      this.activeTurns.delete(threadId)
      this.toolContexts.delete(threadId)
      if (threadId) await this.request('thread/delete', { threadId }).catch(() => undefined)
      rmSync(tempRoot, { recursive: true, force: true })
    }
  }

  async cancel(): Promise<void> {
    await Promise.all([...this.activeTurns].map(([threadId, turnId]) =>
      this.request('turn/interrupt', { threadId, turnId }).catch(() => undefined)
    ))
  }

  dispose(): void {
    const child = this.child
    this.child = null
    this.started = null
    this.activeTurns.clear()
    this.toolContexts.clear()
    const failure = new CodexTransportError('Codex App Server 客户端已关闭。')
    this.failAll(failure)
    this.events.emit('transport-failure', failure)
    if (child?.exitCode === null && !child.killed) child.kill()
  }
}
