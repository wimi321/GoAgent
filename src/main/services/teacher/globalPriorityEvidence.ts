import type { KataGoMoveAnalysis } from '@main/lib/types'

export interface GlobalPriorityInput {
  gameId?: string
  moveNumber: number
  boardSize: number
  boardTiming: 'before-move'
  boardSnapshot?: Array<{ point: string; color: 'B' | 'W' }>
  playedMove: string
  playerColor: 'B' | 'W'
  /** Pass the expected active branch hash; omission expects the main line. */
  trialBranchHash?: string
  analysis?: KataGoMoveAnalysis
}

export interface GlobalPriorityEvidence {
  status: 'compared' | 'unavailable'
  narrativePriority: 'global-priority' | 'local-or-undetermined'
  boardTiming: 'before-move'
  comparison?: {
    bestMove: string
    playedMove: string
    playerColor: 'B' | 'W'
    source: 'before-root-candidates' | 'before-root-and-forced-played'
    valuePerspective: 'current-player'
    distanceMetric: 'chebyshev'
    distance: number
    distantThreshold: number
    bestWinrate: number
    playedWinrate: number
    winrateGapPercentagePoints: number
    bestScoreLead: number
    playedScoreLead: number
    scoreGap: number
    bestVisits: number
    playedVisits: number
    totalVisits: number
    rootVisitSource: 'analysis-quality' | 'unavailable'
    significantGap: boolean
    reliableSearch: boolean
    winrateSaturated: boolean
  }
  bestLocalAlternative?: {
    move: string
    source: 'before-root-candidate'
    distanceFromPlayed: number
    visits: number
    winrate: number
    scoreLead: number
    scoreGapFromBest: number
    winrateGapFromBestPercentagePoints: number
    winrateSaturated: boolean
    nearBest: boolean
  }
  warnings: string[]
  prompt: string
}

const columns = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
function coordinate(value: string, size: number): { x: number; y: number; gtp: string } | undefined {
  const match = /^([A-HJ-Z])([1-9]\d*)$/.exec(value.trim().toUpperCase())
  if (!match) return undefined
  const x = columns.indexOf(match[1])
  const y = Number(match[2]) - 1
  return x >= 0 && x < size && y >= 0 && y < size ? { x, y, gtp: `${match[1]}${y + 1}` } : undefined
}

/** Compare alternative root choices, never the before/after root evaluations. */
export function buildGlobalPriorityEvidence(input: GlobalPriorityInput): GlobalPriorityEvidence {
  const unavailable = (reason: string): GlobalPriorityEvidence => ({
    status: 'unavailable', narrativePriority: 'local-or-undetermined', boardTiming: 'before-move',
    warnings: [reason], prompt: `全局优先级证据不足：${reason} 不可把落子前后估值差当作同局面候选损失。`
  })
  const analysis = input.analysis
  if (input.boardTiming !== 'before-move' || !Number.isInteger(input.boardSize) || input.boardSize < 2 || input.boardSize > 25 ||
    !Number.isInteger(input.moveNumber) || input.moveNumber < 1 || !analysis || analysis.moveNumber !== input.moveNumber ||
    analysis.boardSize !== input.boardSize || (input.gameId && analysis.gameId !== input.gameId) ||
    (analysis.trialContext?.active ? analysis.trialContext.branchHash : undefined) !== input.trialBranchHash) {
    return unavailable('分析的棋谱、手数、棋盘大小、分支或落子时点不匹配。')
  }
  const played = coordinate(input.playedMove, input.boardSize)
  const current = analysis.currentMove
  if (!played || !current || current.pass || current.color !== input.playerColor ||
    current.moveNumber !== input.moveNumber || coordinate(current.gtp, input.boardSize)?.gtp !== played.gtp) {
    return unavailable('当前落点或颜色身份无效（停一手不能用于空间距离比较）。')
  }
  if (!input.boardSnapshot) return unavailable('缺少落子前棋盘，无法核对落点是否为空。')
  const occupied = new Set<string>()
  for (const stone of input.boardSnapshot) {
    const point = coordinate(stone.point, input.boardSize)
    if (!point || !['B', 'W'].includes(stone.color) || occupied.has(point.gtp)) return unavailable('落子前棋盘坐标或棋子数据无效。')
    occupied.add(point.gtp)
  }
  const topMoves = analysis.before.topMoves
  // Preserve the engine's root ranking; sorting by score would manufacture a different recommendation.
  const best = topMoves[0]
  const bestPoint = best && coordinate(best.move, input.boardSize)
  if (!bestPoint || occupied.has(bestPoint.gtp) || occupied.has(played.gtp)) return unavailable('首选或实战坐标无效、停一手或已占据。')
  const rootPlayed = topMoves.find((candidate) => coordinate(candidate.move, input.boardSize)?.gtp === played.gtp)
  const matchingPlayedValue = coordinate(analysis.playedMove?.move ?? '', input.boardSize)?.gtp === played.gtp ? analysis.playedMove : undefined
  if (matchingPlayedValue?.source === 'after-root') return unavailable('实战估值来源是 after-root，与展示候选来源冲突，不能用于同局面比较。')
  const forced = matchingPlayedValue?.source === 'forced' ? matchingPlayedValue : undefined
  // Forced queries are merged into display topMoves. The explicit provenance must
  // survive that merge; merely finding the coordinate in the array is not proof
  // that the value was produced by the ordinary unrestricted root search.
  const actual = forced ?? rootPlayed
  if (!actual) return unavailable('缺少同一落子前局面的实战候选估值；after-root 不能替代。')
  for (const value of [best, actual]) {
    if (!Number.isFinite(value.winrate) || value.winrate < 0 || value.winrate > 100 || !Number.isFinite(value.scoreLead) ||
      !Number.isFinite(value.visits) || (value.visits ?? 0) < 0) return unavailable('候选估值或搜索次数无效。')
  }
  const sign = input.playerColor === 'B' ? 1 : -1
  const perspectiveWinrate = (value: number): number => sign === 1 ? value : 100 - value
  const bestWinrate = perspectiveWinrate(best.winrate)
  const playedWinrate = perspectiveWinrate(actual.winrate)
  const scoreGap = sign * (best.scoreLead - actual.scoreLead)
  const winrateGap = bestWinrate - playedWinrate
  const distance = Math.max(Math.abs(bestPoint.x - played.x), Math.abs(bestPoint.y - played.y))
  const distantThreshold = Math.max(4, Math.ceil(input.boardSize / 3))
  const winrateSaturated = [bestWinrate, playedWinrate].some((value) => value <= 2 || value >= 98)
  const significantGap = scoreGap >= 3 || (!winrateSaturated && winrateGap >= 8)
  const localCandidates = topMoves.flatMap((candidate) => {
    const point = coordinate(candidate.move, input.boardSize)
    if (!point || point.gtp === played.gtp || occupied.has(point.gtp) || !Number.isFinite(candidate.visits) || candidate.visits < 32 ||
      !Number.isFinite(candidate.winrate) || candidate.winrate < 0 || candidate.winrate > 100 || !Number.isFinite(candidate.scoreLead)) return []
    const distanceFromPlayed = Math.max(Math.abs(point.x - played.x), Math.abs(point.y - played.y))
    if (distanceFromPlayed >= distantThreshold) return []
    const winrate = perspectiveWinrate(candidate.winrate)
    const scoreLead = sign * candidate.scoreLead
    const scoreGapFromBest = sign * best.scoreLead - scoreLead
    const winrateGapFromBestPercentagePoints = bestWinrate - winrate
    const saturated = [bestWinrate, winrate].some((value) => value <= 2 || value >= 98)
    return [{ move: point.gtp, source: 'before-root-candidate' as const, distanceFromPlayed, visits: candidate.visits, winrate, scoreLead,
      scoreGapFromBest, winrateGapFromBestPercentagePoints,
      winrateSaturated: saturated,
      nearBest: scoreGapFromBest <= 1 || (!saturated && winrateGapFromBestPercentagePoints <= 2) }]
  })
  // A single strong alternative in the same area defeats a region-wide inference
  // from the poor played point. Otherwise preserve the engine's root ordering.
  const bestLocalAlternative = localCandidates.find((candidate) => candidate.nearBest) ?? localCandidates[0]
  // before.topMoves may include a separately forced played query with many visits.
  // Summing its display rows would incorrectly upgrade a shallow root search.
  const reportedRootVisits = analysis.analysisQuality?.totalVisits
  const hasRootVisits = typeof reportedRootVisits === 'number' && Number.isFinite(reportedRootVisits) && reportedRootVisits >= 0
  const totalVisits = hasRootVisits ? reportedRootVisits : 0
  const bestVisits = best.visits
  const playedVisits = actual.visits ?? 0
  const reliableSearch = ['medium', 'high'].includes(analysis.analysisQuality?.confidence ?? '') && bestVisits >= 32 && playedVisits >= 32 && totalVisits >= 160 &&
    analysis.runtimeEvidence?.teachingReadiness?.canUseInFinalReport !== false
  const warnings: string[] = []
  if (!hasRootVisits) warnings.push('根搜索总次数未知，不能把单独强制实战查询的次数加进根搜索。')
  if (!reliableSearch) warnings.push('搜索证据偏弱或教学就绪检查未通过，先加深分析；不能确定全局急所。')
  if (analysis.analysisQuality?.deepenRecommended) warnings.push('引擎建议加深搜索，结论应表述为当前搜索倾向。')
  if (winrateSaturated) warnings.push('胜率处于极端区间，显著差距只采用目差，不能单靠胜率定性。')
  if (scoreGap < 0 || winrateGap < 0) warnings.push('首选并非所有估值指标都占优，不应夸大差距。')
  if (!bestLocalAlternative) warnings.push('未找到有足够搜索次数的其他本地候选；实战点较差不等于整个局部不值得下。')
  warnings.push('距离与估值支持优先级比较，不能单独证明分断、封锁大龙、死活或先手原因。')
  const globalPriority = distance >= distantThreshold && significantGap && reliableSearch && !bestLocalAlternative?.nearBest
  const comparison: NonNullable<GlobalPriorityEvidence['comparison']> = {
    bestMove: bestPoint.gtp, playedMove: played.gtp, playerColor: input.playerColor,
    source: forced ? 'before-root-and-forced-played' : 'before-root-candidates', valuePerspective: 'current-player',
    distanceMetric: 'chebyshev', distance, distantThreshold, bestWinrate, playedWinrate,
    winrateGapPercentagePoints: winrateGap, bestScoreLead: sign * best.scoreLead, playedScoreLead: sign * actual.scoreLead,
    scoreGap, bestVisits, playedVisits, totalVisits, rootVisitSource: hasRootVisits ? 'analysis-quality' : 'unavailable', significantGap, reliableSearch, winrateSaturated
  }
  const prompt = [
    `全局优先级（第${input.moveNumber}手落子前，同一落子前局面估值；${input.playerColor === 'B' ? '黑' : '白'}方视角${forced ? '；实战估值来自单独强制搜索' : '；两点均为根候选'}）：首选 ${bestPoint.gtp}，实战 ${played.gtp}；棋盘最大轴距离 ${distance}（远处阈值 ${distantThreshold}）。`,
    `首选/实战胜率 ${bestWinrate.toFixed(1)}% / ${playedWinrate.toFixed(1)}%，差 ${winrateGap.toFixed(1)} 个百分点；目差 ${comparison.bestScoreLead.toFixed(1)} / ${comparison.playedScoreLead.toFixed(1)}，差 ${scoreGap.toFixed(1)} 目；候选搜索次数 ${bestVisits} / ${playedVisits}，根搜索总次数 ${hasRootVisits ? totalVisits : '未知'}（来源 ${comparison.rootVisitSource}）。估值来源 ${comparison.source}。`,
    ...(significantGap && reliableSearch ? [`具体着手评价：按当前搜索，实战 ${played.gtp} 相比首选 ${bestPoint.gtp} 有明显估值损失；简短解说也应点出这一选择问题，并用已核验的棋盘效果解释首选用途。是否距离远、是否存在接近首选的本地替代，只影响整个局部优先级的判断，不能抹去具体实战点的损失。`] : []),
    ...(bestLocalAlternative ? [`本地其他候选 ${bestLocalAlternative.move}（距实战 ${bestLocalAlternative.distanceFromPlayed}，搜索 ${bestLocalAlternative.visits} 次）；较首选差 ${bestLocalAlternative.scoreGapFromBest.toFixed(1)} 目 / ${bestLocalAlternative.winrateGapFromBestPercentagePoints.toFixed(1)} 个百分点。`] : []),
    bestLocalAlternative?.nearBest ? `本局部仍可处理，实战点选择有差别：本地 ${bestLocalAlternative.move} 与首选接近，不能把实战 ${played.gtp} 的损失归因于整个局部不重要。`
      : globalPriority ? bestLocalAlternative && (bestLocalAlternative.scoreGapFromBest >= 3 || (!bestLocalAlternative.winrateSaturated && bestLocalAlternative.winrateGapFromBestPercentagePoints >= 8))
        ? `解说主线应先说明：按当前 KataGo 搜索，首选 ${bestPoint.gtp} 也明显优于已搜索的本地替代 ${bestLocalAlternative.move}，本手更值得优先处理远处；再解释实战局部。`
        : `解说主线应先说明：当前前列搜索更倾向远处，先比较 ${bestPoint.gtp} 一带，再解释实战 ${played.gtp}；不能据此断言整个局部不重要。`
      : distance >= distantThreshold && significantGap ? `当前搜索更建议远处 ${bestPoint.gtp} 一带，相比具体实战点 ${played.gtp} 估值差明显；搜索证据偏弱，需要加深确认，不能说确定错过急所，也不能排除本局部其他好点。`
        : '尚不满足远处首选且估值明显更好的条件，不能仅因首选距离远就说本局部不重要。',
    ...warnings
  ].join('\n')
  return { status: 'compared', narrativePriority: globalPriority ? 'global-priority' : 'local-or-undetermined', boardTiming: 'before-move', comparison, bestLocalAlternative, warnings, prompt }
}
