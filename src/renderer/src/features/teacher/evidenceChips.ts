import type { KataGoMoveAnalysis, KnowledgeMatch } from '@main/lib/types'

export type TeacherEvidenceChipKind = 'move' | 'coordinate' | 'candidate' | 'loss' | 'pv' | 'knowledge' | 'confidence'

export interface TeacherEvidenceChip {
  id: string
  kind: TeacherEvidenceChipKind
  label: string
  detail: string
  moveNumber?: number
  point?: string
}

function round(value: number | undefined, digits = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function evidenceChipsFromAnalysis(analysis: KataGoMoveAnalysis, knowledgeMatches: KnowledgeMatch[] = []): TeacherEvidenceChip[] {
  const chips: TeacherEvidenceChip[] = []
  const actual = analysis.playedMove?.move ?? analysis.currentMove?.gtp
  const best = analysis.before.topMoves[0]
  chips.push({
    id: `move-${analysis.moveNumber}`,
    kind: 'move',
    label: `第 ${analysis.moveNumber} 手`,
    detail: analysis.moveClassification?.reason ?? analysis.analysisQuality?.reason ?? '当前局面分析',
    moveNumber: analysis.moveNumber
  })
  if (actual) {
    chips.push({
      id: `actual-${analysis.moveNumber}-${actual}`,
      kind: 'coordinate',
      label: `实战 ${actual}`,
      detail: `实战点 ${actual}`,
      moveNumber: analysis.moveNumber,
      point: actual
    })
  }
  if (best) {
    chips.push({
      id: `best-${analysis.moveNumber}-${best.move}`,
      kind: 'candidate',
      label: `AI 首选 ${best.move}`,
      detail: `胜率 ${round(best.winrate)}%，目差 ${round(best.scoreLead)}，搜索 ${best.visits}`,
      moveNumber: analysis.moveNumber,
      point: best.move
    })
  }
  if (analysis.playedMove) {
    chips.push({
      id: `loss-${analysis.moveNumber}`,
      kind: 'loss',
      label: `损失 ${round(analysis.playedMove.winrateLoss)}% / ${round(analysis.playedMove.scoreLoss)}目`,
      detail: `胜率损失 ${round(analysis.playedMove.winrateLoss)}%，目差损失 ${round(analysis.playedMove.scoreLoss)}。`,
      moveNumber: analysis.moveNumber
    })
  }
  if (analysis.pvConfidence) {
    chips.push({
      id: `pv-${analysis.moveNumber}`,
      kind: 'pv',
      label: `PV ${analysis.pvConfidence.overall}`,
      detail: analysis.pvConfidence.summary,
      moveNumber: analysis.moveNumber
    })
  }
  if (analysis.moveClassification) {
    chips.push({
      id: `confidence-${analysis.moveNumber}`,
      kind: 'confidence',
      label: `${analysis.moveClassification.severity}/${analysis.moveClassification.confidence}`,
      detail: analysis.moveClassification.reason,
      moveNumber: analysis.moveNumber
    })
  }
  for (const match of knowledgeMatches.slice(0, 3)) {
    chips.push({ id: `knowledge-${match.id}`, kind: 'knowledge', label: match.title, detail: `${match.confidence}: ${match.applicability}` })
  }
  return chips
}
