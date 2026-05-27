import type { KataGoMoveAnalysis, MoveClassificationSeverity, PvConfidenceLevel } from '@main/lib/types'

export interface TimelineReviewItem {
  moveNumber: number
  color?: 'B' | 'W'
  playedMove: string
  bestMove: string
  severity: MoveClassificationSeverity
  confidence: 'high' | 'medium' | 'low'
  pvConfidence: PvConfidenceLevel
  winrateLoss: number
  scoreLoss: number
  visits: number
  shouldDeepen: boolean
  label: string
  sortScore: number
}

function round(value: number | undefined, digits = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const severityWeight: Record<MoveClassificationSeverity, number> = {
  blunder: 100,
  mistake: 70,
  inaccuracy: 35,
  good: 5,
  unclear: 0
}

const confidenceWeight = { high: 8, medium: 4, low: 0 }
const pvWeight: Record<PvConfidenceLevel, number> = { strong: 8, medium: 4, weak: 1, unstable: 0 }

export function timelineItemFromAnalysis(analysis: KataGoMoveAnalysis): TimelineReviewItem | null {
  const classification = analysis.moveClassification
  const playedMove = analysis.playedMove?.move ?? analysis.currentMove?.gtp ?? ''
  const bestMove = analysis.before.topMoves[0]?.move ?? analysis.after.topMoves[0]?.move ?? ''
  if (!playedMove && !bestMove) return null
  const severity = classification?.severity ?? (analysis.judgement === 'good_move' ? 'good' : analysis.judgement === 'unknown' ? 'unclear' : analysis.judgement)
  const confidence = classification?.confidence ?? analysis.analysisQuality?.confidence ?? 'medium'
  const pvConfidence = analysis.pvConfidence?.overall ?? 'weak'
  const winrateLoss = round(classification?.winrateLoss ?? analysis.playedMove?.winrateLoss ?? 0, 2)
  const scoreLoss = round(classification?.scoreLoss ?? analysis.playedMove?.scoreLoss ?? 0, 2)
  const visits = Math.max(0, Number(analysis.playedMove?.visits ?? analysis.analysisQuality?.actualVisits ?? analysis.before.topMoves[0]?.visits ?? 0) || 0)
  const shouldDeepen = Boolean(classification?.shouldDeepen || analysis.pvConfidence?.shouldDeepen || analysis.analysisQuality?.deepenRecommended)
  const sortScore = severityWeight[severity] + winrateLoss * 2 + scoreLoss * 3 + confidenceWeight[confidence] + pvWeight[pvConfidence] + (shouldDeepen ? -8 : 0)
  return {
    moveNumber: analysis.moveNumber,
    color: analysis.currentMove?.color,
    playedMove,
    bestMove,
    severity,
    confidence,
    pvConfidence,
    winrateLoss,
    scoreLoss,
    visits,
    shouldDeepen,
    label: bestMove ? `${playedMove || '实战'} → ${bestMove}` : playedMove || `第 ${analysis.moveNumber} 手`,
    sortScore
  }
}

export function buildTimelineReviewItems(evaluations: Record<number, KataGoMoveAnalysis>, options: { includeGoodMoves?: boolean; limit?: number } = {}): TimelineReviewItem[] {
  return Object.values(evaluations)
    .map(timelineItemFromAnalysis)
    .filter((item): item is TimelineReviewItem => Boolean(item))
    .filter((item) => options.includeGoodMoves || item.severity !== 'good')
    .sort((left, right) => right.sortScore - left.sortScore || left.moveNumber - right.moveNumber)
    .slice(0, options.limit ?? 12)
}

export function describeTimelineReviewItem(item: TimelineReviewItem): string {
  const deepen = item.shouldDeepen ? '，建议加深' : ''
  return `第 ${item.moveNumber} 手 ${item.playedMove}${item.bestMove ? `，AI 倾向 ${item.bestMove}` : ''}，胜率损失 ${round(item.winrateLoss)}%，目差损失 ${round(item.scoreLoss)}，${item.severity}/${item.confidence}，PV ${item.pvConfidence}${deepen}`
}

export function keyMoveNumbersForRange(items: TimelineReviewItem[], start: number, end: number, limit = 5): number[] {
  return items
    .filter((item) => item.moveNumber >= start && item.moveNumber <= end)
    .sort((left, right) => right.sortScore - left.sortScore || left.moveNumber - right.moveNumber)
    .slice(0, limit)
    .map((item) => item.moveNumber)
    .sort((left, right) => left - right)
}
