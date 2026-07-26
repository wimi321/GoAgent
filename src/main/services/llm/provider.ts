export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ChatContentPart[]
  name?: string
  tool_call_id?: string
  tool_calls?: ChatToolCall[]
}

export interface ChatToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ChatTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ProviderSettings {
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
}

export interface ChatInput {
  settings: ProviderSettings
  messages: ChatMessage[]
  maxTokens?: number
  tools?: ChatTool[]
  toolChoice?: 'auto' | 'none'
}

export interface ChatResult {
  text: string
  raw?: unknown
}

export interface ChatTurnResult {
  text: string
  toolCalls: ChatToolCall[]
  raw?: unknown
  finishReason?: string
}

export interface ChatDelta {
  text: string
  done?: boolean
  toolCall?: ChatToolCall
  event?: 'text' | 'tool-call' | 'done'
}

export interface ProviderProbeResult {
  ok: boolean
  message: string
  supportsImage?: boolean
  technicalDetail?: string
  capabilities?: {
    text: ProviderCapabilityCheck
    vision: ProviderCapabilityCheck
    tools: ProviderCapabilityCheck
  }
}

export interface ProviderCapabilityCheck {
  ok: boolean
  message: string
  technicalDetail?: string
}

export interface LlmProvider {
  id: string
  label: string
  probe(settings: ProviderSettings): Promise<ProviderProbeResult>
  chat(input: ChatInput): Promise<ChatResult>
  streamChat?(input: ChatInput): AsyncIterable<ChatDelta>
}
