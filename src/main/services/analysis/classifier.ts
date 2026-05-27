import type { AnalysisConfidence, AnalysisQuality, KataGoMoveAnalysis, MoveClassification, MoveClassificationSeverity } from '@main/lib/types'

function round(value: number | undefined, digits = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function defaultPhase(analysis: KataGoMoveAnalysis): AnalysisQuality['phase'] {
  return analysis.analysisQuality?.phase ?? (analysis.moveNumber <= 50 ? 'opening' : analysis.moveNumber <= 160 ? 'middle' : 'endgame')
}

function phaseSeverity(phase: AnalysisQuality['phase'], winrateLoss: number, scoreLoss: number): MoveClassificationSeverity {
  if (phase === 'endgame') {
    if (scoreLoss >= 6 || winrateLoss >= 18) return 'blunder'
    if (scoreLoss >= 3 || winrateLoss >= 9) return 'mistake'
    if (scoreLoss >= 1.2 || winrateLoss >= 3) return 'inaccuracy'
    return 'good'
  }

  if (phase === 'opening') {
    if (winrateLoss >= 15 || scoreLoss >= 6) return 'blunder'
    if (winrateLoss >= 7 || scoreLoss >= 3.5) return 'mistake'
    if (winrateLoss >= 2.5 || scoreLoss >= 1.8) return 'inaccuracy'
    return 'good'
  }

  if (winrateLoss >= 15 || scoreLoss >= 6) return 'blunder'
  if (winrateLoss >= 7 || scoreLoss >= 3) return 'mistake'
  if (winrateLoss >= 2.5 || scoreLoss >= 1.5) return 'inaccuracy'
  return 'good'
}

function capConfidence(value: AnalysisConfidence, cap: AnalysisConfidence): AnalysisConfidence {
  const rank: Record<AnalysisConfidence, number> = { low: 1, medium: 2, high: 3 }
  return rank[value] > rank[cap] ? cap : value
}

function confidenceFromEvidence(
  quality: KataGoMoveAnalysis['analysisQuality'],
  severity: MoveClassificationSeverity,
  actualVisits: number,
  bestVisits: number
): AnalysisConfidence {
  let confidence: AnalysisConfidence = quality?.confidence ?? 'medium'
  if (severity === 'good' && bestVisits < 160) confidence = capConfidence(confidence, 'medium')
  if (actualVisits > 0 && actualVisits < 80) confidence = capConfidence(confidence, 'medium')
  if (bestVisits < 80) confidence = capConfidence(confidence, 'low')
  if (quality?.deepenRecommended) confidence = capConfidence(confidence, quality.confidence === 'high' ? 'medium' : quality.confidence)
  return confidence
}

function shouldTeachMove(severity: MoveClassificationSeverity, confidence: AnalysisConfidence, winrateLoss: number, scoreLoss: number): boolean {
  if (severity === 'blunder' || severity === 'mistake') return true
  if (severity === 'inaccuracy' && confidence !== 'low') return true
  return winrateLoss >= 4 || scoreLoss >= 2
}

function buildReason(input: {
  severity: MoveClassificationSeverity
  confidence: AnalysisConfidence
  phase: AnalysisQuality['phase']
  winrateLoss: number
  scoreLoss: number
  actualVisits: number
  bestVisits: number
  qualityReason?: string
}): string {
  const base = `phase=${input.phase}, severity=${input.severity}, confidence=${input.confidence}, winrateLoss=${round(input.winrateLoss)}%, scoreLoss=${round(input.scoreLoss)}, bestVisits=${input.bestVisits}, actualVisits=${input.actualVisits}.`
  return input.qualityReason ? `${base} ${input.qualityReason}` : base
}

export function classifyMoveAnalysis(analysis: KataGoMoveAnalysis): MoveClassification {
  const phase = defaultPhase(analysis)
  const winrateLoss = round(analysis.playedMove?.winrateLoss ?? 0, 2)
  const scoreLoss = round(analysis.playedMove?.scoreLoss ?? 0, 2)
  const bestVisits = Math.max(0, Number(analysis.before.topMoves[0]?.visits ?? analysis.analysisQuality?.bestVisits ?? 0) || 0)
  const actualVisits = Math.max(0, Number(analysis.playedMove?.visits ?? analysis.analysisQuality?.actualVisits ?? 0) || 0)
  const warnings: string[] = []

  if (!analysis.currentMove || !analysis.playedMove) {
    return {
      severity: 'unclear',
      confidence: 'low',
      phase,
      winrateLoss: 0,
      scoreLoss: 0,
      shouldTeach: false,
      shouldDeepen: true,
      reason: 'No played move evidence is available for this position.',
      evidenceWarnings: ['missing-played-move-evidence']
    }
  }

  const severity = phaseSeverity(phase, winrateLoss, scoreLoss)
  const confidence = confidenceFromEvidence(analysis.analysisQuality, severity, actualVisits, bestVisits)
  const shouldDeepen = Boolean(
    analysis.analysisQuality?.deepenRecommended ||
    (severity !== 'good' && confidence === 'low') ||
    (winrateLoss >= 4 && actualVisits < 120) ||
    bestVisits < 120
  )

  if (actualVisits > 0 && actualVisits < 80) warnings.push('actual-move-low-visits')
  if (bestVisits < 120) warnings.push('best-move-low-visits')
  if (analysis.analysisQuality?.deepenRecommended) warnings.push('analysis-quality-recommends-deeper-search')

  return {
    severity,
    confidence,
    phase,
    winrateLoss,
    scoreLoss,
    shouldTeach: shouldTeachMove(severity, confidence, winrateLoss, scoreLoss),
    shouldDeepen,
    reason: buildReason({ severity, confidence, phase, winrateLoss, scoreLoss, actualVisits, bestVisits, qualityReason: analysis.analysisQuality?.reason }),
    evidenceWarnings: warnings
  }
}
