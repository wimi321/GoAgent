import type { KataGoCandidate, KataGoMoveAnalysis, PvConfidenceCandidate, PvConfidenceLevel, PvConfidenceReport } from '@main/lib/types'

function rankLevel(level: PvConfidenceLevel): number {
  return { unstable: 0, weak: 1, medium: 2, strong: 3 }[level]
}

function weakest(left: PvConfidenceLevel, right: PvConfidenceLevel): PvConfidenceLevel {
  return rankLevel(left) <= rankLevel(right) ? left : right
}

function pvVisitsTotal(candidate: KataGoCandidate): number | undefined {
  if (!candidate.pvVisits?.length) return undefined
  return candidate.pvVisits.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
}

function candidateLevel(candidate: KataGoCandidate, rank: number, bestVisits: number, unstableRoot: boolean): PvConfidenceCandidate {
  const visits = Math.max(0, Number(candidate.visits ?? 0) || 0, Number(candidate.edgeVisits ?? 0) || 0)
  const pvLength = candidate.pv?.length ?? 0
  const pvTotal = pvVisitsTotal(candidate)
  let level: PvConfidenceLevel = 'weak'
  const reasons: string[] = []

  if (unstableRoot) {
    level = 'unstable'
    reasons.push('root-analysis-unstable')
  } else if (visits >= 700 && pvLength >= 6) {
    level = 'strong'
    reasons.push('high-visits-and-long-pv')
  } else if (visits >= 220 && pvLength >= 4) {
    level = 'medium'
    reasons.push('moderate-visits-and-usable-pv')
  } else if (visits < 80 || pvLength < 3) {
    level = 'weak'
    reasons.push('low-visits-or-short-pv')
  }

  if (rank > 1 && bestVisits > 0 && visits / bestVisits < 0.18) {
    level = weakest(level, 'weak')
    reasons.push('candidate-far-below-best-visits')
  }
  if (pvTotal !== undefined && pvTotal < Math.max(40, visits * 0.15)) {
    level = weakest(level, 'medium')
    reasons.push('pv-visits-thin')
  }

  return {
    move: candidate.move,
    rank,
    level,
    visits,
    pvLength,
    pvVisitsTotal: pvTotal,
    reason: reasons.join('; ') || 'pv evidence is usable but not deeply qualified'
  }
}

function wording(level: PvConfidenceLevel): string {
  if (level === 'strong') return '这条变化比较稳定，可以作为主线理解。'
  if (level === 'medium') return 'AI 倾向这条变化，教学上可以参考，但不要说成唯一结果。'
  if (level === 'weak') return '这只是参考变化，适合说明方向，不宜讲成必然。'
  return '当前搜索不够稳定，建议加深分析后再下定论。'
}

export function buildPvConfidenceReport(analysis: KataGoMoveAnalysis): PvConfidenceReport {
  const bestVisits = Math.max(0, Number(analysis.before.topMoves[0]?.visits ?? analysis.analysisQuality?.bestVisits ?? 0) || 0)
  const unstableRoot = Boolean(analysis.analysisQuality?.deepenRecommended && analysis.analysisQuality.confidence === 'low')
  const candidates = analysis.before.topMoves.slice(0, 5).map((candidate, index) => candidateLevel(candidate, index + 1, bestVisits, unstableRoot))

  const overall = candidates.length === 0
    ? 'unstable'
    : candidates.map((candidate) => candidate.level).reduce<PvConfidenceLevel>((current, next) => {
        if (current === 'strong') return next
        if (next === 'unstable') return 'unstable'
        return rankLevel(next) > rankLevel(current) ? next : current
      }, 'unstable')

  const stableMainLine = overall === 'strong' || overall === 'medium'
  const shouldDeepen = overall === 'weak' || overall === 'unstable' || Boolean(analysis.analysisQuality?.deepenRecommended)
  return {
    overall,
    stableMainLine,
    shouldDeepen,
    summary: candidates.length
      ? `PV confidence=${overall}; best=${candidates[0]?.move ?? 'unknown'}; candidates=${candidates.map((candidate) => `${candidate.move}:${candidate.level}`).join(', ')}`
      : 'PV confidence=unstable; no candidate PV is available.',
    recommendedWording: wording(overall),
    candidates
  }
}
