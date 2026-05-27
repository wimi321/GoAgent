import type { AppSettings, KataGoAnalysisGroup, KataGoAnalysisSpeedMode } from '@main/lib/types'
import type { AnalysisCacheTier } from './cache'

export type AdaptiveAnalysisIntent = 'live' | 'teacher-current' | 'quick-sweep' | 'range-refine' | 'batch-profile' | 'oracle'

export interface AdaptiveAnalysisProfileInput {
  settings: Pick<AppSettings, 'katagoAnalysisSpeedMode' | 'katagoBenchmarkVisitsPerSecond'>
  intent: AdaptiveAnalysisIntent
  requestedMaxVisits?: number
  moveNumber?: number
  totalMoves?: number
}

export interface AdaptiveAnalysisProfile {
  intent: AdaptiveAnalysisIntent
  speedMode: KataGoAnalysisSpeedMode
  maxVisits: number
  sweepVisits: number
  refineVisits: number
  refineTopN: number
  includeOwnership: boolean
  includePolicy: boolean
  reportDuringSearchEvery: number
  cacheTier: AnalysisCacheTier
  reason: string[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function hardwareTier(visitsPerSecond: number): 'weak' | 'normal' | 'strong' {
  if (!Number.isFinite(visitsPerSecond) || visitsPerSecond <= 0) return 'normal'
  if (visitsPerSecond < 180) return 'weak'
  if (visitsPerSecond >= 650) return 'strong'
  return 'normal'
}

export function inferAdaptiveIntent(group?: KataGoAnalysisGroup, hasTeacherRunId = false): AdaptiveAnalysisIntent {
  if (hasTeacherRunId || group === 'teacher') return 'teacher-current'
  if (group === 'quick') return 'quick-sweep'
  if (group === 'batch') return 'batch-profile'
  if (group === 'live' || group === 'single') return 'live'
  return 'live'
}

function baseVisits(intent: AdaptiveAnalysisIntent, tier: 'weak' | 'normal' | 'strong'): number {
  const table: Record<AdaptiveAnalysisIntent, Record<'weak' | 'normal' | 'strong', number>> = {
    live: { weak: 160, normal: 320, strong: 520 },
    'teacher-current': { weak: 420, normal: 900, strong: 1600 },
    'quick-sweep': { weak: 8, normal: 12, strong: 24 },
    'range-refine': { weak: 80, normal: 180, strong: 360 },
    'batch-profile': { weak: 48, normal: 96, strong: 180 },
    oracle: { weak: 1200, normal: 2400, strong: 5000 }
  }
  return table[intent][tier]
}

function modeMultiplier(mode: KataGoAnalysisSpeedMode): number {
  if (mode === 'fast') return 0.55
  if (mode === 'deep') return 1.75
  return 1
}

function cacheTierForIntent(intent: AdaptiveAnalysisIntent): AnalysisCacheTier {
  if (intent === 'quick-sweep') return 'sweep'
  if (intent === 'range-refine' || intent === 'batch-profile') return 'refine'
  if (intent === 'oracle') return 'oracle'
  return 'teaching'
}

export function buildAdaptiveAnalysisProfile(input: AdaptiveAnalysisProfileInput): AdaptiveAnalysisProfile {
  const speedMode = input.settings.katagoAnalysisSpeedMode ?? 'auto'
  const tier = hardwareTier(input.settings.katagoBenchmarkVisitsPerSecond ?? 0)
  const effectiveMode: KataGoAnalysisSpeedMode = speedMode === 'auto' ? 'balanced' : speedMode
  const requested = input.requestedMaxVisits && input.requestedMaxVisits > 0 ? input.requestedMaxVisits : undefined
  const base = requested ?? baseVisits(input.intent, tier)
  const maxVisits = clamp(base * modeMultiplier(effectiveMode), 4, input.intent === 'oracle' ? 10000 : 4000)
  const reason = [
    `intent=${input.intent}`,
    `hardware=${tier}`,
    `speedMode=${speedMode}`,
    requested ? `requested=${requested}` : 'requested=auto'
  ]
  if (input.totalMoves && input.moveNumber) {
    const phaseRatio = input.moveNumber / input.totalMoves
    if (phaseRatio > 0.72 && input.intent === 'teacher-current') reason.push('endgame-teaching-profile')
  }
  return {
    intent: input.intent,
    speedMode,
    maxVisits,
    sweepVisits: clamp(maxVisits * 0.04, 4, 48),
    refineVisits: clamp(maxVisits * 0.35, 48, Math.max(80, maxVisits)),
    refineTopN: input.intent === 'quick-sweep' ? 8 : input.intent === 'range-refine' ? 5 : 3,
    includeOwnership: input.intent === 'teacher-current' || input.intent === 'oracle',
    includePolicy: input.intent !== 'quick-sweep',
    reportDuringSearchEvery: input.intent === 'live' ? 0.2 : 0,
    cacheTier: cacheTierForIntent(input.intent),
    reason
  }
}

export function describeAdaptiveAnalysisProfile(profile: AdaptiveAnalysisProfile): string {
  return [
    `analysis profile: ${profile.intent}`,
    `mode=${profile.speedMode}`,
    `maxVisits=${profile.maxVisits}`,
    `sweep=${profile.sweepVisits}`,
    `refine=${profile.refineVisits}`,
    `cacheTier=${profile.cacheTier}`,
    profile.includeOwnership ? 'ownership=on' : 'ownership=off',
    profile.reason.join('; ')
  ].join(' | ')
}
