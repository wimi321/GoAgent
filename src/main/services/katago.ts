import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { findGame, getSettings } from '@main/lib/store'
import type { AnalysisQuality, GameMove, KataGoAnalysisGroup, KataGoCandidate, KataGoMoveAnalysis } from '@main/lib/types'
import { readGameRecord } from './sgf'
import { resolveKataGoRuntime } from './katagoRuntime'
import { ensureFoxGameDownloaded } from './fox'
import { beginKataGoEngineTask } from './katagoEnginePool'
import {
  cancelPersistentKataGoAnalysis,
  persistentKataGoEngineEnabled,
  persistentKataGoFallbackEnabled,
  queryKataGoPersistentBatch
} from './katagoPersistentEngine'
import {
  cancelIKataGoAnalysis,
  queryIKataGoAnalysisBatch,
  shouldPreferIKataGoEngine
} from './ikatagoClientEngine'
import {
  cancelZhiziGtpAnalysis,
  queryZhiziGtpAnalysisBatch,
  shouldPreferZhiziGtpEngine,
  zhiziGtpConfigured
} from './zhiziGtpEngine'
import { normalizeSgfKomiForAnalysis } from './sgfScoring'
import { buildKataGoTracePacket } from './teacher/katagoTraceTranslator'
import { classifyMoveAnalysis } from './analysis/classifier'
import { buildPvConfidenceReport } from './analysis/pvConfidence'

interface KataGoResponse {
  id?: string
  error?: string
  isDuringSearch?: boolean
  rootInfo?: {
    currentPlayer?: GameMove['color']
    winrate?: number
    scoreLead?: number
    scoreStdev?: number
    utility?: number
    scoreMean?: number
  }
  moveInfos?: Array<{
    move?: string
    winrate?: number
    scoreLead?: number
    scoreMean?: number
    visits?: number
    edgeVisits?: number
    order?: number
    prior?: number
    lcb?: number
    utility?: number
    scoreStdev?: number
    humanPrior?: number
    humanPolicy?: number
    humanScoreMean?: number
    pv?: string[]
    pvVisits?: number[]
    ownership?: number[]
    ownershipStdev?: number[]
  }>
}

interface AnalysisQuery {
  id: string
  moves: Array<[string, string]>
  boardSize: number
  komi: number
  maxVisits: number
  reportDuringSearchEvery?: number
  initialStones?: Array<[GameMove['color'], string]>
  initialPlayer?: GameMove['color']
  overrideSettings?: Record<string, number | boolean | string>
  includeOwnership?: boolean
  includeMovesOwnership?: boolean
  includeOwnershipStdev?: boolean
  includePolicy?: boolean
  includePVVisits?: boolean
  allowMoves?: Array<{
    player: GameMove['color']
    moves: string[]
    untilDepth: number
  }>
}

interface QuickProgress {
  evaluation: KataGoMoveAnalysis
  analyzedPositions: number
  totalPositions: number
}

interface QueryBatchOptions {
  runId?: string
  group?: KataGoAnalysisGroup
  replaceGroup?: boolean
  resolvePartialAfterMs?: number
}

interface ActiveKataGoProcess {
  child: ChildProcessWithoutNullStreams
  group?: KataGoAnalysisGroup
  cancelled: boolean
}

const QUICK_ANALYSIS_FAST_VISITS = 24
const QUICK_ANALYSIS_MAX_SWEEP_VISITS = 80
const QUICK_ANALYSIS_REFINE_VISITS = 120
const QUICK_ANALYSIS_REFINE_TOP_N = 10
const QUICK_ANALYSIS_REFINE_MIN_LOSS = 4
const QUICK_ANALYSIS_WIDE_ROOT_NOISE = 0
const FORCED_ACTUAL_EVIDENCE_MIN_VISITS = 1200
const QUICK_FORCED_ACTUAL_REFINE_MIN_VISITS = 80
const activeKataGoProcesses = new Map<string, ActiveKataGoProcess>()

type AnalysisVisitContext = 'position' | 'quick' | 'refine'

function effectiveVisitsForSpeedMode(maxVisits: number, context: AnalysisVisitContext): number {
  const requested = Math.max(1, Math.round(maxVisits))
  const mode = getSettings().katagoAnalysisSpeedMode ?? 'auto'
  if (mode === 'auto') return requested
  if (context === 'quick') {
    if (mode === 'fast') return Math.min(Math.max(requested, QUICK_ANALYSIS_FAST_VISITS), 48)
    if (mode === 'balanced') return Math.min(Math.max(requested, 60), QUICK_ANALYSIS_REFINE_VISITS)
    return Math.max(requested, 160)
  }
  if (context === 'refine') {
    if (mode === 'fast') return Math.min(Math.max(requested, QUICK_FORCED_ACTUAL_REFINE_MIN_VISITS), 160)
    if (mode === 'balanced') return Math.max(requested, 240)
    return Math.max(requested, 600)
  }
  if (mode === 'fast') return Math.min(Math.max(requested, 80), 240)
  if (mode === 'balanced') return Math.max(requested, 500)
  return Math.max(requested, 1000)
}

function isKataGoTimeoutError(error: unknown): boolean {
  return /KataGo 分析超时|timed out|timeout/i.test(String(error))
}

export function cancelKataGoAnalysis(filter: { runId?: string; group?: KataGoAnalysisGroup }): { cancelled: number } {
  let cancelled = 0
  cancelled += cancelPersistentKataGoAnalysis(filter).cancelled
  cancelled += cancelIKataGoAnalysis(filter).cancelled
  cancelled += cancelZhiziGtpAnalysis(filter).cancelled
  for (const [id, entry] of activeKataGoProcesses.entries()) {
    const matchesRun = filter.runId ? id === filter.runId : true
    const matchesGroup = filter.group ? entry.group === filter.group : true
    if (!matchesRun || !matchesGroup) {
      continue
    }
    entry.cancelled = true
    cancelled += 1
    entry.child.kill()
  }
  return { cancelled }
}

function moveHistory(moves: GameMove[]): Array<[string, string]> {
  return moves.map((move) => [move.color, move.pass ? 'pass' : move.gtp])
}

function initialStonesFromRecord(record: ReturnType<typeof readGameRecord>): Array<[GameMove['color'], string]> {
  return (record.initialStones ?? []).map((stone) => [stone.color, stone.point])
}

function initialPlayerFromRecord(record: ReturnType<typeof readGameRecord>): GameMove['color'] {
  return sideToMoveAt(record.moves, 0)
}

function analysisKomiForRecord(record: ReturnType<typeof readGameRecord>): number {
  return normalizeSgfKomiForAnalysis(record.komi, {
    source: record.game.source,
    rules: record.rules,
    handicap: record.handicap,
    initialStoneCount: record.initialStones?.length ?? 0
  })
}

function inferPhase(moveNumber: number): AnalysisQuality['phase'] {
  if (moveNumber <= 50) return 'opening'
  if (moveNumber <= 160) return 'middle'
  return 'endgame'
}

function buildAnalysisQuality(
  moveNumber: number,
  currentMove: GameMove | undefined,
  topMoves: KataGoCandidate[],
  forcedActual?: KataGoCandidate
): AnalysisQuality {
  const best = topMoves[0]
  const second = topMoves[1]
  const totalVisits = topMoves.reduce((sum, move) => sum + (move.visits ?? 0), 0)
  const candidateSpreadWinrate = best && second ? Math.abs(best.winrate - second.winrate) : 99
  const candidateSpreadScore = best && second ? Math.abs(best.scoreLead - second.scoreLead) : 99
  const actualVisits = forcedActual?.visits ?? topMoves.find((move) => currentMove && moveKey(move.move) === moveKey(currentMove.gtp))?.visits ?? 0
  const phase = inferPhase(moveNumber)
  const pvStable = candidateSpreadWinrate >= 1.2 || candidateSpreadScore >= 0.8
  const deepenRecommended =
    totalVisits < 250 ||
    (phase === 'middle' && totalVisits < 800) ||
    (!pvStable && totalVisits < 1200) ||
    (Boolean(currentMove) && actualVisits < 80)
  const confidence = deepenRecommended ? (totalVisits >= 160 ? 'medium' : 'low') : 'high'
  const reason = deepenRecommended
    ? `visits=${totalVisits}, actualVisits=${actualVisits}, spread=${candidateSpreadWinrate.toFixed(1)}%, phase=${phase}; recommend deeper search before absolute teaching claims.`
    : `visits=${totalVisits}, actualVisits=${actualVisits}, spread=${candidateSpreadWinrate.toFixed(1)}%; evidence is stable enough for teaching.`
  return { phase, totalVisits, bestVisits: best?.visits ?? 0, actualVisits, candidateSpreadWinrate, candidateSpreadScore, pvStable, confidence, reason, deepenRecommended }
}

function oppositeColor(color: GameMove['color']): GameMove['color'] {
  return color === 'B' ? 'W' : 'B'
}

function sideToMoveAt(moves: GameMove[], positionMoveNumber: number): GameMove['color'] {
  const nextMove = moves[positionMoveNumber]
  if (nextMove) {
    return nextMove.color
  }
  const previousMove = moves[positionMoveNumber - 1]
  return previousMove ? oppositeColor(previousMove.color) : 'B'
}

function blackWinrateFromSideToMove(rawWinrate: number, sideToMove: GameMove['color']): number {
  const percent = rawWinrate <= 1.00001 ? rawWinrate * 100 : rawWinrate
  const blackPercent = sideToMove === 'B' ? percent : 100 - percent
  return Math.max(0, Math.min(100, blackPercent))
}

function blackScoreLeadFromSideToMove(rawScoreLead: number, sideToMove: GameMove['color']): number {
  // KataGo reports scoreLead from the side to move under SIDETOMOVE; match LizzieYzy by storing it as black-positive.
  return sideToMove === 'B' ? rawScoreLead : -rawScoreLead
}

function responseSideToMove(response: KataGoResponse, fallback: GameMove['color']): GameMove['color'] {
  return response.rootInfo?.currentPlayer === 'B' || response.rootInfo?.currentPlayer === 'W'
    ? response.rootInfo.currentPlayer
    : fallback
}

function root(response: KataGoResponse, sideToMove: GameMove['color']): { winrate: number; scoreLead: number } {
  if (!response.rootInfo) {
    throw new Error(`KataGo 没有返回 rootInfo${response.error ? `: ${response.error}` : ''}`)
  }
  const actualSideToMove = responseSideToMove(response, sideToMove)
  const rawWinrate = Number(response.rootInfo.winrate ?? 0.5)
  const rawScoreLead = Number(response.rootInfo.scoreLead ?? response.rootInfo.scoreMean ?? 0)
  return {
    winrate: blackWinrateFromSideToMove(rawWinrate, actualSideToMove),
    scoreLead: blackScoreLeadFromSideToMove(rawScoreLead, actualSideToMove)
  }
}

function candidates(response: KataGoResponse, sideToMove: GameMove['color']): KataGoCandidate[] {
  const actualSideToMove = responseSideToMove(response, sideToMove)
  return (response.moveInfos ?? []).map((move, index) => ({
    move: move.move ?? '',
    winrate: blackWinrateFromSideToMove(Number(move.winrate ?? 0.5), actualSideToMove),
    scoreLead: blackScoreLeadFromSideToMove(Number(move.scoreLead ?? move.scoreMean ?? 0), actualSideToMove),
    visits: Number(move.visits ?? 0),
    order: Number(move.order ?? index),
    edgeVisits: typeof move.edgeVisits === 'number' ? move.edgeVisits : undefined,
    prior: Number(move.prior ?? 0) * 100,
    lcb: typeof move.lcb === 'number' ? move.lcb * 100 : undefined,
    utility: typeof move.utility === 'number' ? move.utility : undefined,
    scoreStdev: typeof move.scoreStdev === 'number' ? move.scoreStdev : undefined,
    humanPrior: typeof move.humanPrior === 'number' ? move.humanPrior * 100 : undefined,
    humanPolicy: typeof move.humanPolicy === 'number' ? move.humanPolicy * 100 : undefined,
    humanScoreMean: typeof move.humanScoreMean === 'number' ? move.humanScoreMean : undefined,
    pvVisits: Array.isArray(move.pvVisits) ? move.pvVisits.map(Number).slice(0, 12) : undefined,
    ownership: Array.isArray(move.ownership) ? move.ownership.map(Number) : undefined,
    ownershipStdev: Array.isArray(move.ownershipStdev) ? move.ownershipStdev.map(Number) : undefined,
    pv: (move.pv ?? []).slice(0, 12)
  }))
}

function candidateEvidenceVisits(candidate: KataGoCandidate | undefined): number {
  return Math.max(0, Number(candidate?.visits ?? 0) || 0, Number(candidate?.edgeVisits ?? 0) || 0)
}

function preferStrongerActualCandidate(
  candidate: KataGoCandidate | undefined,
  forcedCandidate: KataGoCandidate | undefined
): KataGoCandidate | undefined {
  if (!candidate) {
    return forcedCandidate
  }
  if (!forcedCandidate) {
    return candidate
  }
  return candidateEvidenceVisits(forcedCandidate) > candidateEvidenceVisits(candidate) ? forcedCandidate : candidate
}

function forcedActualVisits(maxVisits: number, minVisits: number): number {
  return Math.max(Math.round(maxVisits), minVisits)
}

function mergePlayedCandidateIntoTopMoves(
  topMoves: KataGoCandidate[],
  currentMove?: GameMove,
  forcedCandidate?: KataGoCandidate
): KataGoCandidate[] {
  if (!currentMove || currentMove.pass || !forcedCandidate) {
    return topMoves
  }
  const playedKey = moveKey(currentMove.gtp)
  if (!playedKey) {
    return topMoves
  }
  const existingIndex = topMoves.findIndex((candidate) => moveKey(candidate.move) === playedKey)
  if (existingIndex >= 0) {
    const currentCandidate = topMoves[existingIndex]
    const preferred = preferStrongerActualCandidate(currentCandidate, forcedCandidate)
    if (!preferred || preferred === currentCandidate) {
      return topMoves
    }
    const next = [...topMoves]
    next[existingIndex] = {
      ...preferred,
      order: currentCandidate.order
    }
    return next
  }
  return [...topMoves, forcedCandidate]
}

function displayCandidates(
  response: KataGoResponse,
  sideToMove: GameMove['color'],
  currentMove?: GameMove,
  forcedCandidate?: KataGoCandidate
): KataGoCandidate[] {
  return mergePlayedCandidateIntoTopMoves(candidates(response, sideToMove).slice(0, 8), currentMove, forcedCandidate)
}

function judgement(winrateLoss: number, _scoreLoss: number): KataGoMoveAnalysis['judgement'] {
  if (winrateLoss >= 15) {
    return 'blunder'
  }
  if (winrateLoss >= 7) {
    return 'mistake'
  }
  if (winrateLoss >= 2.5) {
    return 'inaccuracy'
  }
  return 'good_move'
}

function moveKey(move: string | undefined): string {
  return (move ?? '').trim().toUpperCase()
}

function playerWinrate(blackWinrate: number, color: GameMove['color']): number {
  return color === 'B' ? blackWinrate : 100 - blackWinrate
}

function playerScoreLead(scoreLead: number, color: GameMove['color']): number {
  return color === 'B' ? scoreLead : -scoreLead
}

function findPlayedCandidate(
  currentMove: GameMove | undefined,
  topMoves: KataGoCandidate[]
): { candidate?: KataGoCandidate; rank?: number } {
  if (!currentMove) {
    return {}
  }
  const index = topMoves.findIndex((candidate) => moveKey(candidate.move) === moveKey(currentMove.gtp))
  return index >= 0 ? { candidate: topMoves[index], rank: index + 1 } : {}
}

function playedMoveValue(
  currentMove: GameMove | undefined,
  topMoves: KataGoCandidate[],
  afterRoot: { winrate: number; scoreLead: number },
  forcedCandidate?: KataGoCandidate
): { winrate: number; scoreLead: number; playerWinrate?: number; playerScoreLead?: number; visits?: number; rank?: number; source: 'candidate' | 'forced' | 'after-root' } {
  const { candidate, rank } = findPlayedCandidate(currentMove, topMoves)
  const actual = preferStrongerActualCandidate(candidate, forcedCandidate)
  const winrate = actual?.winrate ?? afterRoot.winrate
  const scoreLead = actual?.scoreLead ?? afterRoot.scoreLead
  return {
    winrate,
    scoreLead,
    playerWinrate: currentMove ? playerWinrate(winrate, currentMove.color) : undefined,
    playerScoreLead: currentMove ? playerScoreLead(scoreLead, currentMove.color) : undefined,
    visits: actual?.visits,
    rank,
    source: actual === forcedCandidate ? 'forced' : candidate ? 'candidate' : 'after-root'
  }
}

function forcePlayedMoveQuery(
  id: string,
  moves: GameMove[],
  currentMove: GameMove | undefined,
  boardSize: number,
  komi: number,
  maxVisits: number,
  reportDuringSearchEvery?: number,
  overrideSettings?: AnalysisQuery['overrideSettings'],
  initialStones?: Array<[GameMove['color'], string]>,
  initialPlayer?: GameMove['color']
): AnalysisQuery | undefined {
  if (!currentMove || currentMove.pass || !moveKey(currentMove.gtp)) {
    return undefined
  }
  return {
    id,
    moves: moveHistory(moves),
    boardSize,
    initialStones,
    initialPlayer,
    komi,
    maxVisits,
    reportDuringSearchEvery,
    overrideSettings,
    allowMoves: [{
      player: currentMove.color,
      moves: [currentMove.gtp],
      untilDepth: 1
    }]
  }
}

function forcedPlayedCandidate(response: KataGoResponse | undefined, currentMove: GameMove | undefined): KataGoCandidate | undefined {
  if (!response || !currentMove) {
    return undefined
  }
  const playedKey = moveKey(currentMove.gtp)
  const sideCandidates = candidates(response, currentMove.color)
  return sideCandidates.find((candidate) => moveKey(candidate.move) === playedKey) ?? sideCandidates[0]
}

function playedLoss(
  currentMove: GameMove | undefined,
  best: KataGoCandidate | undefined,
  actual: { winrate: number; scoreLead: number }
): { winrateLoss: number; scoreLoss: number } {
  if (!currentMove || !best) {
    return { winrateLoss: 0, scoreLoss: 0 }
  }
  return {
    winrateLoss: Math.max(0, playerWinrate(best.winrate, currentMove.color) - playerWinrate(actual.winrate, currentMove.color)),
    scoreLoss: Math.max(0, playerScoreLead(best.scoreLead, currentMove.color) - playerScoreLead(actual.scoreLead, currentMove.color))
  }
}

function buildKataGoPayload(query: AnalysisQuery): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: query.id,
    moves: query.moves,
    initialStones: query.initialStones ?? [],
    initialPlayer: query.initialPlayer,
    rules: 'Chinese',
    komi: query.komi,
    boardXSize: query.boardSize,
    boardYSize: query.boardSize,
    maxVisits: query.maxVisits
  }
  if (!query.initialPlayer) {
    delete payload.initialPlayer
  }
  if (query.reportDuringSearchEvery !== undefined) {
    payload.reportDuringSearchEvery = query.reportDuringSearchEvery
  }
  if (query.includeOwnership) {
    payload.includeOwnership = true
  }
  if (query.includeMovesOwnership) {
    payload.includeMovesOwnership = true
  }
  if (query.includeOwnershipStdev) {
    payload.includeOwnershipStdev = true
  }
  if (query.includePolicy) {
    payload.includePolicy = true
  }
  if (query.includePVVisits) {
    payload.includePVVisits = true
  }
  if (query.overrideSettings) {
    payload.overrideSettings = {
      reportAnalysisWinratesAs: 'SIDETOMOVE',
      ...query.overrideSettings
    }
  } else {
    payload.overrideSettings = { reportAnalysisWinratesAs: 'SIDETOMOVE' }
  }
  if (query.allowMoves) {
    payload.allowMoves = query.allowMoves
  }
  return payload
}

async function queryKataGoBatch(
  queries: AnalysisQuery[],
  onResponse?: (response: KataGoResponse) => void,
  options: QueryBatchOptions = {}
): Promise<Map<string, KataGoResponse>> {
  if (queries.length === 0) {
    return new Map()
  }
  const settings = getSettings()
  const runtime = resolveKataGoRuntime(settings)
  if (options.replaceGroup && options.group) {
    cancelKataGoAnalysis({ group: options.group })
  }
  const engineLease = beginKataGoEngineTask({
    group: options.group,
    queryCount: queries.length
  })
  const zhiziPreferred = shouldPreferZhiziGtpEngine(settings, runtime.ready)
  async function queryZhiziRemote(): Promise<Map<string, KataGoResponse>> {
    const results = await queryZhiziGtpAnalysisBatch({
      settings,
      queries: queries.map(buildKataGoPayload),
      runId: options.runId,
      group: options.group,
      timeoutMs: Math.max(240_000, queries.length * 9000),
      resolvePartialAfterMs: options.resolvePartialAfterMs,
      onResponse: onResponse as ((response: Record<string, unknown>) => void) | undefined
    })
    return results as Map<string, KataGoResponse>
  }
  function canUseZhiziAutoFallback(error: unknown): boolean {
    const text = String(error)
    return Boolean(
      !/cancel|取消/i.test(text) &&
      !zhiziPreferred &&
      settings.katagoEngineMode === 'auto' &&
      zhiziGtpConfigured(settings)
    )
  }
  async function queryZhiziAfterLocalFailure(error: unknown): Promise<Map<string, KataGoResponse>> {
    console.warn('Local KataGo analysis failed in auto mode; falling back to Zhizi cloud.', error)
    const results = await queryZhiziRemote()
    engineLease.finish('done')
    return results
  }
  if (zhiziPreferred) {
    try {
      const results = await queryZhiziRemote()
      engineLease.finish('done')
      return results as Map<string, KataGoResponse>
    } catch (error) {
      const status = String(error).includes('已取消') || String(error).includes('cancel') ? 'cancelled' : 'error'
      if (status === 'cancelled' || settings.katagoEngineMode === 'zhizi' || !runtime.ready) {
        engineLease.finish(status)
        throw error
      }
      console.warn('Zhizi cloud GTP engine failed; falling back to local KataGo.', error)
    }
  }
  const ikatagoPreferred = shouldPreferIKataGoEngine(settings, runtime.ready)
  if (ikatagoPreferred) {
    try {
      const results = await queryIKataGoAnalysisBatch({
        settings,
        queries: queries.map(buildKataGoPayload),
        runId: options.runId,
        group: options.group,
        timeoutMs: Math.max(180_000, queries.length * 5000),
        resolvePartialAfterMs: options.resolvePartialAfterMs,
        onResponse: onResponse as ((response: Record<string, unknown>) => void) | undefined
      })
      engineLease.finish('done')
      return results as Map<string, KataGoResponse>
    } catch (error) {
      const status = String(error).includes('已取消') || String(error).includes('cancel') ? 'cancelled' : 'error'
      if (status === 'cancelled' || settings.katagoEngineMode === 'ikatago' || !runtime.ready) {
        engineLease.finish(status)
        throw error
      }
      console.warn('iKataGo remote engine failed; falling back to local KataGo.', error)
    }
  }
  if (!runtime.ready) {
    throw new Error(`${runtime.status}: ${runtime.notes.join('；')}`)
  }
  const command = [
    runtime.katagoBin,
    'analysis',
    '-config',
    runtime.katagoConfig,
    '-model',
    runtime.katagoModel
  ]

  if (persistentKataGoEngineEnabled()) {
    try {
      const results = await queryKataGoPersistentBatch({
        command,
        queries: queries.map(buildKataGoPayload),
        runId: options.runId,
        group: options.group,
        timeoutMs: Math.max(180_000, queries.length * 5000),
        onResponse: onResponse as ((response: Record<string, unknown>) => void) | undefined
      })
      engineLease.finish('done')
      return results as Map<string, KataGoResponse>
    } catch (error) {
      const status = String(error).includes('已取消') || String(error).includes('cancel') ? 'cancelled' : 'error'
      if (canUseZhiziAutoFallback(error)) {
        return queryZhiziAfterLocalFailure(error)
      }
      if (status === 'cancelled' || !persistentKataGoFallbackEnabled()) {
        engineLease.finish(status)
        throw error
      }
      console.warn('Persistent KataGo engine failed; falling back to spawn-per-batch mode.', error)
    }
  }

  let child: ChildProcessWithoutNullStreams
  try {
    child = spawn(command[0], command.slice(1), {
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch (error) {
    if (canUseZhiziAutoFallback(error)) {
      return queryZhiziAfterLocalFailure(error)
    }
    throw error
  }

  let stderr = ''
  const processRunId = options.runId || randomUUID()
  const activeEntry: ActiveKataGoProcess = {
    child,
    group: options.group,
    cancelled: false
  }
  activeKataGoProcesses.set(processRunId, activeEntry)

  function cleanup(): void {
    const current = activeKataGoProcesses.get(processRunId)
    if (current === activeEntry) {
      activeKataGoProcesses.delete(processRunId)
    }
  }

  child.stderr.on('data', (chunk) => {
    stderr += String(chunk)
  })

  const localSpawnPromise = new Promise<Map<string, KataGoResponse>>((resolve, reject) => {
    let settled = false
    let stdout = ''
    const results = new Map<string, KataGoResponse>()
    let partialTimer: NodeJS.Timeout | undefined
    function clearPartialTimer(): void {
      if (partialTimer) {
        clearTimeout(partialTimer)
        partialTimer = undefined
      }
    }
    function schedulePartialResolve(): void {
      const partialAfterMs = options.resolvePartialAfterMs
      if (!partialAfterMs || results.size === 0 || results.size >= queries.length || settled) {
        return
      }
      clearPartialTimer()
      partialTimer = setTimeout(() => {
        if (settled || results.size === 0) {
          return
        }
        settled = true
        clearTimeout(timer)
        child.kill()
        cleanup()
        engineLease.finish('done')
        resolve(results)
      }, partialAfterMs)
    }
    const timer = setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      clearPartialTimer()
      child.kill()
      cleanup()
      engineLease.finish('error')
      reject(new Error('KataGo 分析超时'))
    }, Math.max(180_000, queries.length * 5000))

    child.stdout.on('data', (chunk) => {
      if (settled) {
        return
      }
      stdout += String(chunk)
      while (stdout.includes('\n')) {
        const newline = stdout.indexOf('\n')
        const line = stdout.slice(0, newline).trim()
        stdout = stdout.slice(newline + 1)
        if (!line) {
          continue
        }
        try {
          const parsed = JSON.parse(line) as KataGoResponse
          const id = parsed.id ?? ''
          if (id) {
            onResponse?.(parsed)
          }
          if (id && !parsed.isDuringSearch) {
            results.set(id, parsed)
            schedulePartialResolve()
          }
        } catch (error) {
          settled = true
          clearTimeout(timer)
          clearPartialTimer()
          child.kill()
          cleanup()
          engineLease.finish('error')
          reject(new Error(`无法解析 KataGo 输出: ${String(error)}\n${line.slice(0, 500)}`))
          return
        }
        if (results.size >= queries.length) {
          settled = true
          clearTimeout(timer)
          clearPartialTimer()
          child.kill()
          cleanup()
          engineLease.finish('done')
          resolve(results)
          return
        }
      }
    })

    child.once('error', (error) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      clearPartialTimer()
      cleanup()
      engineLease.finish('error')
      reject(error)
    })

    child.once('close', (code) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      clearPartialTimer()
      cleanup()
      if (activeEntry.cancelled) {
        engineLease.finish('cancelled')
        reject(new Error('KataGo 分析已取消'))
        return
      }
      if (code !== 0 && code !== null) {
        engineLease.finish('error')
        reject(new Error(stderr.trim() || `KataGo exited with ${code}`))
        return
      }
      engineLease.finish('error')
      reject(new Error(stderr.trim() || `KataGo 没有返回完整分析结果，已收到 ${results.size}/${queries.length} 个局面`))
    })

    for (const query of queries) {
      const payload: Record<string, unknown> = {
        id: query.id,
        moves: query.moves,
        initialStones: query.initialStones ?? [],
        initialPlayer: query.initialPlayer,
        rules: 'Chinese',
        komi: query.komi,
        boardXSize: query.boardSize,
        boardYSize: query.boardSize,
        maxVisits: query.maxVisits
      }
      if (!query.initialPlayer) {
        delete payload.initialPlayer
      }
      if (query.reportDuringSearchEvery !== undefined) {
        payload.reportDuringSearchEvery = query.reportDuringSearchEvery
      }
      if (query.includeOwnership) {
        payload.includeOwnership = true
      }
      if (query.includeMovesOwnership) {
        payload.includeMovesOwnership = true
      }
      if (query.includeOwnershipStdev) {
        payload.includeOwnershipStdev = true
      }
      if (query.includePolicy) {
        payload.includePolicy = true
      }
      if (query.includePVVisits) {
        payload.includePVVisits = true
      }
      if (query.overrideSettings) {
        payload.overrideSettings = { reportAnalysisWinratesAs: 'SIDETOMOVE', ...query.overrideSettings }
      } else {
        payload.overrideSettings = { reportAnalysisWinratesAs: 'SIDETOMOVE' }
      }
      if (query.allowMoves) {
        payload.allowMoves = query.allowMoves
      }
      child.stdin.write(`${JSON.stringify(payload)}\n`)
    }
    child.stdin.end()
  })
  return localSpawnPromise.catch(async (error) => {
    if (!canUseZhiziAutoFallback(error)) {
      throw error
    }
    return queryZhiziAfterLocalFailure(error)
  })
}

async function queryKataGo(
  moves: Array<[string, string]>,
  boardSize: number,
  komi: number,
  id: string,
  maxVisits: number
): Promise<KataGoResponse> {
  const results = await queryKataGoBatch([{ id, moves, boardSize, komi, maxVisits }])
  const result = results.get(id)
  if (!result) {
    throw new Error(`KataGo 没有返回局面 ${id}`)
  }
  return result
}

export async function analyzePosition(
  gameId: string,
  moveNumber: number,
  maxVisits = 500,
  options: {
    runId?: string
    group?: KataGoAnalysisGroup
  } = {}
): Promise<KataGoMoveAnalysis> {
  maxVisits = effectiveVisitsForSpeedMode(maxVisits, 'position')
  const indexedGame = findGame(gameId)
  if (!indexedGame) {
    throw new Error(`找不到棋谱: ${gameId}`)
  }
  const game = await ensureFoxGameDownloaded(indexedGame)
  const record = readGameRecord(game)
  const currentMove = moveNumber > 0 ? record.moves[moveNumber - 1] : undefined
  const beforeMoves = record.moves.slice(0, Math.max(0, moveNumber - 1))
  const afterMoves = record.moves.slice(0, Math.max(0, moveNumber))
  const komi = analysisKomiForRecord(record)
  const rootInitialStones = initialStonesFromRecord(record)
  const rootInitialPlayer = initialPlayerFromRecord(record)
  const deepEvidence = maxVisits >= 500

  const afterVisits = Math.max(24, Math.floor(maxVisits * 0.55))
  const beforeId = `${gameId}-before-${moveNumber}`
  const afterId = `${gameId}-after-${moveNumber}`
  const actualId = `${gameId}-actual-${moveNumber}`
  const queries: AnalysisQuery[] = [
    {
      id: beforeId,
      moves: moveHistory(beforeMoves),
      boardSize: record.boardSize,
      initialStones: rootInitialStones,
      initialPlayer: rootInitialPlayer,
      includeOwnership: deepEvidence,
      includeMovesOwnership: deepEvidence,
      includePolicy: true,
      includePVVisits: true,
      komi,
      maxVisits
    },
    {
      id: afterId,
      moves: moveHistory(afterMoves),
      boardSize: record.boardSize,
      initialStones: rootInitialStones,
      initialPlayer: rootInitialPlayer,
      includeOwnership: deepEvidence,
      includePolicy: true,
      includePVVisits: true,
      komi,
      maxVisits: afterVisits
    }
  ]
  const actualQuery = forcePlayedMoveQuery(
    actualId,
    beforeMoves,
    currentMove,
    record.boardSize,
    komi,
    forcedActualVisits(maxVisits, FORCED_ACTUAL_EVIDENCE_MIN_VISITS),
    undefined,
    undefined,
    rootInitialStones,
    rootInitialPlayer
  )
  if (actualQuery) {
    actualQuery.includePVVisits = true
    actualQuery.includePolicy = true
    queries.push(actualQuery)
  }
  const responses = await queryKataGoBatch(queries, undefined, {
    runId: options.runId,
    group: options.group ?? 'single'
  })
  const beforeResponse = responses.get(beforeId)
  const afterResponse = responses.get(afterId)
  if (!beforeResponse || !afterResponse) {
    throw new Error(`KataGo 没有返回完整局面分析: before=${Boolean(beforeResponse)} after=${Boolean(afterResponse)}`)
  }
  return buildMoveAnalysis(
    gameId,
    moveNumber,
    record.boardSize,
    currentMove,
    sideToMoveAt(record.moves, moveNumber - 1),
    sideToMoveAt(record.moves, moveNumber),
    beforeResponse,
    afterResponse,
    responses.get(actualId)
  )
}

function buildMoveAnalysis(
  gameId: string,
  moveNumber: number,
  boardSize: number,
  currentMove: GameMove | undefined,
  beforeSideToMove: GameMove['color'],
  afterSideToMove: GameMove['color'],
  beforeResponse: KataGoResponse,
  afterResponse: KataGoResponse,
  actualResponse?: KataGoResponse
): KataGoMoveAnalysis {
  const beforeRoot = root(beforeResponse, beforeSideToMove)
  const afterRoot = root(afterResponse, afterSideToMove)
  const searchMoves = candidates(beforeResponse, beforeSideToMove)
  const forcedActual = forcedPlayedCandidate(actualResponse, currentMove)
  const topMoves = displayCandidates(beforeResponse, beforeSideToMove, currentMove, forcedActual)
  const afterTopMoves = candidates(afterResponse, afterSideToMove).slice(0, 8)
  const best = searchMoves[0] ?? topMoves[0]
  const actual = playedMoveValue(currentMove, searchMoves, afterRoot, forcedActual)
  const { winrateLoss, scoreLoss } = playedLoss(currentMove, best, actual)

  const analysis: KataGoMoveAnalysis = {
    gameId,
    moveNumber,
    boardSize,
    currentMove,
    before: {
      ...beforeRoot,
      topMoves
    },
    after: {
      ...afterRoot,
      topMoves: afterTopMoves
    },
    playedMove: currentMove
      ? {
          move: currentMove.gtp,
          winrate: actual.winrate,
          scoreLead: actual.scoreLead,
          playerWinrate: actual.playerWinrate,
          playerScoreLead: actual.playerScoreLead,
          visits: actual.visits,
          rank: actual.rank,
          source: actual.source,
          winrateLoss,
          scoreLoss
        }
      : undefined,
    judgement: judgement(winrateLoss, scoreLoss),
    analysisQuality: buildAnalysisQuality(moveNumber, currentMove, searchMoves, forcedActual)
  }
  analysis.moveClassification = classifyMoveAnalysis(analysis)
  analysis.pvConfidence = buildPvConfidenceReport(analysis)
  analysis.tracePacket = buildKataGoTracePacket(analysis)
  return analysis
}

export async function analyzePositionWithProgress(
  gameId: string,
  moveNumber: number,
  maxVisits = 500,
  onProgress?: (analysis: KataGoMoveAnalysis, isFinal: boolean) => void,
  reportDuringSearchEvery = 0.2
): Promise<KataGoMoveAnalysis> {
  maxVisits = effectiveVisitsForSpeedMode(maxVisits, 'position')
  const indexedGame = findGame(gameId)
  if (!indexedGame) {
    throw new Error(`找不到棋谱: ${gameId}`)
  }
  const game = await ensureFoxGameDownloaded(indexedGame)
  const record = readGameRecord(game)
  const currentMove = moveNumber > 0 ? record.moves[moveNumber - 1] : undefined
  const beforeMoves = record.moves.slice(0, Math.max(0, moveNumber - 1))
  const afterMoves = record.moves.slice(0, Math.max(0, moveNumber))
  const komi = analysisKomiForRecord(record)
  const rootInitialStones = initialStonesFromRecord(record)
  const rootInitialPlayer = initialPlayerFromRecord(record)
  const deepEvidence = maxVisits >= 500
  const afterVisits = Math.max(24, Math.floor(maxVisits * 0.55))
  const beforeId = `${gameId}-before-${moveNumber}-stream`
  const afterId = `${gameId}-after-${moveNumber}-stream`
  const actualId = `${gameId}-actual-${moveNumber}-stream`
  const beforeSideToMove = sideToMoveAt(record.moves, moveNumber - 1)
  const afterSideToMove = sideToMoveAt(record.moves, moveNumber)
  let latestBefore: KataGoResponse | undefined
  let latestAfter: KataGoResponse | undefined
  let latestActual: KataGoResponse | undefined

  let responses: Map<string, KataGoResponse>
  try {
    const queries: AnalysisQuery[] = [
      {
        id: beforeId,
        moves: moveHistory(beforeMoves),
        boardSize: record.boardSize,
        initialStones: rootInitialStones,
        initialPlayer: rootInitialPlayer,
        includeOwnership: deepEvidence,
        includeMovesOwnership: deepEvidence,
        includePolicy: true,
        includePVVisits: true,
        komi,
        maxVisits,
        reportDuringSearchEvery
      },
      {
        id: afterId,
        moves: moveHistory(afterMoves),
        boardSize: record.boardSize,
        initialStones: rootInitialStones,
        initialPlayer: rootInitialPlayer,
        includeOwnership: deepEvidence,
        includePolicy: true,
        includePVVisits: true,
        komi,
        maxVisits: afterVisits,
        reportDuringSearchEvery
      }
    ]
    const actualQuery = forcePlayedMoveQuery(
      actualId,
      beforeMoves,
      currentMove,
      record.boardSize,
      komi,
      forcedActualVisits(maxVisits, FORCED_ACTUAL_EVIDENCE_MIN_VISITS),
      reportDuringSearchEvery,
      undefined,
      rootInitialStones,
      rootInitialPlayer
    )
    if (actualQuery) {
      actualQuery.includePVVisits = true
      actualQuery.includePolicy = true
      queries.push(actualQuery)
    }
    responses = await queryKataGoBatch(queries, (response) => {
      if (response.id === beforeId) {
        latestBefore = response
      }
      if (response.id === afterId) {
        latestAfter = response
      }
      if (response.id === actualId) {
        latestActual = response
      }
      if (latestBefore?.rootInfo && latestAfter?.rootInfo && (!actualQuery || latestActual?.rootInfo)) {
        const partial = buildMoveAnalysis(gameId, moveNumber, record.boardSize, currentMove, beforeSideToMove, afterSideToMove, latestBefore, latestAfter, latestActual)
        onProgress?.(partial, !latestBefore.isDuringSearch && !latestAfter.isDuringSearch && !latestActual?.isDuringSearch)
      }
    }, {
      runId: `${gameId}-live-${moveNumber}`,
      group: 'live',
      replaceGroup: true
    })
  } catch (error) {
    if (String(error).includes('已取消')) {
      if (latestBefore?.rootInfo && latestAfter?.rootInfo) {
        const partial = buildMoveAnalysis(gameId, moveNumber, record.boardSize, currentMove, beforeSideToMove, afterSideToMove, latestBefore, latestAfter, latestActual)
        onProgress?.(partial, true)
        return partial
      }
      throw error
    }
    if (String(error).includes('KataGo 分析超时') && latestBefore?.rootInfo && latestAfter?.rootInfo) {
      const partial = buildMoveAnalysis(gameId, moveNumber, record.boardSize, currentMove, beforeSideToMove, afterSideToMove, latestBefore, latestAfter, latestActual)
      onProgress?.(partial, true)
      return partial
    }
    throw error
  }

  const beforeResponse = responses.get(beforeId)
  const afterResponse = responses.get(afterId)
  if (!beforeResponse || !afterResponse) {
    throw new Error(`KataGo 没有返回完整局面分析: before=${Boolean(beforeResponse)} after=${Boolean(afterResponse)}`)
  }
  const final = buildMoveAnalysis(gameId, moveNumber, record.boardSize, currentMove, beforeSideToMove, afterSideToMove, beforeResponse, afterResponse, responses.get(actualId))
  onProgress?.(final, true)
  return final
}

export async function analyzeGameQuick(
  gameId: string,
  maxVisits = QUICK_ANALYSIS_FAST_VISITS,
  onProgress?: (progress: QuickProgress) => void,
  options: {
    refineVisits?: number
    refineTopN?: number
    runId?: string
    group?: KataGoAnalysisGroup
  } = {}
): Promise<KataGoMoveAnalysis[]> {
  const indexedGame = findGame(gameId)
  if (!indexedGame) {
    throw new Error(`找不到棋谱: ${gameId}`)
  }
  const game = await ensureFoxGameDownloaded(indexedGame)

  const record = readGameRecord(game)
  const normalizedKomi = analysisKomiForRecord(record)
  const moves = record.moves
  const rootInitialStones = initialStonesFromRecord(record)
  const rootInitialPlayer = initialPlayerFromRecord(record)
  const queries: AnalysisQuery[] = []
  const requestedQuickVisits = Math.min(QUICK_ANALYSIS_MAX_SWEEP_VISITS, Math.round(maxVisits))
  const quickVisits = Math.max(
    QUICK_ANALYSIS_FAST_VISITS,
    Math.min(QUICK_ANALYSIS_MAX_SWEEP_VISITS, effectiveVisitsForSpeedMode(requestedQuickVisits, 'quick'))
  )
  const quickOverrideSettings = { wideRootNoise: QUICK_ANALYSIS_WIDE_ROOT_NOISE }
  const rootPositionCount = moves.length + 1

  // Build the visible winrate line first. Forced actual-move queries are queued
  // only for suspected mistakes during the refine pass so long games do not
  // spend the first pass on hundreds of forced branches.
  for (let moveNumber = 0; moveNumber <= moves.length; moveNumber += 1) {
    queries.push({
      id: `${gameId}-quick-${moveNumber}`,
      moves: moveHistory(moves.slice(0, moveNumber)),
      boardSize: record.boardSize,
      initialStones: rootInitialStones,
      initialPlayer: rootInitialPlayer,
      komi: normalizedKomi,
      maxVisits: quickVisits,
      overrideSettings: quickOverrideSettings
    })
  }

  const roots = new Map<number, { winrate: number; scoreLead: number }>()
  const topMovesByPosition = new Map<number, KataGoCandidate[]>()
  const actualCandidatesByMove = new Map<number, KataGoCandidate>()
  const emittedQuality = new Map<number, number>()
  const idPrefix = `${gameId}-quick-`
  const actualIdPrefix = `${gameId}-quick-actual-`

  function buildEvaluation(moveNumber: number): KataGoMoveAnalysis | null {
    const before = roots.get(moveNumber - 1)
    const after = roots.get(moveNumber)
    if (!before || !after || moveNumber < 1 || moveNumber > moves.length) {
      return null
    }
    const beforeTopMoves = topMovesByPosition.get(moveNumber - 1) ?? []
    const afterTopMoves = topMovesByPosition.get(moveNumber) ?? []
    const currentMove = moves[moveNumber - 1]
    const forcedActual = actualCandidatesByMove.get(moveNumber)
    const playedCandidate = findPlayedCandidate(currentMove, beforeTopMoves).candidate
    const displayBeforeMoves = mergePlayedCandidateIntoTopMoves(beforeTopMoves, currentMove, forcedActual)
    const best = beforeTopMoves[0] ?? displayBeforeMoves[0]
    const actual = playedMoveValue(currentMove, beforeTopMoves, after, forcedActual)
    const { winrateLoss, scoreLoss } = playedLoss(currentMove, best, actual)
    const analysis: KataGoMoveAnalysis = {
      gameId,
      moveNumber,
      boardSize: record.boardSize,
      currentMove,
      before: {
        ...before,
        topMoves: displayBeforeMoves
      },
      after: {
        ...after,
        topMoves: afterTopMoves
      },
      playedMove: {
        move: currentMove.gtp,
        winrate: actual.winrate,
        scoreLead: actual.scoreLead,
        playerWinrate: actual.playerWinrate,
        playerScoreLead: actual.playerScoreLead,
        visits: actual.visits,
        rank: actual.rank,
        source: actual.source,
        winrateLoss,
        scoreLoss
      },
      judgement: judgement(winrateLoss, scoreLoss)
    }
    analysis.moveClassification = classifyMoveAnalysis(analysis)
    analysis.pvConfidence = buildPvConfidenceReport(analysis)
    analysis.tracePacket = buildKataGoTracePacket(analysis)
    return analysis
  }

  function evaluationProgressQuality(evaluation: KataGoMoveAnalysis): number {
    if (evaluation.playedMove?.source === 'forced') return 3
    if (evaluation.playedMove?.source === 'candidate') return 2
    if (evaluation.playedMove?.source === 'after-root') return 1
    return 0
  }

  function emitIfReady(moveNumber: number): void {
    if (!onProgress) {
      return
    }
    const evaluation = buildEvaluation(moveNumber)
    if (!evaluation) {
      return
    }
    const quality = evaluationProgressQuality(evaluation)
    const previousQuality = emittedQuality.get(moveNumber) ?? -1
    if (quality <= previousQuality) {
      return
    }
    emittedQuality.set(moveNumber, quality)
    onProgress({
      evaluation,
      analyzedPositions: Math.min(roots.size, rootPositionCount),
      totalPositions: rootPositionCount
    })
  }

  function buildReadyEvaluations(): KataGoMoveAnalysis[] {
    const evaluations: KataGoMoveAnalysis[] = []
    for (let moveNumber = 1; moveNumber <= moves.length; moveNumber += 1) {
      const evaluation = buildEvaluation(moveNumber)
      if (!evaluation) {
        continue
      }
      evaluations.push(evaluation)
    }
    return evaluations
  }

  const runId = options.runId || `${gameId}-quick-${Date.now()}`
  const group = options.group ?? 'quick'
  let responses: Map<string, KataGoResponse>
  try {
    responses = await queryKataGoBatch(queries, (response) => {
      if (response.id?.startsWith(actualIdPrefix)) {
        const moveNumber = Number.parseInt(response.id.slice(actualIdPrefix.length), 10)
        if (Number.isFinite(moveNumber)) {
          const candidate = forcedPlayedCandidate(response, moves[moveNumber - 1])
          if (candidate) {
            actualCandidatesByMove.set(moveNumber, candidate)
          }
          emitIfReady(moveNumber)
        }
        return
      }
      if (!response.id?.startsWith(idPrefix)) {
        return
      }
      const position = Number.parseInt(response.id.slice(idPrefix.length), 10)
      if (!Number.isFinite(position)) {
        return
      }
      try {
        const sideToMove = sideToMoveAt(moves, position)
        roots.set(position, root(response, sideToMove))
        topMovesByPosition.set(position, candidates(response, sideToMove).slice(0, 8))
        emitIfReady(position)
        emitIfReady(position + 1)
      } catch {
        // Keep the quick graph resilient: one invalid branch point should not block the rest.
      }
    }, {
      runId: `${runId}-root`,
      group,
      replaceGroup: group === 'quick'
    })
  } catch (error) {
    if (isKataGoTimeoutError(error)) {
      const partial = buildReadyEvaluations()
      if (partial.length > 0) {
        return partial
      }
    }
    throw error
  }

  for (let moveNumber = 0; moveNumber <= moves.length; moveNumber += 1) {
    const response = responses.get(`${gameId}-quick-${moveNumber}`)
    if (response && !topMovesByPosition.has(moveNumber)) {
      topMovesByPosition.set(moveNumber, candidates(response, sideToMoveAt(moves, moveNumber)).slice(0, 8))
    }
    if (response && !roots.has(moveNumber)) {
      try {
        roots.set(moveNumber, root(response, sideToMoveAt(moves, moveNumber)))
      } catch {
        // Keep the quick graph resilient: one invalid branch point should not block the rest.
      }
    }
  }

  for (let moveNumber = 1; moveNumber <= moves.length; moveNumber += 1) {
    if (actualCandidatesByMove.has(moveNumber)) {
      continue
    }
    const response = responses.get(`${gameId}-quick-actual-${moveNumber}`)
    const candidate = forcedPlayedCandidate(response, moves[moveNumber - 1])
    if (candidate) {
      actualCandidatesByMove.set(moveNumber, candidate)
    }
  }

  if (roots.size < 2) {
    throw new Error('KataGo 快速分析没有返回有效局面')
  }

  const evaluations = buildReadyEvaluations()

  const refineVisits = Math.max(quickVisits, effectiveVisitsForSpeedMode(options.refineVisits ?? QUICK_ANALYSIS_REFINE_VISITS, 'refine'))
  const refineTopN = Math.max(0, Math.round(options.refineTopN ?? QUICK_ANALYSIS_REFINE_TOP_N))
  const refineMoveNumbers = refineVisits > quickVisits && refineTopN > 0
    ? evaluations
      .filter((item) => (item.playedMove?.winrateLoss ?? 0) >= QUICK_ANALYSIS_REFINE_MIN_LOSS)
      .sort((left, right) =>
        (right.playedMove?.winrateLoss ?? 0) - (left.playedMove?.winrateLoss ?? 0) ||
        left.moveNumber - right.moveNumber
      )
      .slice(0, refineTopN)
      .map((item) => item.moveNumber)
    : []

  if (refineMoveNumbers.length === 0) {
    return evaluations
  }

  const refineQueries: AnalysisQuery[] = []
  for (const moveNumber of refineMoveNumbers) {
    const currentMove = moves[moveNumber - 1]
    const beforeMoves = moves.slice(0, moveNumber - 1)
    const afterMoves = moves.slice(0, moveNumber)
    refineQueries.push({
      id: `${gameId}-quick-refine-before-${moveNumber}`,
      moves: moveHistory(beforeMoves),
      boardSize: record.boardSize,
      initialStones: rootInitialStones,
      initialPlayer: rootInitialPlayer,
      komi: normalizedKomi,
      maxVisits: refineVisits,
      overrideSettings: quickOverrideSettings
    })
    refineQueries.push({
      id: `${gameId}-quick-refine-after-${moveNumber}`,
      moves: moveHistory(afterMoves),
      boardSize: record.boardSize,
      initialStones: rootInitialStones,
      initialPlayer: rootInitialPlayer,
      komi: normalizedKomi,
      maxVisits: Math.max(quickVisits, Math.floor(refineVisits * 0.6)),
      overrideSettings: quickOverrideSettings
    })
    const actualQuery = forcePlayedMoveQuery(
      `${gameId}-quick-refine-actual-${moveNumber}`,
      beforeMoves,
      currentMove,
      record.boardSize,
      normalizedKomi,
      forcedActualVisits(refineVisits, QUICK_FORCED_ACTUAL_REFINE_MIN_VISITS),
      undefined,
      quickOverrideSettings,
      rootInitialStones,
      rootInitialPlayer
    )
    if (actualQuery) {
      refineQueries.push(actualQuery)
    }
  }

  let refinedResponses: Map<string, KataGoResponse>
  try {
    refinedResponses = await queryKataGoBatch(refineQueries, undefined, {
      runId: `${runId}-refine`,
      group,
      resolvePartialAfterMs: 6_000
    })
  } catch (error) {
    if (isKataGoTimeoutError(error)) {
      return evaluations
    }
    throw error
  }
  const byMove = new Map(evaluations.map((item) => [item.moveNumber, item]))
  let refinedCount = 0
  for (const moveNumber of refineMoveNumbers) {
    const beforeResponse = refinedResponses.get(`${gameId}-quick-refine-before-${moveNumber}`)
    const afterResponse = refinedResponses.get(`${gameId}-quick-refine-after-${moveNumber}`)
    if (!beforeResponse || !afterResponse) {
      continue
    }
    const refined = buildMoveAnalysis(
      gameId,
      moveNumber,
      record.boardSize,
      moves[moveNumber - 1],
      sideToMoveAt(moves, moveNumber - 1),
      sideToMoveAt(moves, moveNumber),
      beforeResponse,
      afterResponse,
      refinedResponses.get(`${gameId}-quick-refine-actual-${moveNumber}`)
    )
    byMove.set(moveNumber, refined)
    refinedCount += 1
    onProgress?.({
      evaluation: refined,
      analyzedPositions: rootPositionCount + refinedCount,
      totalPositions: rootPositionCount + refineMoveNumbers.length
    })
  }

  return [...byMove.values()].sort((left, right) => left.moveNumber - right.moveNumber)
}
