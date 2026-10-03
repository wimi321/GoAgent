import type { TeacherRunRequest, VisionEvidenceReport } from '@main/lib/types'
import type { AgentToolExecutionResult } from '../llm/agentRuntime'
import type { ChatMessage } from '../llm/provider'

interface InitialCaptureInput {
  provider: string
  intent: string
  request: TeacherRunRequest
  report?: VisionEvidenceReport
  hasCaptureHandler: boolean
}

export function needsInitialBoardCapture(input: InitialCaptureInput): boolean {
  const { request, report } = input
  return input.provider === 'codex-app-server' && input.intent === 'current-move' &&
    request.mode === 'current-move' && report?.required === true && !report.attached &&
    (request.toolPolicy === 'auto' || request.toolPolicy === undefined) &&
    Boolean(request.gameId) && Number.isInteger(request.moveNumber) && request.moveNumber! > 0 &&
    input.hasCaptureHandler
}

export async function prepareInitialBoardMessages(
  input: InitialCaptureInput,
  capture: () => Promise<AgentToolExecutionResult>
): Promise<ChatMessage[]> {
  if (!needsInitialBoardCapture(input)) return []
  const result = await capture()
  if (!result.ok) throw new Error(`初始棋盘图获取失败：${result.toolResult}`)
  const hasImage = result.followupMessages.some(message => Array.isArray(message.content) &&
    message.content.some(part => part.type === 'image_url' && /^data:image\/(?:png|jpeg);base64,/.test(part.image_url.url)))
  if (!hasImage) throw new Error('初始棋盘截图没有返回真实图片输入。')
  return [{ role: 'user', content: `GoAgent 已通过棋盘截图工具取得当前局面：\n${result.toolResult}` }, ...result.followupMessages]
}
