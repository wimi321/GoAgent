import type { KataGoMoveAnalysis, KnowledgeMatch, MoveClassification, PvConfidenceReport, TacticalSignal } from '@main/lib/types'
import { classifyMoveAnalysis } from '../analysis/classifier'
import { buildPvConfidenceReport } from '../analysis/pvConfidence'
import { scoreSummaryFromBlackLead } from './scorePerspective'

export interface TeachingEvidenceBundle {
  version: 1
  position: {
    gameId: string
    moveNumber: number
    boardSize: number
    playedMove?: string
    color?: 'B' | 'W'
  }
  classification: MoveClassification
  pvConfidence: PvConfidenceReport
  engineSummary: {
    bestMove?: string
    actualMove?: string
    winrateBefore: number
    winrateAfter: number
    winrateLoss: number
    scoreLoss: number
    scoreBeforeText: string
    scoreAfterText: string
    bestVisits: number
    actualVisits: number
  }
  knowledgeMatches: KnowledgeMatch[]
  tacticalSignals: TacticalSignal[]
  forbiddenClaims: string[]
  recommendedWording: string[]
}

function round(value: number | undefined, digits = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function forbiddenClaims(analysis: KataGoMoveAnalysis, classification: MoveClassification, pvConfidence: PvConfidenceReport): string[] {
  const forbidden = [
    '不要编造未出现在 KataGo 候选点、实战手、PV 或知识匹配中的坐标。',
    '不要把 scoreLead 的正负号自行解释成胜负；必须使用 scoreSummary 或黑棋为正的口径。'
  ]
  if (classification.confidence !== 'high') {
    forbidden.push('当前分析置信度不足，不要使用“必然”“唯一”“必败”“必杀”等绝对措辞。')
  }
  if (pvConfidence.overall === 'weak' || pvConfidence.overall === 'unstable') {
    forbidden.push('PV 支撑较弱，只能说参考变化，不能说成强制变化。')
  }
  if (analysis.analysisQuality?.deepenRecommended) {
    forbidden.push('analysisQuality 建议加深分析时，不要把低 visits 结论说成最终结论。')
  }
  return forbidden
}

function recommendedWording(classification: MoveClassification, pvConfidence: PvConfidenceReport): string[] {
  const wording: string[] = []
  if (classification.severity === 'good') wording.push('这手棋整体可以接受，重点讲为什么可行，以及是否有更积极选择。')
  if (classification.severity === 'inaccuracy') wording.push('这手棋有小亏，适合讲判断方法，不要夸大成败着。')
  if (classification.severity === 'mistake') wording.push('这手棋是本局值得复盘的问题手，要讲清实战思路和 AI 首选差异。')
  if (classification.severity === 'blunder') wording.push('这手棋损失较大，要优先讲局部急所、后续变化和如何避免同类错误。')
  if (classification.severity === 'unclear') wording.push('证据不足，先说明需要加深分析，再给有限判断。')
  wording.push(pvConfidence.recommendedWording)
  if (classification.shouldDeepen || pvConfidence.shouldDeepen) wording.push('建议加深分析后再把结论用于正式复盘报告。')
  return wording
}

export function buildTeachingEvidenceBundle(input: {
  analysis: KataGoMoveAnalysis
  knowledgeMatches?: KnowledgeMatch[]
  tacticalSignals?: TacticalSignal[]
}): TeachingEvidenceBundle {
  const analysis = input.analysis
  const classification = analysis.moveClassification ?? classifyMoveAnalysis(analysis)
  const pvConfidence = analysis.pvConfidence ?? buildPvConfidenceReport(analysis)
  const best = analysis.before.topMoves[0]
  const scoreBefore = scoreSummaryFromBlackLead(analysis.before.scoreLead, analysis.currentMove?.color)
  const scoreAfter = scoreSummaryFromBlackLead(analysis.after.scoreLead, analysis.currentMove?.color)

  return {
    version: 1,
    position: {
      gameId: analysis.gameId,
      moveNumber: analysis.moveNumber,
      boardSize: analysis.boardSize,
      playedMove: analysis.playedMove?.move ?? analysis.currentMove?.gtp,
      color: analysis.currentMove?.color
    },
    classification,
    pvConfidence,
    engineSummary: {
      bestMove: best?.move,
      actualMove: analysis.playedMove?.move ?? analysis.currentMove?.gtp,
      winrateBefore: round(analysis.before.winrate, 2),
      winrateAfter: round(analysis.after.winrate, 2),
      winrateLoss: round(analysis.playedMove?.winrateLoss, 2),
      scoreLoss: round(analysis.playedMove?.scoreLoss, 2),
      scoreBeforeText: scoreBefore.text,
      scoreAfterText: scoreAfter.text,
      bestVisits: Math.max(0, Number(best?.visits ?? analysis.analysisQuality?.bestVisits ?? 0) || 0),
      actualVisits: Math.max(0, Number(analysis.playedMove?.visits ?? analysis.analysisQuality?.actualVisits ?? 0) || 0)
    },
    knowledgeMatches: input.knowledgeMatches ?? [],
    tacticalSignals: input.tacticalSignals ?? analysis.tacticalSignals ?? [],
    forbiddenClaims: forbiddenClaims(analysis, classification, pvConfidence),
    recommendedWording: recommendedWording(classification, pvConfidence)
  }
}

export function formatTeachingEvidenceBundleForPrompt(bundle: TeachingEvidenceBundle): string {
  return [
    '【Teaching Evidence Bundle v1】',
    `局面：第 ${bundle.position.moveNumber} 手，实战 ${bundle.engineSummary.actualMove ?? '未知'}，AI 首选 ${bundle.engineSummary.bestMove ?? '未知'}。`,
    `分类：${bundle.classification.severity}，置信度 ${bundle.classification.confidence}，${bundle.classification.reason}`,
    `损失：胜率 ${bundle.engineSummary.winrateLoss}% ，目差 ${bundle.engineSummary.scoreLoss}。`,
    `目差口径：before=${bundle.engineSummary.scoreBeforeText}；after=${bundle.engineSummary.scoreAfterText}。`,
    `PV 可信度：${bundle.pvConfidence.summary}。${bundle.pvConfidence.recommendedWording}`,
    `知识匹配：${bundle.knowledgeMatches.slice(0, 4).map((match) => `${match.title}/${match.confidence}`).join('；') || '无强匹配'}`,
    `战术信号：${bundle.tacticalSignals.slice(0, 4).map((signal) => `${signal.type}/${signal.confidence}`).join('；') || '无明确战术信号'}`,
    `推荐措辞：${bundle.recommendedWording.join('；')}`,
    `禁止表达：${bundle.forbiddenClaims.join('；')}`
  ].join('\n')
}
