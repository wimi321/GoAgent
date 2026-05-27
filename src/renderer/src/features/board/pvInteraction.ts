import type { KataGoCandidate, KataGoMoveAnalysis, PvConfidenceLevel } from '@main/lib/types'

export interface BoardPvPreviewState {
  anchorMove: string
  pv: string[]
  confidence: PvConfidenceLevel
  locked: boolean
  label: string
  warning?: string
}

export interface BoardEvidenceHighlight {
  moveNumber?: number
  point?: string
  label: string
  reason: string
}

function candidateConfidence(analysis: KataGoMoveAnalysis, move: string): PvConfidenceLevel {
  const key = move.trim().toUpperCase()
  return analysis.pvConfidence?.candidates.find((candidate) => candidate.move.trim().toUpperCase() === key)?.level ?? analysis.pvConfidence?.overall ?? 'weak'
}

function candidateLabel(candidate: KataGoCandidate, rank: number, confidence: PvConfidenceLevel): string {
  const visits = Math.max(0, Number(candidate.visits ?? 0) || 0)
  const pv = candidate.pv?.slice(0, 6).join(' ') || '无 PV'
  return `#${rank} ${candidate.move} · ${visits} visits · PV ${confidence} · ${pv}`
}

export function buildBoardPvPreviewState(input: {
  analysis: KataGoMoveAnalysis
  candidateMove?: string
  locked?: boolean
}): BoardPvPreviewState | null {
  const candidates = input.analysis.before.topMoves.length ? input.analysis.before.topMoves : input.analysis.after.topMoves
  if (candidates.length === 0) return null
  const target = input.candidateMove?.trim().toUpperCase()
  const index = target ? candidates.findIndex((candidate) => candidate.move.trim().toUpperCase() === target) : 0
  const candidate = candidates[index >= 0 ? index : 0]
  if (!candidate) return null
  const confidence = candidateConfidence(input.analysis, candidate.move)
  return {
    anchorMove: candidate.move,
    pv: candidate.pv?.slice(0, 12) ?? [],
    confidence,
    locked: Boolean(input.locked),
    label: candidateLabel(candidate, (index >= 0 ? index : 0) + 1, confidence),
    warning: confidence === 'weak' || confidence === 'unstable' ? 'PV 支撑较弱，只适合参考。' : undefined
  }
}

export function stepPvPreview(state: BoardPvPreviewState, direction: 1 | -1, currentIndex: number): number {
  if (state.pv.length === 0) return 0
  return Math.max(0, Math.min(state.pv.length - 1, currentIndex + direction))
}

export function formatPvForTooltip(state: BoardPvPreviewState | null): string {
  if (!state) return ''
  return [state.label, state.warning, state.pv.length ? `变化：${state.pv.join(' → ')}` : '暂无可展示变化'].filter(Boolean).join('\n')
}

export function buildEvidenceHighlightFromText(text: string): BoardEvidenceHighlight[] {
  const highlights: BoardEvidenceHighlight[] = []
  for (const match of text.matchAll(/第\s*(\d+)\s*手/g)) {
    highlights.push({ moveNumber: Number(match[1]), label: `第 ${match[1]} 手`, reason: 'teacher-move-reference' })
  }
  for (const match of text.matchAll(/\b([A-HJ-T](?:1[0-9]|[1-9]))\b/gi)) {
    highlights.push({ point: match[1].toUpperCase(), label: match[1].toUpperCase(), reason: 'teacher-coordinate-reference' })
  }
  return highlights
}
