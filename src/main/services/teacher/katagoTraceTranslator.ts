import type {
  AnalysisQuality,
  CoachUserLevel,
  KataGoCandidate,
  KataGoHumanPolicySignals,
  KataGoMoveAnalysis,
  KataGoOwnershipRegionSummary,
  KataGoPolicySearchDelta,
  KataGoPvSupport,
  KataGoTraceCandidate,
  KataGoTracePacket,
  KataGoTraceTeachingRole,
  KataGoTraceTreeNode
} from '@main/lib/types'
import { scoreSummaryFromBlackLead } from './scorePerspective'

const GTP_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'

function round(value: number | undefined, digits = 2): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function key(move: string | undefined): string {
  return (move ?? '').trim().toUpperCase()
}

function candidateEvidenceVisits(candidate: KataGoCandidate | undefined): number {
  return Math.max(0, Number(candidate?.visits ?? 0) || 0, Number(candidate?.edgeVisits ?? 0) || 0)
}

function pvSupportForCandidate(candidate: KataGoCandidate): KataGoPvSupport {
  const visits = candidate.pvVisits?.filter((value) => Number.isFinite(value)) ?? []
  const minVisits = visits.length ? Math.min(...visits.slice(0, Math.min(5, visits.length))) : 0
  const bestVisits = candidateEvidenceVisits(candidate)
  let support: KataGoPvSupport['support'] = 'weak'
  let warning = ''
  if (candidate.pv.length === 0) {
    warning = 'KataGo 没有返回 PV；不能展开变化讲解。'
  } else if (visits.length === 0) {
    support = bestVisits >= 500 ? 'medium' : 'weak'
    warning = '缺少 pvVisits；只能把 PV 作为参考变化，不要说成必然。'
  } else if (minVisits >= 120 || bestVisits >= 800) {
    support = 'strong'
  } else if (minVisits >= 40 || bestVisits >= 300) {
    support = 'medium'
    warning = 'PV 中后段搜索量不高；只宜讲前几手关键变化。'
  } else {
    support = 'weak'
    warning = 'PV 支撑较弱；不要把长变化说成铁线。'
  }
  return {
    candidate: candidate.move,
    pv: candidate.pv.slice(0, 10),
    pvVisits: candidate.pvVisits?.slice(0, 10),
    support,
    warning: warning || undefined
  }
}

function priorRanks(candidates: KataGoCandidate[]): Map<string, number> {
  const ranked = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => typeof candidate.prior === 'number' && Number.isFinite(candidate.prior))
    .sort((left, right) => (right.candidate.prior ?? 0) - (left.candidate.prior ?? 0) || left.index - right.index)
  const ranks = new Map<string, number>()
  ranked.forEach(({ candidate }, index) => ranks.set(key(candidate.move), index + 1))
  return ranks
}

function policyDeltaInterpretation(candidate: KataGoCandidate, searchRank: number, priorRank?: number): KataGoPolicySearchDelta['interpretation'] {
  if (!priorRank || candidate.prior === undefined) return 'insufficient-policy-evidence'
  if (priorRank <= 2 && searchRank <= 2) return 'policy-and-search-agree'
  if (priorRank <= 2 && searchRank >= 4) return 'natural-move-refuted-by-search'
  if (priorRank >= 5 && searchRank <= 2) return 'non-obvious-search-favorite'
  if (Math.abs(priorRank - searchRank) >= 3) return 'search-overturned-policy'
  return 'policy-and-search-agree'
}

function policyDeltaNote(candidate: KataGoCandidate, searchRank: number, priorRank?: number): string {
  const prior = typeof candidate.prior === 'number' ? `${round(candidate.prior, 1)}%` : '未知'
  if (!priorRank) return `缺少 policy/prior 排名，不能判断第一感与搜索是否一致。搜索排名 ${searchRank}，prior=${prior}。`
  const interpretation = policyDeltaInterpretation(candidate, searchRank, priorRank)
  if (interpretation === 'policy-and-search-agree') return `policy 与搜索基本一致：prior 排名 ${priorRank}，搜索排名 ${searchRank}。`
  if (interpretation === 'natural-move-refuted-by-search') return `这手看起来很自然：prior 排名 ${priorRank}，但搜索后跌到第 ${searchRank}，应解释为“自然但被搜索否定”。`
  if (interpretation === 'non-obvious-search-favorite') return `这手不直观：prior 排名 ${priorRank}，但搜索升到第 ${searchRank}，适合讲成急所/手筋/方向。`
  if (interpretation === 'search-overturned-policy') return `搜索明显修正了 policy 第一感：prior 排名 ${priorRank}，搜索排名 ${searchRank}。`
  return `搜索排名 ${searchRank}，prior 排名 ${priorRank}。`
}

function candidateRole(
  candidate: KataGoCandidate,
  searchRank: number,
  priorRank: number | undefined,
  actualMove: string | undefined,
  pvSupport: KataGoPvSupport,
  analysis: KataGoMoveAnalysis
): KataGoTraceTeachingRole {
  const isBest = searchRank === 1
  const isActual = actualMove && key(candidate.move) === key(actualMove)
  const policyDelta = policyDeltaInterpretation(candidate, searchRank, priorRank)
  const loss = analysis.playedMove?.scoreLoss ?? 0
  if (isBest) return 'best'
  if (isActual && loss >= 1.5 && (candidate.humanPrior ?? candidate.humanPolicy ?? 0) >= 8) return 'human-likely-mistake'
  if (isActual) return 'actual'
  if (policyDelta === 'natural-move-refuted-by-search') return 'natural-but-refuted'
  if (policyDelta === 'non-obvious-search-favorite') return 'low-policy-but-strong-search'
  if (pvSupport.support === 'weak' || candidateEvidenceVisits(candidate) < 80) return 'uncertain'
  return 'uncertain'
}

function roleInterpretation(role: KataGoTraceTeachingRole): string {
  if (role === 'best') return '搜索后的首选，可以作为主线讲。'
  if (role === 'actual') return '这是实战手，应和首选比较，讲清它损失在哪里。'
  if (role === 'natural-but-refuted') return '这手直觉上自然，但搜索后不支持，适合讲“为什么看似合理却亏”。'
  if (role === 'low-policy-but-strong-search') return '这手不直观，但搜索支持，适合讲急所、次序或手筋。'
  if (role === 'human-likely-mistake') return '这像当前水平常见的人类自然错误，应温和解释判断顺序。'
  return '证据不足或排序不突出，只能作为辅助参考。'
}

function candidateWarnings(candidate: KataGoCandidate, pvSupport: KataGoPvSupport, analysis: KataGoMoveAnalysis): string[] {
  const warnings: string[] = []
  if (candidateEvidenceVisits(candidate) < 80) warnings.push('candidate visits 较低，不能讲成定论。')
  if (candidate.scoreStdev !== undefined && candidate.scoreStdev >= 8) warnings.push('scoreStdev 较高，局面不确定性大。')
  if (pvSupport.warning) warnings.push(pvSupport.warning)
  if (analysis.analysisQuality?.confidence !== 'high') warnings.push(`analysisQuality=${analysis.analysisQuality?.confidence}，需要谨慎语气。`)
  return Array.from(new Set(warnings))
}

function buildCandidateComparison(analysis: KataGoMoveAnalysis): KataGoTraceCandidate[] {
  const candidates = analysis.before.topMoves.slice(0, 8)
  const ranks = priorRanks(candidates)
  const actualMove = analysis.playedMove?.move ?? analysis.currentMove?.gtp
  return candidates.map((candidate, index) => {
    const searchRank = index + 1
    const pvSupport = pvSupportForCandidate(candidate)
    const priorRank = ranks.get(key(candidate.move))
    const role = candidateRole(candidate, searchRank, priorRank, actualMove, pvSupport, analysis)
    return {
      move: candidate.move,
      rank: searchRank,
      visits: candidate.visits,
      edgeVisits: candidate.edgeVisits,
      prior: candidate.prior,
      priorRank,
      searchRank,
      winrate: round(candidate.winrate, 2),
      scoreLead: round(candidate.scoreLead, 2),
      blackScoreLead: round(candidate.scoreLead, 2),
      scoreLeadPerspective: 'black-positive',
      scoreSummary: scoreSummaryFromBlackLead(candidate.scoreLead),
      scoreStdev: candidate.scoreStdev,
      utility: candidate.utility,
      lcb: candidate.lcb,
      humanPrior: candidate.humanPrior,
      humanPolicy: candidate.humanPolicy,
      pv: candidate.pv.slice(0, 10),
      pvVisits: candidate.pvVisits?.slice(0, 10),
      teachingRole: role,
      interpretation: roleInterpretation(role),
      warnings: candidateWarnings(candidate, pvSupport, analysis)
    }
  })
}

function buildPolicySearchDelta(candidates: KataGoCandidate[]): KataGoPolicySearchDelta[] {
  const ranks = priorRanks(candidates)
  return candidates.slice(0, 8).map((candidate, index) => {
    const searchRank = index + 1
    const priorRank = ranks.get(key(candidate.move))
    return {
      move: candidate.move,
      prior: candidate.prior,
      priorRank,
      searchRank,
      visits: candidate.visits,
      interpretation: policyDeltaInterpretation(candidate, searchRank, priorRank),
      note: policyDeltaNote(candidate, searchRank, priorRank)
    }
  })
}

function gtpFromIndex(index: number, boardSize: number): string {
  const row = Math.floor(index / boardSize)
  const col = index % boardSize
  const letter = GTP_LETTERS[col] ?? '?'
  return `${letter}${boardSize - row}`
}

function regionForIndex(index: number, boardSize: number): string {
  const row = Math.floor(index / boardSize)
  const col = index % boardSize
  const top = row < boardSize / 3
  const bottom = row >= boardSize * 2 / 3
  const left = col < boardSize / 3
  const right = col >= boardSize * 2 / 3
  if (top && left) return '左上'
  if (top && right) return '右上'
  if (bottom && left) return '左下'
  if (bottom && right) return '右下'
  if (top) return '上边'
  if (bottom) return '下边'
  if (left) return '左边'
  if (right) return '右边'
  return '中腹'
}

function ownershipRegionsFromArrays(
  boardSize: number,
  bestOwnership?: number[],
  actualOwnership?: number[]
): { mode: 'best-vs-actual' | 'best-ownership' | 'unavailable'; note: string; affectedRegions: KataGoOwnershipRegionSummary[] } {
  if (!bestOwnership?.length) {
    return { mode: 'unavailable', note: 'KataGo 没有返回 ownership；不能用厚薄/区域归属作为主证据。', affectedRegions: [] }
  }
  const byRegion = new Map<string, { sum: number; count: number; points: Array<{ point: string; value: number }> }>()
  for (let index = 0; index < Math.min(bestOwnership.length, boardSize * boardSize); index += 1) {
    const best = Number(bestOwnership[index]) || 0
    const value = actualOwnership?.length ? Math.abs(best - (Number(actualOwnership[index]) || 0)) : Math.abs(best)
    if (value < 0.08) continue
    const region = regionForIndex(index, boardSize)
    const entry = byRegion.get(region) ?? { sum: 0, count: 0, points: [] }
    entry.sum += value
    entry.count += 1
    entry.points.push({ point: gtpFromIndex(index, boardSize), value })
    byRegion.set(region, entry)
  }
  const affectedRegions = [...byRegion.entries()]
    .map(([region, entry]) => ({
      region,
      avgSwing: round(entry.sum / Math.max(1, entry.count), 3),
      points: entry.points.sort((left, right) => right.value - left.value).slice(0, 8).map((item) => item.point),
      explanation: actualOwnership?.length
        ? `${region}在首选和实战之间 ownership 摆动明显，可作为厚薄/实地变化证据。`
        : `${region}在首选分支 ownership 信号明显，可作为区域归属参考。`
    }))
    .sort((left, right) => right.avgSwing - left.avgSwing)
    .slice(0, 5)
  return {
    mode: actualOwnership?.length ? 'best-vs-actual' : 'best-ownership',
    note: actualOwnership?.length
      ? 'ownership 摘要比较首选手与实战手对应候选的区域归属差异。'
      : '只有首选 ownership，可作为区域归属参考，不能称为实战差异。',
    affectedRegions
  }
}

function buildOwnershipSummary(analysis: KataGoMoveAnalysis): KataGoTracePacket['ownershipSummary'] {
  const best = analysis.before.topMoves[0]
  const actualMove = analysis.playedMove?.move ?? analysis.currentMove?.gtp
  const actual = analysis.before.topMoves.find((candidate) => key(candidate.move) === key(actualMove))
  return ownershipRegionsFromArrays(analysis.boardSize, best?.ownership, actual?.ownership)
}

function buildHumanPolicySignals(analysis: KataGoMoveAnalysis, level: CoachUserLevel): KataGoHumanPolicySignals | undefined {
  const best = analysis.before.topMoves[0]
  const actualMove = analysis.playedMove?.move ?? analysis.currentMove?.gtp
  const actual = analysis.before.topMoves.find((candidate) => key(candidate.move) === key(actualMove))
  const actualHumanPrior = actual?.humanPrior
  const bestHumanPrior = best?.humanPrior
  const actualHumanPolicy = actual?.humanPolicy
  const bestHumanPolicy = best?.humanPolicy
  if ([actualHumanPrior, bestHumanPrior, actualHumanPolicy, bestHumanPolicy].every((value) => value === undefined)) return undefined
  const humanGap = (actualHumanPrior ?? actualHumanPolicy ?? 0) - (bestHumanPrior ?? bestHumanPolicy ?? 0)
  const loss = analysis.playedMove?.scoreLoss ?? 0
  const levelAppropriateMistake = humanGap >= 4 && loss >= 1
  const levelText = level === 'dan' ? '段位' : level === 'advanced' ? '高级' : level === 'beginner' ? '入门' : '级位/中级'
  return {
    actualHumanPrior,
    bestHumanPrior,
    actualHumanPolicy,
    bestHumanPolicy,
    levelAppropriateMistake,
    interpretation: levelAppropriateMistake
      ? `实战手在人类策略中更自然，但 KataGo 认为有损失；适合作为${levelText}学生常见误区讲解。`
      : `humanPolicy/humanPrior 信号不足以说明这是某一棋力层的典型误区；不要过度贴标签。`
  }
}

function buildPvSupport(candidates: KataGoCandidate[]): KataGoPvSupport[] {
  return candidates.slice(0, 8).map(pvSupportForCandidate)
}

function pvLineAsTree(candidate: KataGoCandidate, support: KataGoPvSupport): KataGoTraceTreeNode[] {
  return candidate.pv.slice(0, 5).map((move, index) => ({
    move,
    depth: index + 2,
    pvSupport: support.support,
    children: []
  })).reduceRight<KataGoTraceTreeNode[]>((children, node) => [{ ...node, children }], [])
}

export function buildShallowSearchTree(analysis: KataGoMoveAnalysis): KataGoTraceTreeNode {
  const pvSupports = new Map(buildPvSupport(analysis.before.topMoves).map((support) => [key(support.candidate), support]))
  return {
    move: 'ROOT',
    depth: 0,
    winrate: round(analysis.before.winrate, 2),
    scoreLead: round(analysis.before.scoreLead, 2),
    scoreLeadPerspective: 'black-positive',
    scoreSummary: scoreSummaryFromBlackLead(analysis.before.scoreLead),
    children: analysis.before.topMoves.slice(0, 5).map((candidate) => {
      const support = pvSupports.get(key(candidate.move)) ?? pvSupportForCandidate(candidate)
      return {
        move: candidate.move,
        depth: 1,
        visits: candidate.visits,
        winrate: round(candidate.winrate, 2),
        scoreLead: round(candidate.scoreLead, 2),
        scoreLeadPerspective: 'black-positive' as const,
        scoreSummary: scoreSummaryFromBlackLead(candidate.scoreLead),
        prior: candidate.prior,
        pvSupport: support.support,
        children: pvLineAsTree(candidate, support)
      }
    })
  }
}

function confidenceFromAnalysis(analysis: KataGoMoveAnalysis, pvSupport: KataGoPvSupport[]): KataGoTracePacket['searchSummary']['confidence'] {
  if (analysis.analysisQuality?.confidence === 'low') return 'low'
  if (analysis.analysisQuality?.confidence === 'medium') return 'medium'
  if (pvSupport.some((support) => support.candidate === analysis.before.topMoves[0]?.move && support.support === 'weak')) return 'medium'
  return 'high'
}

function mainPoint(analysis: KataGoMoveAnalysis, deltas: KataGoPolicySearchDelta[]): string {
  const best = analysis.before.topMoves[0]?.move
  const actual = analysis.playedMove?.move ?? analysis.currentMove?.gtp
  const loss = analysis.playedMove?.scoreLoss ?? 0
  const nonObvious = deltas.find((delta) => delta.interpretation === 'non-obvious-search-favorite')
  const refuted = deltas.find((delta) => delta.move === actual && delta.interpretation === 'natural-move-refuted-by-search')
  if (refuted) return `实战 ${actual} 看似自然，但搜索不支持；主线应解释它为什么被首选 ${best} 替代。`
  if (nonObvious && nonObvious.move === best) return `首选 ${best} 不是最直观第一感，但搜索支持；主线应讲急所、次序或后续收益。`
  if (loss >= 2) return `实战 ${actual} 相比首选 ${best} 有可见损失；主线应讲损失来自哪里。`
  return `候选差距不大；主线应讲判断方向和可复用思路，不要把它说成大恶手。`
}

function safeWording(confidence: KataGoTracePacket['searchSummary']['confidence']): string {
  if (confidence === 'high') return '可以明确说 KataGo 首选和实战差异，但仍需引用证据。'
  if (confidence === 'medium') return '使用“AI 更倾向 / 更像 / 参考变化”措辞，避免唯一和必然。'
  return '只能说低置信倾向，不得下绝对结论或讲长变化。'
}

export function buildKataGoTracePacket(analysis: KataGoMoveAnalysis, level: CoachUserLevel = 'intermediate'): KataGoTracePacket {
  const pvSupport = buildPvSupport(analysis.before.topMoves)
  const policySearchDelta = buildPolicySearchDelta(analysis.before.topMoves)
  const confidence = confidenceFromAnalysis(analysis, pvSupport)
  const bestMove = analysis.before.topMoves[0]?.move
  const actualMove = analysis.playedMove?.move ?? analysis.currentMove?.gtp
  const safe = safeWording(confidence)
  const packet: KataGoTracePacket = {
    position: {
      moveNumber: analysis.moveNumber,
      phase: analysis.analysisQuality?.phase ?? (analysis.moveNumber <= 50 ? 'opening' : analysis.moveNumber <= 160 ? 'middle' : 'endgame'),
      actualMove
    },
    searchSummary: {
      bestMove,
      actualMove,
      winrateLoss: round(analysis.playedMove?.winrateLoss ?? 0, 2),
      scoreLoss: round(analysis.playedMove?.scoreLoss ?? 0, 2),
      confidence,
      safeWording: safe,
      reason: analysis.analysisQuality?.reason ?? 'KataGo trace built from candidate visits, prior, PV and ownership fields.'
    },
    candidateComparison: buildCandidateComparison(analysis),
    scorePerspective: {
      scoreLeadFields: 'black-positive',
      note: 'tracePacket scoreLead/blackScoreLead are black-positive: positive means Black leads, negative means White leads. Use scoreSummary.text/leader/leadPoints for spoken winner and margin.'
    },
    policySearchDelta,
    pvSupport,
    ownershipSummary: buildOwnershipSummary(analysis),
    humanPolicySignals: buildHumanPolicySignals(analysis, level),
    shallowSearchTree: buildShallowSearchTree(analysis),
    teachingGuidance: {
      mainPoint: mainPoint(analysis, policySearchDelta),
      safeWording: safe,
      forbiddenClaims: confidence === 'high'
        ? ['不要编造未在 tracePacket 或 KataGo 中出现的坐标、PV、定式名。']
        : ['唯一', '必杀', '必败', '绝对', '净杀', '无条件成立', '完整定式结论']
    }
  }
  return packet
}

export function formatKataGoTraceForPrompt(packet: KataGoTracePacket | undefined): string {
  if (!packet) return 'KataGo Trace Packet: 未生成。请只引用原始 KataGo 数据，且谨慎表达。'
  const scorePerspectiveNote = packet.scorePerspective?.note
    ?? 'tracePacket scoreLead is black-positive: positive means Black leads, negative means White leads.'
  return [
    '【KataGo Trace Packet】',
    `局面：第 ${packet.position.moveNumber} 手，阶段 ${packet.position.phase}。`,
    `搜索摘要：首选 ${packet.searchSummary.bestMove ?? '未知'}，实战 ${packet.searchSummary.actualMove ?? '未知'}，胜率损失 ${packet.searchSummary.winrateLoss}%，目差损失 ${packet.searchSummary.scoreLoss}，置信度 ${packet.searchSummary.confidence}。`,
    `目差口径：${scorePerspectiveNote}`,
    `安全措辞：${packet.searchSummary.safeWording}`,
    `主讲重点：${packet.teachingGuidance.mainPoint}`,
    `policy-vs-search：${packet.policySearchDelta.slice(0, 4).map((delta) => `${delta.move}: ${delta.note}`).join('；') || '无'}`,
    `PV 支撑：${packet.pvSupport.slice(0, 4).map((support) => `${support.candidate}=${support.support}${support.warning ? `(${support.warning})` : ''}`).join('；') || '无'}`,
    packet.ownershipSummary?.affectedRegions.length
      ? `ownership 区域：${packet.ownershipSummary.affectedRegions.map((region) => `${region.region} swing=${region.avgSwing}`).join('；')}`
      : `ownership 区域：${packet.ownershipSummary?.note ?? '无'}`,
    packet.humanPolicySignals ? `humanPolicy：${packet.humanPolicySignals.interpretation}` : 'humanPolicy：未返回人类策略信号。',
    `禁用结论：${packet.teachingGuidance.forbiddenClaims.join('、')}`
  ].join('\n')
}
