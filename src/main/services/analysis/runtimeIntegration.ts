import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { findGame, getSettings } from '@main/lib/store'
import type {
  AnalysisRuntimeEvidence,
  AnalyzeGameQuickProgress,
  KataGoAnalysisGroup,
  KataGoMoveAnalysis
} from '@main/lib/types'
import { analyzeGameQuick, analyzePosition, analyzePositionWithProgress } from '../katago'
import {
  buildAdaptiveAnalysisProfile,
  describeAdaptiveAnalysisProfile,
  inferAdaptiveIntent,
  type AdaptiveAnalysisIntent,
  type AdaptiveAnalysisProfile
} from './adaptiveProfile'
import {
  analysisCacheKey,
  qualityFromAnalysis,
  readAnalysisCache,
  writeAnalysisCache,
  type AnalysisCacheKeyInput,
  type AnalysisCacheLookupResult,
  type AnalysisCacheRequirement,
  type AnalysisCacheTier
} from './cache'
import { evaluateTeachingReadiness, type TeachingReadinessIntent } from './readinessGate'
import { buildTeachingEvidenceBundle } from '../teacher/evidenceBundle'

export interface RuntimeAnalyzePositionRequest {
  gameId: string
  moveNumber: number
  maxVisits?: number
  runId?: string
  group?: KataGoAnalysisGroup
}

export interface RuntimeAnalyzePositionStreamRequest extends RuntimeAnalyzePositionRequest {
  reportDuringSearchEvery?: number
  onProgress?: (analysis: KataGoMoveAnalysis, isFinal: boolean) => void
  onSearchProgress?: (progress: {
    id?: string
    visits: number
    visitsPerSecond: number
    isDuringSearch: boolean
  }) => void
}

export interface RuntimeAnalyzeGameQuickRequest {
  gameId: string
  maxVisits?: number
  refineVisits?: number
  refineTopN?: number
  runId?: string
  onProgress?: (progress: AnalyzeGameQuickProgress) => void
}

export interface RuntimeAnalysisEnvelope {
  analysis: KataGoMoveAnalysis
  cache: AnalysisCacheLookupResult
  profile: AdaptiveAnalysisProfile
  evidence: NonNullable<KataGoMoveAnalysis['runtimeEvidence']>
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function fileFingerprint(filePath: string, options: { readSmallFiles?: boolean } = {}): string {
  if (!filePath || !existsSync(filePath)) {
    return filePath || 'missing'
  }
  try {
    const stat = statSync(filePath)
    const identity = `${filePath}:${stat.size}:${stat.mtimeMs}`
    if (options.readSmallFiles && stat.size <= 5_000_000) {
      return sha256(`${identity}:${readFileSync(filePath).toString('base64')}`)
    }
    return sha256(identity)
  } catch {
    return sha256(filePath)
  }
}

function gameFingerprint(gameId: string): string {
  const game = findGame(gameId)
  if (!game) {
    return sha256(`game:${gameId}:missing-index`)
  }
  return sha256([
    game.id,
    game.title,
    game.black,
    game.white,
    game.result,
    game.date,
    game.moveCount ?? '',
    fileFingerprint(game.filePath, { readSmallFiles: true })
  ].join('\n'))
}

function runtimeFingerprints(): { modelFingerprint: string; configFingerprint: string } {
  const settings = getSettings()
  return {
    modelFingerprint: sha256([
      settings.katagoEngineMode,
      settings.katagoModelPreset,
      basename(settings.katagoModel || 'no-model'),
      fileFingerprint(settings.katagoModel),
      settings.ikatagoClientBin,
      settings.ikatagoPlatform,
      settings.ikatagoUsername,
      settings.ikatagoExtraArgs,
      settings.zhiziClientBin,
      settings.zhiziGpuType,
      settings.zhiziExtraArgs,
      settings.zhiziToken ? 'zhizi-token-configured' : 'zhizi-token-empty'
    ].join('\n')),
    configFingerprint: sha256([
      settings.katagoAnalysisThreads,
      settings.katagoSearchThreadsPerAnalysisThread,
      settings.katagoMaxBatchSize,
      settings.katagoCacheSizePowerOfTwo,
      settings.ikatagoUseWhenLocalSlow,
      settings.ikatagoSlowThresholdVisitsPerSecond,
      settings.zhiziUseWhenLocalSlow,
      fileFingerprint(settings.katagoConfig, { readSmallFiles: true })
    ].join('\n'))
  }
}

function teachingIntentForProfile(intent: AdaptiveAnalysisIntent): TeachingReadinessIntent {
  if (intent === 'teacher-current' || intent === 'live') return 'current-move'
  if (intent === 'range-refine' || intent === 'quick-sweep') return 'move-range'
  if (intent === 'batch-profile') return 'training-plan'
  return 'freeform'
}

function profileSummary(profile: AdaptiveAnalysisProfile): AnalysisRuntimeEvidence['adaptiveProfile'] {
  return {
    intent: profile.intent,
    speedMode: profile.speedMode,
    maxVisits: profile.maxVisits,
    sweepVisits: profile.sweepVisits,
    refineVisits: profile.refineVisits,
    refineTopN: profile.refineTopN,
    cacheTier: profile.cacheTier,
    includeOwnership: profile.includeOwnership,
    includePolicy: profile.includePolicy,
    reason: profile.reason
  }
}

function cacheRequirementForProfile(profile: AdaptiveAnalysisProfile): AnalysisCacheRequirement {
  const teaching = profile.intent === 'teacher-current' || profile.intent === 'oracle'
  const minBestVisits = profile.cacheTier === 'sweep'
    ? Math.max(4, Math.min(24, profile.maxVisits))
    : Math.max(32, Math.min(profile.maxVisits, Math.round(profile.maxVisits * 0.3)))
  return {
    minTier: profile.cacheTier,
    minBestVisits,
    minActualVisits: teaching ? Math.max(60, Math.min(profile.maxVisits, Math.round(profile.maxVisits * 0.12))) : undefined,
    requireOwnership: profile.includeOwnership,
    requireStablePv: teaching,
    requireMediumConfidence: teaching,
    allowStaleMs: profile.cacheTier === 'oracle' ? -1 : 1000 * 60 * 60 * 24 * 30
  }
}

function runtimeCacheKey(input: {
  gameId: string
  moveNumber: number
  maxVisits: number
  tier: AnalysisCacheTier
}): AnalysisCacheKeyInput {
  const fingerprints = runtimeFingerprints()
  return {
    gameId: input.gameId,
    gameFingerprint: gameFingerprint(input.gameId),
    moveNumber: input.moveNumber,
    modelFingerprint: fingerprints.modelFingerprint,
    configFingerprint: fingerprints.configFingerprint,
    maxVisits: input.maxVisits,
    tier: input.tier
  }
}

function buildProfile(input: {
  gameId: string
  moveNumber?: number
  requestedMaxVisits?: number
  group?: KataGoAnalysisGroup
  runId?: string
  intent?: AdaptiveAnalysisIntent
}): AdaptiveAnalysisProfile {
  const intent = input.intent ?? inferAdaptiveIntent(input.group, Boolean(input.runId))
  return buildAdaptiveAnalysisProfile({
    settings: getSettings(),
    intent,
    requestedMaxVisits: input.requestedMaxVisits,
    moveNumber: input.moveNumber
  })
}

export function attachRuntimeAnalysisEvidence(input: {
  analysis: KataGoMoveAnalysis
  profile: AdaptiveAnalysisProfile
  cache: AnalysisCacheLookupResult
  cacheKey?: string
}): KataGoMoveAnalysis {
  const bundle = buildTeachingEvidenceBundle({ analysis: input.analysis })
  const readiness = evaluateTeachingReadiness({
    analysis: input.analysis,
    bundle,
    intent: teachingIntentForProfile(input.profile.intent)
  })
  input.analysis.runtimeEvidence = {
    cacheStatus: input.cache.status,
    cacheTier: input.profile.cacheTier,
    cacheKey: input.cacheKey,
    cacheReason: [input.cache.reason, describeAdaptiveAnalysisProfile(input.profile)].filter(Boolean).join(' | '),
    adaptiveProfile: profileSummary(input.profile),
    teachingReadiness: {
      level: readiness.level,
      canTeachNow: readiness.canTeachNow,
      canUseInFinalReport: readiness.canUseInFinalReport,
      shouldDeepen: readiness.shouldDeepen,
      safeWording: readiness.safeWording,
      warnings: readiness.warnings,
      blockingIssues: readiness.blockingIssues
    },
    evidenceBundleVersion: bundle.version,
    generatedAt: new Date().toISOString()
  }
  return input.analysis
}

export async function analyzePositionRuntimeEnvelope(input: RuntimeAnalyzePositionRequest): Promise<RuntimeAnalysisEnvelope> {
  const profile = buildProfile({
    gameId: input.gameId,
    moveNumber: input.moveNumber,
    requestedMaxVisits: input.maxVisits,
    group: input.group,
    runId: input.runId
  })
  const keyInput = runtimeCacheKey({
    gameId: input.gameId,
    moveNumber: input.moveNumber,
    maxVisits: profile.maxVisits,
    tier: profile.cacheTier
  })
  const cacheKey = analysisCacheKey(keyInput)
  const lookup = readAnalysisCache(keyInput, cacheRequirementForProfile(profile))
  if (lookup.status === 'hit' && lookup.entry?.analysis) {
    const analysis = attachRuntimeAnalysisEvidence({ analysis: lookup.entry.analysis, profile, cache: lookup, cacheKey })
    return { analysis, cache: lookup, profile, evidence: analysis.runtimeEvidence! }
  }

  const analysis = await analyzePosition(input.gameId, input.moveNumber, profile.maxVisits, {
    runId: input.runId,
    group: input.group
  })
  const enriched = attachRuntimeAnalysisEvidence({ analysis, profile, cache: lookup, cacheKey })
  const written = writeAnalysisCache(keyInput, enriched, lookup.entry)
  enriched.runtimeEvidence = {
    ...enriched.runtimeEvidence!,
    cacheStatus: 'written',
    cacheKey: written.key,
    cacheReason: `${lookup.status}: ${lookup.reason}; wrote ${qualityFromAnalysis(enriched).bestVisits} best visits to ${profile.cacheTier} cache.`
  }
  return { analysis: enriched, cache: lookup, profile, evidence: enriched.runtimeEvidence }
}

export async function analyzePositionRuntime(input: RuntimeAnalyzePositionRequest): Promise<KataGoMoveAnalysis> {
  return (await analyzePositionRuntimeEnvelope(input)).analysis
}

export async function analyzePositionWithProgressRuntime(input: RuntimeAnalyzePositionStreamRequest): Promise<KataGoMoveAnalysis> {
  const profile = buildProfile({
    gameId: input.gameId,
    moveNumber: input.moveNumber,
    requestedMaxVisits: input.maxVisits,
    group: input.group,
    runId: input.runId
  })
  const keyInput = runtimeCacheKey({ gameId: input.gameId, moveNumber: input.moveNumber, maxVisits: profile.maxVisits, tier: profile.cacheTier })
  const cacheKey = analysisCacheKey(keyInput)
  const lookup = readAnalysisCache(keyInput, cacheRequirementForProfile(profile))
  if (lookup.status === 'hit' && lookup.entry?.analysis) {
    const cached = attachRuntimeAnalysisEvidence({ analysis: lookup.entry.analysis, profile, cache: lookup, cacheKey })
    input.onProgress?.(cached, true)
    return cached
  }

  const final = await analyzePositionWithProgress(
    input.gameId,
    input.moveNumber,
    profile.maxVisits,
    (analysis, isFinal) => {
      const progressCache: AnalysisCacheLookupResult = { status: 'miss', reason: isFinal ? lookup.reason : 'streaming-progress' }
      input.onProgress?.(attachRuntimeAnalysisEvidence({ analysis, profile, cache: progressCache, cacheKey }), isFinal)
    },
    input.reportDuringSearchEvery ?? profile.reportDuringSearchEvery,
    input.onSearchProgress
  )
  const enriched = attachRuntimeAnalysisEvidence({ analysis: final, profile, cache: lookup, cacheKey })
  const written = writeAnalysisCache(keyInput, enriched, lookup.entry)
  enriched.runtimeEvidence = { ...enriched.runtimeEvidence!, cacheStatus: 'written', cacheKey: written.key }
  return enriched
}

export async function analyzeGameQuickRuntime(input: RuntimeAnalyzeGameQuickRequest): Promise<KataGoMoveAnalysis[]> {
  const profile = buildProfile({ gameId: input.gameId, requestedMaxVisits: input.maxVisits, group: 'quick', intent: 'quick-sweep' })
  const analyses = await analyzeGameQuick(
    input.gameId,
    profile.maxVisits,
    input.onProgress
      ? (progress) => input.onProgress?.({ ...progress, gameId: input.gameId })
      : undefined,
    {
      refineVisits: input.refineVisits ?? profile.refineVisits,
      refineTopN: input.refineTopN ?? profile.refineTopN,
      runId: input.runId
    }
  )
  return analyses.map((analysis) => {
    const keyInput = runtimeCacheKey({ gameId: input.gameId, moveNumber: analysis.moveNumber, maxVisits: profile.maxVisits, tier: profile.cacheTier })
    const cacheKey = analysisCacheKey(keyInput)
    const cache: AnalysisCacheLookupResult = { status: 'miss', reason: 'quick sweep result was produced by runtime analysis.' }
    const enriched = attachRuntimeAnalysisEvidence({ analysis, profile, cache, cacheKey })
    writeAnalysisCache(keyInput, enriched)
    return enriched
  })
}
