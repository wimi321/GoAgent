import type { KataGoMoveAnalysis } from '@main/lib/types'
import { buildTeachingEvidenceBundle, type TeachingEvidenceBundle } from '../teacher/evidenceBundle'

export type TeachingReadinessLevel = 'ready' | 'usable' | 'needs-deeper' | 'insufficient'
export type TeachingReadinessIntent = 'current-move' | 'move-range' | 'full-game' | 'training-plan' | 'freeform'

export interface TeachingReadinessGate {
  level: TeachingReadinessLevel
  canTeachNow: boolean
  canUseInFinalReport: boolean
  shouldDeepen: boolean
  blockingIssues: string[]
  warnings: string[]
  safeWording: string
  promptNote: string
}

function gateLevelRank(level: TeachingReadinessLevel): number {
  return { insufficient: 0, 'needs-deeper': 1, usable: 2, ready: 3 }[level]
}

function minLevel(left: TeachingReadinessLevel, right: TeachingReadinessLevel): TeachingReadinessLevel {
  return gateLevelRank(left) <= gateLevelRank(right) ? left : right
}

export function evaluateTeachingReadiness(input: {
  analysis: KataGoMoveAnalysis
  bundle?: TeachingEvidenceBundle
  intent?: TeachingReadinessIntent
}): TeachingReadinessGate {
  const bundle = input.bundle ?? buildTeachingEvidenceBundle({ analysis: input.analysis })
  let level: TeachingReadinessLevel = 'ready'
  const blockingIssues: string[] = []
  const warnings: string[] = []

  if (!input.analysis.currentMove || !input.analysis.playedMove) {
    level = 'insufficient'
    blockingIssues.push('missing-current-or-played-move')
  }
  if (!bundle.engineSummary.bestMove) {
    level = minLevel(level, 'insufficient')
    blockingIssues.push('missing-best-move')
  }
  if (bundle.classification.confidence === 'low') {
    level = minLevel(level, bundle.classification.severity === 'good' ? 'usable' : 'needs-deeper')
    warnings.push('classification-low-confidence')
  }
  if (bundle.classification.shouldDeepen) {
    level = minLevel(level, 'needs-deeper')
    warnings.push('classification-recommends-deeper-search')
  }
  if (bundle.pvConfidence.overall === 'weak') {
    level = minLevel(level, 'usable')
    warnings.push('pv-confidence-weak')
  }
  if (bundle.pvConfidence.overall === 'unstable') {
    level = minLevel(level, 'needs-deeper')
    warnings.push('pv-confidence-unstable')
  }
  if (input.analysis.analysisQuality?.deepenRecommended) {
    level = minLevel(level, 'needs-deeper')
    warnings.push('analysis-quality-deepen-recommended')
  }

  const shouldDeepen = level === 'needs-deeper' || level === 'insufficient' || bundle.classification.shouldDeepen || bundle.pvConfidence.shouldDeepen
  const canTeachNow = level !== 'insufficient'
  const canUseInFinalReport = level === 'ready' || (level === 'usable' && input.intent !== 'full-game')
  const safeWording = level === 'ready'
    ? '证据足够，可以按主讲结论表达，但仍需引用 KataGo 与 PV。'
    : level === 'usable'
      ? '证据可用于教学，但要使用“AI 倾向”“参考变化”等保守措辞。'
      : level === 'needs-deeper'
        ? '可以先讲有限判断，但应提示需要加深分析后再做最终结论。'
        : '证据不足，不应输出正式棋理结论。'

  return {
    level,
    canTeachNow,
    canUseInFinalReport,
    shouldDeepen,
    blockingIssues,
    warnings,
    safeWording,
    promptNote: [
      `Teaching readiness=${level}.`,
      `canTeachNow=${canTeachNow}.`,
      `canUseInFinalReport=${canUseInFinalReport}.`,
      safeWording,
      blockingIssues.length ? `blocking=${blockingIssues.join(',')}.` : '',
      warnings.length ? `warnings=${warnings.join(',')}.` : ''
    ].filter(Boolean).join(' ')
  }
}

export function formatTeachingReadinessGateForPrompt(gate: TeachingReadinessGate): string {
  return [
    '【Teaching Readiness Gate】',
    `级别：${gate.level}`,
    `可以立即讲解：${gate.canTeachNow ? 'yes' : 'no'}`,
    `可进入最终报告：${gate.canUseInFinalReport ? 'yes' : 'no'}`,
    `是否建议加深：${gate.shouldDeepen ? 'yes' : 'no'}`,
    `安全措辞：${gate.safeWording}`,
    `阻断项：${gate.blockingIssues.join('；') || '无'}`,
    `提醒：${gate.warnings.join('；') || '无'}`
  ].join('\n')
}
