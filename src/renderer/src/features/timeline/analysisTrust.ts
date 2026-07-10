import type { AnalysisConfidence, KataGoMoveAnalysis, MoveClassificationSeverity } from '@main/lib/types'

export type AnalysisDisplaySeverity = 'quiet' | 'inaccuracy' | 'mistake' | 'blunder'
export type AnalysisEvidenceState = 'verified' | 'provisional' | 'insufficient'

export interface AnalysisTrustAssessment {
  severity: AnalysisDisplaySeverity
  confidence: AnalysisConfidence
  evidenceState: AnalysisEvidenceState
  shouldTeach: boolean
  shouldDeepen: boolean
  winrateLoss: number
  scoreLoss: number
}

function finiteMetric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.abs(value)) : 0
}

function legacySeverity(analysis: KataGoMoveAnalysis): MoveClassificationSeverity {
  if (analysis.judgement === 'good_move') return 'good'
  if (analysis.judgement === 'unknown') return 'unclear'
  return analysis.judgement
}

function displaySeverity(severity: MoveClassificationSeverity): AnalysisDisplaySeverity {
  if (severity === 'blunder' || severity === 'mistake' || severity === 'inaccuracy') return severity
  return 'quiet'
}

export function assessAnalysisTrust(analysis: KataGoMoveAnalysis): AnalysisTrustAssessment {
  const classification = analysis.moveClassification
  const severity = classification?.severity ?? legacySeverity(analysis)
  const confidence = classification?.confidence ?? analysis.analysisQuality?.confidence ?? 'low'
  const winrateLoss = finiteMetric(classification?.winrateLoss ?? analysis.playedMove?.winrateLoss)
  const scoreLoss = finiteMetric(classification?.scoreLoss ?? analysis.playedMove?.scoreLoss)
  const shouldTeach = classification?.shouldTeach ?? (severity !== 'good' && severity !== 'unclear')
  const shouldDeepen = Boolean(
    classification?.shouldDeepen ||
    analysis.analysisQuality?.deepenRecommended ||
    analysis.pvConfidence?.shouldDeepen
  )
  const bestVisits = Math.max(
    0,
    Number(analysis.analysisQuality?.bestVisits ?? analysis.before.topMoves[0]?.visits ?? 0) || 0
  )
  const actualVisits = Math.max(
    0,
    Number(analysis.playedMove?.visits ?? analysis.analysisQuality?.actualVisits ?? 0) || 0
  )
  const actualSource = analysis.playedMove?.source
  const hasDirectActualEvidence = actualSource === 'candidate' || actualSource === 'forced' || actualVisits >= 80
  const verified = Boolean(
    analysis.currentMove &&
    analysis.playedMove &&
    hasDirectActualEvidence &&
    bestVisits >= 80 &&
    confidence !== 'low'
  )
  const evidenceState: AnalysisEvidenceState = verified
    ? 'verified'
    : analysis.currentMove && analysis.playedMove
      ? 'provisional'
      : 'insufficient'

  return {
    severity: verified && shouldTeach ? displaySeverity(severity) : 'quiet',
    confidence,
    evidenceState,
    shouldTeach,
    shouldDeepen,
    winrateLoss,
    scoreLoss
  }
}

export function analysisDisplaySeverity(analysis: KataGoMoveAnalysis): AnalysisDisplaySeverity {
  return assessAnalysisTrust(analysis).severity
}

export function isVerifiedTimelineIssue(analysis: KataGoMoveAnalysis, minimumLoss = 1): boolean {
  const assessment = assessAnalysisTrust(analysis)
  return assessment.evidenceState === 'verified' && assessment.shouldTeach && assessment.severity !== 'quiet' && assessment.winrateLoss >= minimumLoss
}
