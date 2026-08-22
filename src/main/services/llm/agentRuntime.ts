import type {
  LlmConnectionProfile,
  LlmModelsListResult,
  LlmProviderId,
  LlmSettingsTestResult
} from '@main/lib/types'
import type { ChatMessage, ChatTool, ChatToolCall, ChatTurnResult } from './provider'

export interface AgentRuntimeCapabilities {
  text: boolean
  vision: boolean
  tools: boolean
  streaming: boolean
  cancellation: boolean
}

export interface AgentToolExecutionResult {
  ok: boolean
  toolResult: string
  followupMessages: ChatMessage[]
}

export type AgentToolExecutor = (call: ChatToolCall) => Promise<AgentToolExecutionResult>

export interface AgentRuntimeTurnInput {
  profile: LlmConnectionProfile
  messages: ChatMessage[]
  tools: ChatTool[]
  maxTokens: number
  onDelta?: (delta: string) => void
  signal?: AbortSignal
  executeTool?: AgentToolExecutor
}

export interface AgentRuntimeAdapter {
  readonly id: LlmProviderId
  readonly capabilities: AgentRuntimeCapabilities
  probe(profile: LlmConnectionProfile): Promise<LlmSettingsTestResult>
  listModels(profile: LlmConnectionProfile): Promise<LlmModelsListResult>
  runTurn(input: AgentRuntimeTurnInput): Promise<ChatTurnResult>
  cancel(runId?: string): Promise<void>
  dispose(): void
}
