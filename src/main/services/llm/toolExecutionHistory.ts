import type { AgentToolExecutionResult } from './agentRuntime'
import type { ChatMessage, ChatToolCall } from './provider'

/** Preserve the evidence from an executed tool for subsequent repair turns. */
export function toolExecutionHistory(
  toolCall: ChatToolCall,
  result: AgentToolExecutionResult
): ChatMessage[] {
  return [
    { role: 'assistant', content: '', tool_calls: [toolCall] },
    {
      role: 'tool',
      name: toolCall.function.name,
      tool_call_id: toolCall.id,
      content: result.toolResult
    },
    ...result.followupMessages
  ]
}
