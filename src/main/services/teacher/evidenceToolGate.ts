import type { TeacherRunRequest, VisionEvidenceReport } from '@main/lib/types'
import type { ChatMessage } from '../llm/provider'
import { buildVisionEvidenceReport, validateVisionEvidenceForIntent } from './visionEvidence'

/** Only a validated current-position image actually sent in the initial user message replaces a capture call. */
export function hasInitialCurrentBoardImage(request: TeacherRunRequest, report: VisionEvidenceReport | undefined, message: ChatMessage): boolean {
  if (request.mode !== 'current-move' || !request.gameId || !Number.isInteger(request.moveNumber) || request.moveNumber! < 1 ||
    !request.boardImageDataUrl || !report?.attached || report.source !== 'initial-attachment' ||
    !validateVisionEvidenceForIntent(report, 'current-move').ok || message.role !== 'user' || !Array.isArray(message.content)) return false
  if (request.boardContext === 'trial' && (!request.trialBranch?.active ||
    request.moveNumber !== request.trialBranch.baseMoveNumber + request.trialBranch.moves.length)) return false
  // Recompute bytes, MIME and dimensions from this request; an attached/valid flag alone is insufficient.
  const actual = buildVisionEvidenceReport(request, 'current-move')
  const image = actual.images.find(image => image.role === 'current-board' && image.moveNumber === request.moveNumber && image.index === 0)
  const declared = report.images.find(image => image.role === 'current-board' && image.moveNumber === request.moveNumber && image.index === 0)
  return Boolean(image?.valid && image.width && image.height && declared?.valid && declared.source === 'initial-attachment' &&
    declared.bytes === image.bytes && declared.mimeType === image.mimeType &&
    message.content.some(part => part.type === 'image_url' && part.image_url.url === request.boardImageDataUrl))
}

export function missingTeacherEvidenceTools(input: {
  intent: string; request: TeacherRunRequest; report?: VisionEvidenceReport
  initialMessage: ChatMessage; successfulTools: Set<string>
}): string[] {
  const groups: Record<string, string[][]> = {
    'current-move': [
      ...(hasInitialCurrentBoardImage(input.request, input.report, input.initialMessage) ? [] : [['board_captureTeachingImage']]),
      ['katago_analyzePosition'], ['knowledge_matchPosition', 'knowledge_searchLocal']
    ],
    'game-review': [['sgf_readGameRecord'], ['katago_analyzeGameBatch'], ['board_captureTeachingImage'],
      ['knowledge_matchPosition', 'knowledge_searchLocal', 'knowledge_searchJoseki', 'knowledge_searchLifeDeath', 'knowledge_searchTesuji']],
    'move-range': [['katago_analyzeMoveRangeKeyMoves'], ['board_captureTeachingImage'],
      ['knowledge_matchPosition', 'knowledge_searchLocal', 'knowledge_searchJoseki', 'knowledge_searchLifeDeath', 'knowledge_searchTesuji']]
  }
  return (groups[input.intent] ?? []).filter(group => !group.some(name => input.successfulTools.has(name))).map(group => group.join(' / '))
}
