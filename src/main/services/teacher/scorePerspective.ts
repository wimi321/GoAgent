import type { KataGoScoreSummary, StoneColor } from '@main/lib/types'

export function roundScore(value: number | undefined, digits = 2): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function scoreLeadForColor(blackScoreLead: number | undefined, color: StoneColor): number {
  const value = typeof blackScoreLead === 'number' && Number.isFinite(blackScoreLead) ? blackScoreLead : 0
  return color === 'B' ? value : -value
}

export function scoreSummaryFromBlackLead(
  blackScoreLead: number | undefined,
  perspectiveColor?: StoneColor
): KataGoScoreSummary {
  const blackLead = typeof blackScoreLead === 'number' && Number.isFinite(blackScoreLead) ? blackScoreLead : 0
  const leadPoints = roundScore(Math.abs(blackLead), 1)
  const leader: KataGoScoreSummary['leader'] = leadPoints < 0.1 ? 'even' : blackLead > 0 ? 'B' : 'W'
  const text = leader === 'even'
    ? '双方目差接近均势'
    : `${leader === 'B' ? '黑' : '白'}领先约 ${leadPoints} 目`
  return {
    signConvention: 'black-positive',
    perspectiveColor,
    perspectiveScoreLead: perspectiveColor ? roundScore(scoreLeadForColor(blackLead, perspectiveColor), 2) : undefined,
    blackScoreLead: roundScore(blackLead, 2),
    whiteScoreLead: roundScore(-blackLead, 2),
    leader,
    leadPoints,
    text
  }
}
