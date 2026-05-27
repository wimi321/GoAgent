import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { cacheDir } from '@main/lib/store'
import type { AnalysisConfidence, KataGoMoveAnalysis, MoveClassificationSeverity, PvConfidenceLevel } from '@main/lib/types'

export type AnalysisCacheTier = 'sweep' | 'refine' | 'teaching' | 'oracle'
export type AnalysisCacheStatus = 'hit' | 'miss' | 'stale' | 'lower-quality' | 'schema-mismatch' | 'corrupt'

export interface AnalysisCacheKeyInput {
  gameId: string
  gameFingerprint?: string
  moveNumber: number
  boardSize?: number
  modelFingerprint?: string
  configFingerprint?: string
  maxVisits: number
  tier: AnalysisCacheTier
  schemaVersion?: string
}

export interface AnalysisCacheQuality {
  bestVisits: number
  actualVisits: number
  totalVisits: number
  confidence?: AnalysisConfidence
  severity?: MoveClassificationSeverity
  pvConfidence?: PvConfidenceLevel
  shouldDeepen: boolean
}

export interface AnalysisCacheEntry {
  schemaVersion: string
  key: string
  createdAt: string
  updatedAt: string
  tier: AnalysisCacheTier
  maxVisits: number
  moveNumber: number
  gameId: string
  gameFingerprint: string
  modelFingerprint: string
  configFingerprint: string
  analysis: KataGoMoveAnalysis
  quality: AnalysisCacheQuality
}

export interface AnalysisCacheRequirement {
  minBestVisits?: number
  minActualVisits?: number
  minTier?: AnalysisCacheTier
  requireStablePv?: boolean
  requireMediumConfidence?: boolean
  allowStaleMs?: number
  schemaVersion?: string
}

export interface AnalysisCacheLookupResult {
  status: AnalysisCacheStatus
  entry?: AnalysisCacheEntry
  path?: string
  reason: string
}

export interface AnalysisCacheSummary {
  root: string
  entries: number
  bytes: number
  byTier: Record<AnalysisCacheTier, number>
  newestUpdatedAt?: string
  oldestUpdatedAt?: string
}

const DEFAULT_SCHEMA_VERSION = 'analysis-cache-v1'
const tierRank: Record<AnalysisCacheTier, number> = { sweep: 1, refine: 2, teaching: 3, oracle: 4 }
const pvRank: Record<PvConfidenceLevel, number> = { unstable: 0, weak: 1, medium: 2, strong: 3 }
const confidenceRank: Record<AnalysisConfidence, number> = { low: 1, medium: 2, high: 3 }

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizedKeyInput(input: AnalysisCacheKeyInput): Required<AnalysisCacheKeyInput> {
  return {
    gameId: input.gameId,
    gameFingerprint: input.gameFingerprint || input.gameId,
    moveNumber: Math.max(0, Math.round(input.moveNumber)),
    boardSize: input.boardSize || 19,
    modelFingerprint: input.modelFingerprint || 'unknown-model',
    configFingerprint: input.configFingerprint || 'unknown-config',
    maxVisits: Math.max(0, Math.round(input.maxVisits)),
    tier: input.tier,
    schemaVersion: input.schemaVersion || DEFAULT_SCHEMA_VERSION
  }
}

export function analysisCacheRoot(root = cacheDir): string {
  return join(root, 'analysis-v2')
}

export function analysisCacheKey(input: AnalysisCacheKeyInput): string {
  return sha256(stableJson(normalizedKeyInput(input))).slice(0, 32)
}

export function analysisCachePath(input: AnalysisCacheKeyInput, root = analysisCacheRoot()): string {
  const normalized = normalizedKeyInput(input)
  const gameKey = sha256(normalized.gameFingerprint).slice(0, 12)
  const modelKey = sha256(`${normalized.modelFingerprint}:${normalized.configFingerprint}`).slice(0, 12)
  return join(root, normalized.tier, gameKey, modelKey, `${normalized.moveNumber}-${analysisCacheKey(normalized)}.json`)
}

export function qualityFromAnalysis(analysis: KataGoMoveAnalysis): AnalysisCacheQuality {
  const bestVisits = Math.max(0, Number(analysis.before.topMoves[0]?.visits ?? analysis.analysisQuality?.bestVisits ?? 0) || 0)
  const actualVisits = Math.max(0, Number(analysis.playedMove?.visits ?? analysis.analysisQuality?.actualVisits ?? 0) || 0)
  const totalVisits = Math.max(0, Number(analysis.analysisQuality?.totalVisits ?? 0) || 0, analysis.before.topMoves.reduce((sum, move) => sum + Math.max(0, Number(move.visits ?? 0) || 0), 0))
  return {
    bestVisits,
    actualVisits,
    totalVisits,
    confidence: analysis.moveClassification?.confidence ?? analysis.analysisQuality?.confidence,
    severity: analysis.moveClassification?.severity,
    pvConfidence: analysis.pvConfidence?.overall,
    shouldDeepen: Boolean(analysis.moveClassification?.shouldDeepen || analysis.pvConfidence?.shouldDeepen || analysis.analysisQuality?.deepenRecommended)
  }
}

function cacheEntryMeetsRequirement(entry: AnalysisCacheEntry, requirement: AnalysisCacheRequirement = {}): AnalysisCacheLookupResult | null {
  if (requirement.schemaVersion && entry.schemaVersion !== requirement.schemaVersion) {
    return { status: 'schema-mismatch', entry, reason: `schema ${entry.schemaVersion} does not match required ${requirement.schemaVersion}` }
  }
  if (typeof requirement.allowStaleMs === 'number' && requirement.allowStaleMs >= 0) {
    const age = Date.now() - Date.parse(entry.updatedAt)
    if (Number.isFinite(age) && age > requirement.allowStaleMs) return { status: 'stale', entry, reason: `cache age ${age}ms exceeds ${requirement.allowStaleMs}ms` }
  }
  if (requirement.minTier && tierRank[entry.tier] < tierRank[requirement.minTier]) {
    return { status: 'lower-quality', entry, reason: `tier ${entry.tier} is below required ${requirement.minTier}` }
  }
  if (requirement.minBestVisits && entry.quality.bestVisits < requirement.minBestVisits) {
    return { status: 'lower-quality', entry, reason: `bestVisits ${entry.quality.bestVisits} is below ${requirement.minBestVisits}` }
  }
  if (requirement.minActualVisits && entry.quality.actualVisits < requirement.minActualVisits) {
    return { status: 'lower-quality', entry, reason: `actualVisits ${entry.quality.actualVisits} is below ${requirement.minActualVisits}` }
  }
  if (requirement.requireStablePv && pvRank[entry.quality.pvConfidence ?? 'unstable'] < pvRank.medium) {
    return { status: 'lower-quality', entry, reason: `PV confidence ${entry.quality.pvConfidence ?? 'unknown'} is not stable enough` }
  }
  if (requirement.requireMediumConfidence && confidenceRank[entry.quality.confidence ?? 'low'] < confidenceRank.medium) {
    return { status: 'lower-quality', entry, reason: `analysis confidence ${entry.quality.confidence ?? 'unknown'} is not high enough` }
  }
  return null
}

export function readAnalysisCache(input: AnalysisCacheKeyInput, requirement: AnalysisCacheRequirement = {}): AnalysisCacheLookupResult {
  const path = analysisCachePath(input)
  if (!existsSync(path)) return { status: 'miss', path, reason: 'cache file does not exist' }
  try {
    const entry = JSON.parse(readFileSync(path, 'utf8')) as AnalysisCacheEntry
    const rejected = cacheEntryMeetsRequirement(entry, requirement)
    if (rejected) return { ...rejected, path }
    return { status: 'hit', entry, path, reason: 'cache hit' }
  } catch (error) {
    return { status: 'corrupt', path, reason: String(error).slice(0, 300) }
  }
}

export function writeAnalysisCache(input: AnalysisCacheKeyInput, analysis: KataGoMoveAnalysis, previous?: AnalysisCacheEntry): AnalysisCacheEntry {
  const normalized = normalizedKeyInput(input)
  const path = analysisCachePath(normalized)
  const timestamp = new Date().toISOString()
  const entry: AnalysisCacheEntry = {
    schemaVersion: normalized.schemaVersion,
    key: analysisCacheKey(normalized),
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp,
    tier: normalized.tier,
    maxVisits: normalized.maxVisits,
    moveNumber: normalized.moveNumber,
    gameId: normalized.gameId,
    gameFingerprint: normalized.gameFingerprint,
    modelFingerprint: normalized.modelFingerprint,
    configFingerprint: normalized.configFingerprint,
    analysis,
    quality: qualityFromAnalysis(analysis)
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(entry, null, 2), 'utf8')
  return entry
}

export function removeAnalysisCacheEntry(input: AnalysisCacheKeyInput): boolean {
  const path = analysisCachePath(input)
  if (!existsSync(path)) return false
  rmSync(path, { force: true })
  return true
}

function collectJsonFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) collectJsonFiles(path, files)
    else if (name.endsWith('.json')) files.push(path)
  }
  return files
}

export function summarizeAnalysisCache(root = analysisCacheRoot()): AnalysisCacheSummary {
  const summary: AnalysisCacheSummary = { root, entries: 0, bytes: 0, byTier: { sweep: 0, refine: 0, teaching: 0, oracle: 0 } }
  for (const path of collectJsonFiles(root)) {
    try {
      const stat = statSync(path)
      const entry = JSON.parse(readFileSync(path, 'utf8')) as Partial<AnalysisCacheEntry>
      const tier = entry.tier && tierRank[entry.tier] ? entry.tier : 'sweep'
      summary.entries += 1
      summary.bytes += stat.size
      summary.byTier[tier] += 1
      const updatedAt = entry.updatedAt
      if (typeof updatedAt === 'string') {
        if (!summary.newestUpdatedAt || updatedAt > summary.newestUpdatedAt) summary.newestUpdatedAt = updatedAt
        if (!summary.oldestUpdatedAt || updatedAt < summary.oldestUpdatedAt) summary.oldestUpdatedAt = updatedAt
      }
    } catch {
      // Ignore corrupt cache files in summary; readAnalysisCache reports them per-key.
    }
  }
  return summary
}
