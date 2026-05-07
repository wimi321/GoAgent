import type { FormEvent, KeyboardEvent, PointerEvent, ReactElement, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AnalyzeGameQuickProgress,
  AppSettings,
  CoachUserLevel,
  DashboardData,
  GameMove,
  GameRecord,
  KataGoCandidate,
  KataGoAssetInstallProgress,
  KataGoAssetStatus,
  KataGoBenchmarkResult,
  KataGoMoveAnalysis,
  KataGoModelPresetId,
  LibraryGame,
  StoneColor,
  StudentBindingSuggestion,
  StudentAgeRange,
  StudentRank,
  StudentProfile,
  ReleaseReadinessResult,
  MoveRangeReviewSummary,
  TeacherRunRequest,
  TeacherRunProgress,
  TeacherRunResult,
  TeacherChatMessage,
  TeacherExplanationPace,
  TeacherPersonaStyle,
  TeacherSession,
  TeacherTerminologyDensity,
  TeacherVariationDetail
} from '@main/lib/types'
import { BRAND_DISPLAY_NAME, BRAND_NAME } from '@shared/brand'
import { MOVE_RANGE_MAX_MOVES, describeMoveRange, parseMoveRangeFromPrompt, validateMoveRange } from '@shared/moveRange'
import lizzieBlackStoneUrl from './assets/lizzie/black.png'
import lizzieBoardUrl from './assets/lizzie/board.png'
import lizzieWhiteStoneUrl from './assets/lizzie/white.png'
import logoUrl from '../../../assets/logo.png'
import { GoBoardV2 } from './features/board/GoBoardV2'
import type { KeyMoveSummary } from './features/board/KeyMoveNavigator'
import { WinrateTimelineV2 } from './features/board/WinrateTimelineV2'
import { boardPointLabel, parseBoardPoint, type BoardPoint, type RenderKeyMove } from './features/board/boardGeometry'
import { DiagnosticsGate } from './features/diagnostics/DiagnosticsGate'
import { UiGallery } from './features/gallery/UiGallery'
import { BetaAcceptancePanel, type BetaAcceptanceItem } from './features/release/BetaAcceptancePanel'
import { StudentBindingDialog } from './features/student/StudentBindingDialog'
import { StudentRailCard } from './features/student/StudentRailCard'
import { KataGoAssetsPanel } from './features/settings/KataGoAssetsPanel'
import { TeacherSpeechControls } from './features/tts/TeacherSpeechControls'
import { TtsSettingsPanel } from './features/tts/TtsSettingsPanel'
import { TeacherComposerPro } from './features/teacher/TeacherComposerPro'
import {
  createUiTranslator,
  humanizeUiError,
  localizeKataGoStatus,
  normalizeUiLocale,
  SUPPORTED_UI_LOCALES,
  translateKataGoPreset,
  translateKataGoPresetGroup,
  type UiTranslator
} from './i18n'
import './features/diagnostics/diagnostics.css'
import './features/student/student.css'
import './features/teacher/teacher-run-card.css'

const emptyDashboard: DashboardData = {
  settings: {
    katagoBin: '',
    katagoConfig: '',
    katagoModel: '',
    katagoModelPreset: 'official-b18-recommended',
    katagoAnalysisThreads: 0,
    katagoSearchThreadsPerAnalysisThread: 1,
    katagoMaxBatchSize: 32,
    katagoCacheSizePowerOfTwo: 20,
    katagoBenchmarkThreads: 0,
    katagoBenchmarkVisitsPerSecond: 0,
    katagoBenchmarkUpdatedAt: '',
    pythonBin: 'python',
    llmBaseUrl: 'https://api.openai.com/v1',
    llmApiKey: '',
    llmModel: 'gpt-5-mini',
    reviewLanguage: 'zh-CN',
    defaultPlayerName: '',
    ttsEnabled: true,
    ttsAutoPlay: false,
    ttsProvider: 'kokoro-bundled',
    ttsLanguage: 'zh-CN',
    ttsVoiceId: 'zf_001',
    ttsRate: 1,
    ttsPitch: 1,
    ttsVolume: 1,
    ttsReadMode: 'summary',
    ttsCacheEnabled: true,
    ttsKokoroDType: 'q8',
    ttsKokoroDevice: 'cpu',
    ttsCustomBaseUrl: '',
    ttsCustomApiKey: '',
    ttsCustomModel: '',
    ttsCustomVoice: '',
    ttsCustomHeadersJson: '',
    ttsCustomBodyTemplate: '',
    ttsCustomResponseType: 'audio-bytes',
    ttsCustomAudioJsonPath: '',
    defaultCoachLevel: 'intermediate',
    defaultStudentRank: 'sub1d',
    defaultStudentAge: 0,
    defaultStudentAgeRange: 'unknown',
    teacherStyle: 'balanced',
    teacherTerminologyDensity: 'medium',
    teacherExplanationPace: 'standard',
    teacherVariationDetail: 'moderate'
  },
  games: [],
  systemProfile: {
    katagoBin: '',
    katagoConfig: '',
    katagoModel: '',
    katagoReady: false,
    katagoStatus: 'KataGo Missing',
    katagoModelPreset: 'official-b18-recommended',
    katagoModelPresets: [],
    proxyBaseUrl: '',
    proxyApiKey: '',
    proxyModels: [],
    hasLlmApiKey: false,
    notes: []
  }
}

const fallbackLlmModels = [
  'gpt-5.5',
  'gpt-5.4-mini',
  'gpt-5-codex-mini',
  'gpt-5',
  'gpt-4.1',
  'claude-3-5-sonnet-latest'
]

function uniqueModelOptions(models: string[]): string[] {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)))
}

type ChatMessage = {
  id: string
  role: 'student' | 'teacher'
  content: string
  status?: 'running' | 'completed' | 'error'
  result?: TeacherRunResult
  toolLogs?: TeacherRunResult['toolLogs']
}

type TeacherTraceLog = NonNullable<TeacherRunResult['toolLogs']>[number]
type ActiveTeacherRunUi = {
  runId: string
  messageId: string
}
type TeacherTraceDisplay = {
  title: string
  detail: string
  status: string
}
type EvaluationByMove = Record<number, KataGoMoveAnalysis>
type StatusTone = 'good' | 'warn' | 'neutral'
type TimelineIssueColor = 'B' | 'W'
type BoardPngAssets = {
  boardTexture: HTMLImageElement | null
  blackStone: HTMLImageElement | null
  whiteStone: HTMLImageElement | null
}

const PERSONA_RANK_OPTIONS: Array<{ value: StudentRank; label: string; coachLevel: CoachUserLevel }> = [
  { value: 'sub1d', label: '1段以下', coachLevel: 'beginner' },
  { value: '1d', label: '1段', coachLevel: 'advanced' },
  { value: '2d', label: '2段', coachLevel: 'advanced' },
  { value: '3d', label: '3段', coachLevel: 'dan' },
  { value: '4d', label: '4段', coachLevel: 'dan' },
  { value: '5d', label: '5段', coachLevel: 'dan' },
  { value: '6d', label: '6段', coachLevel: 'dan' },
  { value: '7d', label: '7段', coachLevel: 'dan' },
  { value: '8d', label: '8段', coachLevel: 'dan' },
  { value: '9d', label: '9段', coachLevel: 'dan' }
]

const PERSONA_STYLE_OPTIONS: Array<{ value: TeacherPersonaStyle; label: string }> = [
  { value: 'gentle', label: '温和' },
  { value: 'strict', label: '严格' },
  { value: 'rigorous', label: '职业复盘' },
  { value: 'balanced', label: '标准' },
  { value: 'humorous', label: '风趣' }
]

const TERMINOLOGY_DENSITY_OPTIONS: Array<{ value: TeacherTerminologyDensity; label: string }> = [
  { value: 'low', label: '少' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '多' }
]

const EXPLANATION_PACE_OPTIONS: Array<{ value: TeacherExplanationPace; label: string }> = [
  { value: 'brief', label: '简洁' },
  { value: 'standard', label: '标准' },
  { value: 'detailed', label: '细讲' }
]

const VARIATION_DETAIL_OPTIONS: Array<{ value: TeacherVariationDetail; label: string }> = [
  { value: 'few', label: '少讲' },
  { value: 'moderate', label: '适中' },
  { value: 'many', label: '详细' }
]

function teacherEmptyPrompts(t: UiTranslator): string[] {
  return [
    t('emptyPromptCurrent'),
    t('emptyPromptWhite'),
    t('emptyPromptBlack'),
    t('emptyPromptGoodMoves')
  ]
}

type TeacherPersonaUiSettings = Pick<
  AppSettings,
  | 'defaultCoachLevel'
  | 'defaultStudentRank'
  | 'defaultStudentAge'
  | 'defaultStudentAgeRange'
  | 'teacherStyle'
  | 'teacherTerminologyDensity'
  | 'teacherExplanationPace'
  | 'teacherVariationDetail'
>

interface StatusPill {
  label: string
  tone: StatusTone
}

function readPersonaUiSettings(settings: AppSettings): TeacherPersonaUiSettings {
  return {
    defaultCoachLevel: settings.defaultCoachLevel ?? 'intermediate',
    defaultStudentRank: normalizeUiStudentRank(settings.defaultStudentRank),
    defaultStudentAge: typeof settings.defaultStudentAge === 'number' ? settings.defaultStudentAge : 0,
    defaultStudentAgeRange: settings.defaultStudentAgeRange ?? 'unknown',
    teacherStyle: settings.teacherStyle ?? 'balanced',
    teacherTerminologyDensity: settings.teacherTerminologyDensity ?? 'medium',
    teacherExplanationPace: settings.teacherExplanationPace ?? 'standard',
    teacherVariationDetail: settings.teacherVariationDetail ?? 'moderate'
  }
}

function defaultPersonaUiSettings(): TeacherPersonaUiSettings {
  return {
    defaultCoachLevel: 'intermediate',
    defaultStudentRank: 'sub1d',
    defaultStudentAge: 0,
    defaultStudentAgeRange: 'unknown',
    teacherStyle: 'balanced',
    teacherTerminologyDensity: 'medium',
    teacherExplanationPace: 'standard',
    teacherVariationDetail: 'moderate'
  }
}

function coachLevelFromRank(rank: StudentRank): CoachUserLevel {
  return PERSONA_RANK_OPTIONS.find((option) => option.value === rank)?.coachLevel ?? 'intermediate'
}

function rankLabel(t: UiTranslator, rank: StudentRank): string {
  const keyByRank: Record<StudentRank, Parameters<UiTranslator>[0]> = {
    sub1d: 'rankSub1d',
    '1d': 'rank1d',
    '2d': 'rank2d',
    '3d': 'rank3d',
    '4d': 'rank4d',
    '5d': 'rank5d',
    '6d': 'rank6d',
    '7d': 'rank7d',
    '8d': 'rank8d',
    '9d': 'rank9d'
  }
  return t(keyByRank[rank])
}

function teacherStyleLabel(t: UiTranslator, style: TeacherPersonaStyle): string {
  const keyByStyle: Record<TeacherPersonaStyle, Parameters<UiTranslator>[0]> = {
    gentle: 'styleGentle',
    strict: 'styleStrict',
    rigorous: 'styleRigorous',
    balanced: 'styleBalanced',
    humorous: 'styleHumorous'
  }
  return t(keyByStyle[style])
}

function terminologyDensityLabel(t: UiTranslator, density: TeacherTerminologyDensity): string {
  if (density === 'low') return t('low')
  if (density === 'high') return t('high')
  return t('medium')
}

function explanationPaceLabel(t: UiTranslator, pace: TeacherExplanationPace): string {
  if (pace === 'brief') return t('paceBrief')
  if (pace === 'detailed') return t('paceDetailed')
  return t('paceStandard')
}

function variationDetailLabel(t: UiTranslator, detail: TeacherVariationDetail): string {
  if (detail === 'few') return t('variationFew')
  if (detail === 'many') return t('variationMany')
  return t('variationModerate')
}

function normalizeUiStudentRank(rank: unknown): StudentRank {
  if (rank === '10k' || rank === '1k') {
    return 'sub1d'
  }
  return PERSONA_RANK_OPTIONS.some((option) => option.value === rank) ? rank as StudentRank : 'sub1d'
}

function ageRangeFromExactAge(age: number): StudentAgeRange {
  if (!age || age < 1) return 'unknown'
  if (age <= 12) return 'child'
  if (age <= 18) return 'teen'
  if (age >= 60) return 'senior'
  return 'adult'
}

function formatTeacherSessionTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function teacherSessionContext(session: TeacherSession, t: UiTranslator): string {
  const moveLabel = session.moveRange
    ? t('moveRangeLabel', { start: session.moveRange.start, end: session.moveRange.end })
    : session.moveNumber ? t('moveNumberLabel', { move: session.moveNumber }) : ''
  const evidenceLabel = session.messages.length > 0 ? t('messagesCount', { count: session.messages.length }) : ''
  return [moveLabel, evidenceLabel].filter(Boolean).join(' · ')
}

function teacherSessionPreview(session: TeacherSession): string {
  return session.messages.find((message) => message.content.trim())?.content.trim() || '恢复这个老师会话'
}

function hasVisibleTeacherSessionContent(session: TeacherSession): boolean {
  return session.messages.some((message) =>
    message.content.trim().length > 0 ||
    Boolean(message.result) ||
    (message.toolLogs?.length ?? 0) > 0
  )
}

function isTodayDate(value: string): boolean {
  const date = new Date(value)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function isYesterdayDate(value: string): boolean {
  const date = new Date(value)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate()
}

interface StudentBindingState {
  game: LibraryGame
  suggestions: StudentBindingSuggestion[]
}

interface LiveAnalysisState {
  running: boolean
  status: string
  visits: number
  bestVisits: number
  visitsPerSecond: number
  targetMoveNumber: number | null
  round: number
}

interface TimelineIssueItem {
  moveNumber: number
  color: TimelineIssueColor
  playedMove: string
  bestMove: string
  loss: number
  severity: 'quiet' | 'inaccuracy' | 'mistake' | 'blunder'
}

type DesktopCommand =
  | 'open-command-palette'
  | 'open-settings'
  | 'import-sgf'
  | 'analyze-current'
  | 'analyze-game'
  | 'analyze-recent'
  | 'toggle-library'
  | 'open-ui-gallery'

const letters = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
const LIVE_ANALYSIS_VISIT_STEPS = [24, 48, 80, 120, 180, 260, 380, 560, 820, 1200, 1800, 2600, 3800, 5200]
const LIVE_ANALYSIS_TOTAL_VISIT_LIMIT = 5200
const LIVE_ANALYSIS_BEST_VISIT_LIMIT = 1800
const LIVE_ANALYSIS_TIME_LIMIT_MS = 150_000
const LIVE_ANALYSIS_REPORT_INTERVAL_SECONDS = 0.2
const QUICK_GRAPH_FAST_VISITS = 4
const QUICK_GRAPH_FAST_VISITS_STRONG = 8
const QUICK_GRAPH_REFINE_VISITS = 120
const QUICK_GRAPH_REFINE_TOP_N = 8
const LIBRARY_PAGE_SIZE = 10
const TIMELINE_ISSUE_MIN_LOSS = 1
const ANALYSIS_CACHE_SCHEMA_VERSION = 'v3-sidetomove'
const ANALYSIS_CACHE_PREFIX = `goagent.analysisCache.${ANALYSIS_CACHE_SCHEMA_VERSION}.`
const ANALYSIS_CACHE_INDEX_KEY = `goagent.analysisCache.${ANALYSIS_CACHE_SCHEMA_VERSION}.index`
const ANALYSIS_CACHE_MAX_GAMES = 8
const ANALYSIS_CACHE_COMPLETE_RATIO = 0.9

function safePlayerName(name: string | undefined, fallback: string): string {
  const value = (name ?? '').trim()
  return value || fallback
}

function gameDisplayName(game: LibraryGame): string {
  const black = safePlayerName(game.black, '黑方')
  const white = safePlayerName(game.white, '白方')
  return `${black} vs ${white}`
}

function boardGameTitle(game: LibraryGame): string {
  const black = safePlayerName(game.black, '黑方')
  const white = safePlayerName(game.white, '白方')
  return `黑棋 ${black} vs 白棋 ${white}`
}

function boardCandidateMoves(analysis: KataGoMoveAnalysis | null): KataGoCandidate[] {
  if (!analysis) {
    return []
  }
  return analysis.before.topMoves.length > 0 ? analysis.before.topMoves : analysis.after.topMoves
}

function oppositeStoneColor(color: StoneColor): StoneColor {
  return color === 'B' ? 'W' : 'B'
}

function candidateDisplayColor(analysis: KataGoMoveAnalysis | null): StoneColor {
  if (!analysis?.currentMove) {
    return 'B'
  }
  return analysis.before.topMoves.length > 0 ? analysis.currentMove.color : oppositeStoneColor(analysis.currentMove.color)
}

function displayWinrateForColor(blackWinrate: number, color: StoneColor): number {
  return color === 'B' ? blackWinrate : 100 - blackWinrate
}

function displayScoreLeadForColor(blackScoreLead: number, color: StoneColor): number {
  return color === 'B' ? blackScoreLead : -blackScoreLead
}

function boardDisplayCandidateMoves(analysis: KataGoMoveAnalysis | null): KataGoCandidate[] {
  const color = candidateDisplayColor(analysis)
  return boardCandidateMoves(analysis).map((candidate) => ({
    ...candidate,
    winrate: displayWinrateForColor(candidate.winrate, color),
    scoreLead: displayScoreLeadForColor(candidate.scoreLead, color)
  }))
}

function analysisHasCandidates(analysis: KataGoMoveAnalysis | undefined | null): boolean {
  return Boolean(analysis && (analysis.before.topMoves.length > 0 || analysis.after.topMoves.length > 0))
}

function candidateVisitsTotal(analysis: KataGoMoveAnalysis | null | undefined): number {
  if (!analysis) {
    return 0
  }
  const before = analysis.before.topMoves.reduce((total, candidate) => total + Math.max(0, Number(candidate.visits) || 0), 0)
  const after = analysis.after.topMoves.reduce((total, candidate) => total + Math.max(0, Number(candidate.visits) || 0), 0)
  return Math.max(before, after)
}

function candidateBestVisits(analysis: KataGoMoveAnalysis | null | undefined): number {
  return Math.max(0, Number(analysis?.before.topMoves[0]?.visits ?? analysis?.after.topMoves[0]?.visits) || 0)
}

function normalizeLossPercent(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.abs(value))
}

function quickGraphFastVisits(visitsPerSecond: number): number {
  if (!Number.isFinite(visitsPerSecond) || visitsPerSecond <= 0) {
    return QUICK_GRAPH_FAST_VISITS
  }
  return visitsPerSecond >= 450 ? QUICK_GRAPH_FAST_VISITS_STRONG : QUICK_GRAPH_FAST_VISITS
}

function analysisQuality(analysis: KataGoMoveAnalysis | null | undefined): number {
  if (!analysis) {
    return 0
  }
  const beforeCandidateCount = analysis.before.topMoves.length
  const afterCandidateCount = analysis.after.topMoves.length
  const actualSource = analysis.playedMove?.source
  const actualBonus = actualSource === 'forced' ? 9000 : actualSource === 'candidate' ? 7000 : actualSource === 'after-root' ? 1500 : 0
  return (
    (analysisHasCandidates(analysis) ? 1_000_000 : 0) +
    candidateBestVisits(analysis) * 5 +
    candidateVisitsTotal(analysis) +
    beforeCandidateCount * 60 +
    afterCandidateCount * 20 +
    actualBonus
  )
}

function preferAnalysis(current: KataGoMoveAnalysis | null | undefined, incoming: KataGoMoveAnalysis | null | undefined): KataGoMoveAnalysis | null {
  if (!current) {
    return incoming ?? null
  }
  if (!incoming) {
    return current
  }
  if (current.gameId !== incoming.gameId || current.moveNumber !== incoming.moveNumber) {
    return incoming
  }
  if (!analysisHasCandidates(current) && analysisHasCandidates(incoming)) {
    return incoming
  }
  if (analysisHasCandidates(current) && !analysisHasCandidates(incoming)) {
    return current
  }
  return analysisQuality(incoming) >= analysisQuality(current) ? incoming : current
}

function mergeEvaluations(current: EvaluationByMove, incoming: KataGoMoveAnalysis[]): EvaluationByMove {
  const merged: EvaluationByMove = { ...current }
  for (const item of incoming) {
    merged[item.moveNumber] = preferAnalysis(merged[item.moveNumber], item) ?? item
  }
  return merged
}

type RememberEvaluationOptions = {
  force?: boolean
}

function hasCompleteEvaluationGraph(evaluations: EvaluationByMove, totalMoves: number): boolean {
  if (totalMoves <= 0) {
    return false
  }
  const analyzed = Object.values(evaluations).filter(analysisHasCandidates).length
  return analyzed >= Math.ceil(totalMoves * ANALYSIS_CACHE_COMPLETE_RATIO)
}

function readAnalysisCacheIndex(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ANALYSIS_CACHE_INDEX_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeAnalysisCacheIndex(keys: string[]): void {
  try {
    localStorage.setItem(ANALYSIS_CACHE_INDEX_KEY, JSON.stringify(keys.slice(0, ANALYSIS_CACHE_MAX_GAMES)))
  } catch {
    // Best-effort cache only.
  }
}

function loadStoredEvaluations(cacheKey: string): EvaluationByMove {
  try {
    const raw = localStorage.getItem(`${ANALYSIS_CACHE_PREFIX}${cacheKey}`)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as { evaluations?: unknown }
    const values = Array.isArray(parsed.evaluations)
      ? parsed.evaluations
      : typeof parsed.evaluations === 'object' && parsed.evaluations !== null
        ? Object.values(parsed.evaluations)
        : []
    const restored: EvaluationByMove = {}
    for (const value of values) {
      const item = value as Partial<KataGoMoveAnalysis>
      if (typeof item.moveNumber === 'number' && typeof item.gameId === 'string') {
        restored[item.moveNumber] = item as KataGoMoveAnalysis
      }
    }
    return restored
  } catch {
    return {}
  }
}

function persistStoredEvaluations(cacheKey: string, evaluations: EvaluationByMove): void {
  const entries = Object.values(evaluations)
  if (entries.length === 0) {
    return
  }
  const itemKey = `${ANALYSIS_CACHE_PREFIX}${cacheKey}`
  const payload = JSON.stringify({
    updatedAt: new Date().toISOString(),
    evaluations: entries
  })
  const fullIndex = [cacheKey, ...readAnalysisCacheIndex().filter((item) => item !== cacheKey)]
  const retainedIndex = fullIndex.slice(0, ANALYSIS_CACHE_MAX_GAMES)

  function write(): void {
    localStorage.setItem(itemKey, payload)
    writeAnalysisCacheIndex(retainedIndex)
  }

  try {
    write()
  } catch {
    for (const staleKey of fullIndex.slice(ANALYSIS_CACHE_MAX_GAMES)) {
      localStorage.removeItem(`${ANALYSIS_CACHE_PREFIX}${staleKey}`)
    }
    try {
      write()
    } catch {
      // If the browser quota is still full, keep the in-memory cache only.
    }
  }
}

function removeStoredEvaluations(cacheKey: string): void {
  try {
    localStorage.removeItem(`${ANALYSIS_CACHE_PREFIX}${cacheKey}`)
    writeAnalysisCacheIndex(readAnalysisCacheIndex().filter((item) => item !== cacheKey))
  } catch {
    // Best-effort cache cleanup only.
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function keyMoveSummariesFromEvaluations(evaluations: EvaluationByMove): KeyMoveSummary[] {
  return Object.values(evaluations)
    .flatMap((item) => {
      const severity = evaluationSeverity(item)
      if (severity === 'quiet') {
        return []
      }
      const best = item.before.topMoves[0] ?? item.after.topMoves[0]
      const playedMove = item.playedMove?.move ?? item.currentMove?.gtp
      const loss = item.playedMove?.winrateLoss ?? 0
      const scoreLoss = item.playedMove?.scoreLoss ?? 0
      return [{
        moveNumber: item.moveNumber,
        color: item.currentMove?.color,
        label: best && playedMove ? `${playedMove} -> ${best.move}` : playedMove ?? `第 ${item.moveNumber} 手`,
        gtp: playedMove,
        reason: `胜率损失 ${loss.toFixed(1)}%，目差损失 ${scoreLoss.toFixed(1)}。`,
        winrateDrop: loss / 100,
        scoreLoss,
        severity
      } satisfies KeyMoveSummary]
    })
    .sort((left, right) => {
      const leftLoss = Math.abs(left.winrateDrop ?? 0)
      const rightLoss = Math.abs(right.winrateDrop ?? 0)
      return rightLoss - leftLoss || left.moveNumber - right.moveNumber
    })
    .slice(0, 8)
}

function timelineIssuesFromEvaluations(
  evaluations: EvaluationByMove,
  record: GameRecord | null,
  color: TimelineIssueColor
): TimelineIssueItem[] {
  return Object.values(evaluations)
    .flatMap((item) => {
      const moveColor = item.currentMove?.color ?? record?.moves[item.moveNumber - 1]?.color
      if (moveColor !== color) {
        return []
      }
      const loss = normalizeLossPercent(item.playedMove?.winrateLoss)
      if (loss < TIMELINE_ISSUE_MIN_LOSS) {
        return []
      }
      const playedMove = item.playedMove?.move ?? item.currentMove?.gtp ?? record?.moves[item.moveNumber - 1]?.gtp ?? ''
      const bestMove = item.before.topMoves[0]?.move ?? item.after.topMoves[0]?.move ?? ''
      return [{
        moveNumber: item.moveNumber,
        color: moveColor,
        playedMove,
        bestMove,
        loss,
        severity: evaluationSeverity(item)
      } satisfies TimelineIssueItem]
    })
    .sort((left, right) => right.loss - left.loss || left.moveNumber - right.moveNumber)
}

function keyMoveMarksFromSummaries(
  summaries: KeyMoveSummary[],
  evaluations: EvaluationByMove,
  boardSize: number
): RenderKeyMove[] {
  return summaries.flatMap((summary) => {
    const item = evaluations[summary.moveNumber]
    const point = parseBoardPoint(item?.currentMove ?? item?.playedMove?.move ?? summary.gtp, boardSize)
    if (!point) {
      return []
    }
    const severity = !summary.severity || summary.severity === 'quiet' ? 'turning-point' : summary.severity
    return [{
      ...point,
      moveNumber: summary.moveNumber,
      severity,
      label: String(summary.moveNumber)
    } satisfies RenderKeyMove]
  })
}

function shouldOpenUiGallery(): boolean {
  const search = new URLSearchParams(window.location.search)
  return search.has('ui-gallery') || window.location.hash === '#/ui-gallery'
}

export function App(): ReactElement {
  if (shouldOpenUiGallery()) {
    return <UiGallery />
  }

  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard)
  const [selectedId, setSelectedId] = useState('')
  const [record, setRecord] = useState<GameRecord | null>(null)
  const [moveNumber, setMoveNumber] = useState(0)
  const [analysis, setAnalysis] = useState<KataGoMoveAnalysis | null>(null)
  const [evaluations, setEvaluations] = useState<EvaluationByMove>({})
  const [timelineIssueColor, setTimelineIssueColor] = useState<TimelineIssueColor>('B')
  const [foxKeyword, setFoxKeyword] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [moveRange, setMoveRange] = useState<{ start: number; end: number } | null>(null)
  const [boardFlash, setBoardFlash] = useState<(BoardPoint & { nonce: number; label: string }) | null>(null)
  const [busy, setBusy] = useState('')
  const [graphBusy, setGraphBusy] = useState(false)
  const [graphProgress, setGraphProgress] = useState('')
  const [liveAnalysis, setLiveAnalysis] = useState<LiveAnalysisState>({
    running: false,
    status: '已暂停',
    visits: 0,
    bestVisits: 0,
    visitsPerSecond: 0,
    targetMoveNumber: null,
    round: 0
  })
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [libraryCollapsed, setLibraryCollapsed] = useState(false)
  const [llmTestMessage, setLlmTestMessage] = useState('')
  const [katagoBenchmark, setKataGoBenchmark] = useState<KataGoBenchmarkResult | null>(null)
  const [katagoBenchmarkMessage, setKataGoBenchmarkMessage] = useState('')
  const [katagoInstallMessage, setKataGoInstallMessage] = useState('')
  const [katagoInstallProgress, setKataGoInstallProgress] = useState<KataGoAssetInstallProgress | null>(null)
  const [currentStudent, setCurrentStudent] = useState<StudentProfile | null>(null)
  const [studentBinding, setStudentBinding] = useState<StudentBindingState | null>(null)
  const [katagoAssets, setKatagoAssets] = useState<KataGoAssetStatus | null>(null)
  const graphRunId = useRef('')
  const liveAnalysisRunId = useRef('')
  const autoAnalysisRequestId = useRef('')
  const userPausedLiveAnalysisRef = useRef(false)
  const moveNumberRef = useRef(moveNumber)
  const recordRef = useRef<GameRecord | null>(record)
  const jumpToMoveRef = useRef<(next: number) => void>(() => {})
  const teacherBusyRef = useRef(false)
  const activeTeacherRunRef = useRef<ActiveTeacherRunUi | null>(null)
  const selectedGameIdRef = useRef('')
  const selectedEvaluationCacheKeyRef = useRef('')

  useEffect(() => {
    document.title = BRAND_DISPLAY_NAME
  }, [])
  const evaluationCacheRef = useRef<Record<string, EvaluationByMove>>({})
  const evaluationPersistTimersRef = useRef<Record<string, number>>({})
  const boardFlashNonceRef = useRef(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [teacherSessionId, setTeacherSessionId] = useState('')
  const [teacherSessions, setTeacherSessions] = useState<TeacherSession[]>([])
  const t = useMemo(() => createUiTranslator(dashboard.settings.reviewLanguage), [dashboard.settings.reviewLanguage])
  const uiError = (cause: unknown, context?: string): string => humanizeUiError(cause, dashboard.settings.reviewLanguage, context)

  async function cancelKataGoWork(payload: Parameters<typeof window.goagent.cancelKataGoAnalysis>[0]): Promise<void> {
    await window.goagent.cancelKataGoAnalysis(payload).catch(() => undefined)
  }

  function analysisCacheKeyForGame(gameId: string): string {
    const modelKey =
      dashboard.settings.katagoModelPreset ||
      dashboard.systemProfile.katagoModelPreset ||
      dashboard.settings.katagoModel ||
      dashboard.systemProfile.katagoModel ||
      'default-model'
    return `${gameId}::${modelKey}`
  }

  function schedulePersistEvaluations(cacheKey: string): void {
    const existingTimer = evaluationPersistTimersRef.current[cacheKey]
    if (existingTimer) {
      window.clearTimeout(existingTimer)
    }
    evaluationPersistTimersRef.current[cacheKey] = window.setTimeout(() => {
      delete evaluationPersistTimersRef.current[cacheKey]
      persistStoredEvaluations(cacheKey, evaluationCacheRef.current[cacheKey] ?? {})
    }, 450)
  }

  function cachedEvaluationsForGame(gameId: string): EvaluationByMove {
    const cacheKey = analysisCacheKeyForGame(gameId)
    if (!evaluationCacheRef.current[cacheKey]) {
      evaluationCacheRef.current[cacheKey] = loadStoredEvaluations(cacheKey)
    }
    return evaluationCacheRef.current[cacheKey]
  }

  function cachedAnalysisForGameMove(gameId: string, targetMove: number): KataGoMoveAnalysis | null {
    return cachedEvaluationsForGame(gameId)[targetMove] ?? null
  }

  function commitEvaluations(cacheKey: string, next: EvaluationByMove): void {
    evaluationCacheRef.current[cacheKey] = next
    schedulePersistEvaluations(cacheKey)
    if (selectedEvaluationCacheKeyRef.current === cacheKey) {
      setEvaluations(next)
    }
  }

  useEffect(() => {
    void refresh()
    void refreshKataGoAssets()
  }, [])

  useEffect(() => {
    return window.goagent.onKataGoAssetInstallProgress((progress) => {
      setKataGoInstallProgress(progress)
      setKataGoInstallMessage(progress.message)
    })
  }, [])

  useEffect(() => {
    return () => {
      for (const timer of Object.values(evaluationPersistTimersRef.current)) {
        window.clearTimeout(timer)
      }
      for (const [cacheKey, cached] of Object.entries(evaluationCacheRef.current)) {
        persistStoredEvaluations(cacheKey, cached)
      }
    }
  }, [])

  const selectedGame = useMemo(
    () => {
      const exact = dashboard.games.find((game) => game.id === selectedId)
      if (exact) {
        return exact
      }
      if (!selectedId) {
        return dashboard.games.find((game) => game.source !== 'fox' || game.downloadStatus === 'downloaded')
      }
      return dashboard.games[0]
    },
    [dashboard.games, selectedId]
  )

  function storedTeacherMessages(): TeacherChatMessage[] {
    const timestamp = new Date().toISOString()
    return messages.map((message) => ({ ...message, createdAt: timestamp }))
  }

  function restoreTeacherSessionMessages(session: TeacherSession): void {
    setMessages(session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      status: message.status,
      result: message.result,
      toolLogs: message.toolLogs
    })))
  }

  async function refreshTeacherSessions(): Promise<void> {
    const sessions = await window.goagent.listTeacherSessions().catch(() => [])
    setTeacherSessions(sessions)
  }

  async function persistCurrentTeacherSession(): Promise<void> {
    if (!teacherSessionId || messages.length === 0) return
    await window.goagent.updateTeacherSessionMessages({ sessionId: teacherSessionId, messages: storedTeacherMessages() }).catch(() => undefined)
    await refreshTeacherSessions()
  }

  async function startNewTeacherSession(): Promise<void> {
    await persistCurrentTeacherSession()
    const session = await window.goagent.createTeacherSession({ gameId: selectedGame?.id, moveNumber, moveRange: moveRange ?? undefined })
    setTeacherSessionId(session.id)
    setMessages([])
    setPrompt('')
    await refreshTeacherSessions()
  }

  async function closeCurrentTeacherSession(): Promise<void> {
    await persistCurrentTeacherSession()
    if (teacherSessionId) await window.goagent.archiveTeacherSession(teacherSessionId).catch(() => undefined)
    const session = await window.goagent.createTeacherSession({ gameId: selectedGame?.id, moveNumber })
    setTeacherSessionId(session.id)
    setMessages([])
    setPrompt('')
    await refreshTeacherSessions()
  }

  async function restoreTeacherSession(session: TeacherSession): Promise<void> {
    await persistCurrentTeacherSession()
    setTeacherSessionId(session.id)
    restoreTeacherSessionMessages(session)
    await refreshTeacherSessions()
  }

  async function restoreTeacherSessionById(sessionId: string): Promise<void> {
    const sessions = teacherSessions.length ? teacherSessions : await window.goagent.listTeacherSessions().catch(() => [])
    const session = sessions.find((candidate) => candidate.id === sessionId)
    if (!session) return
    await restoreTeacherSession(session)
  }

  async function deleteTeacherSessionById(sessionId: string): Promise<void> {
    if (busy !== '') return
    const sessions = teacherSessions.length ? teacherSessions : await window.goagent.listTeacherSessions().catch(() => [])
    const session = sessions.find((candidate) => candidate.id === sessionId)
    const title = session?.title?.trim() || '这条历史会话'
    if (!window.confirm(`删除「${title}」？删除后无法恢复。`)) return
    await persistCurrentTeacherSession()
    const deleted = await window.goagent.deleteTeacherSession(sessionId).catch((cause) => {
      setError(`删除历史会话失败：${String(cause)}`)
      return false
    })
    if (!deleted) return
    if (sessionId === teacherSessionId) {
      const activeSession = await window.goagent.getActiveTeacherSession()
      setTeacherSessionId(activeSession.id)
      restoreTeacherSessionMessages(activeSession)
    }
    await refreshTeacherSessions()
  }

  async function restoreTeacherSessionFromHistory(): Promise<void> {
    const sessions = teacherSessions.length ? teacherSessions : await window.goagent.listTeacherSessions().catch(() => [])
    if (sessions.length === 0) return
    const menu = sessions.slice(0, 12).map((session, index) => `${index + 1}. ${session.title} · ${new Date(session.updatedAt).toLocaleString()}`).join('\n')
    const picked = window.prompt(`选择要恢复的老师会话：\n${menu}`)
    const index = picked ? Number(picked) - 1 : -1
    const session = sessions[index]
    if (!session) return
    await restoreTeacherSession(session)
  }

  useEffect(() => {
    void window.goagent.getActiveTeacherSession().then((session) => {
      setTeacherSessionId(session.id)
      restoreTeacherSessionMessages(session)
    }).catch(() => undefined)
    void refreshTeacherSessions()
  }, [])

  useEffect(() => {
    const handler = (event: Event): void => {
      const action = (event as CustomEvent<'new' | 'close' | 'history'>).detail
      if (action === 'new') void startNewTeacherSession()
      else if (action === 'close') void closeCurrentTeacherSession()
      else if (action === 'history') void restoreTeacherSessionFromHistory()
    }
    window.addEventListener('goagent:teacher-session-action', handler)
    return () => window.removeEventListener('goagent:teacher-session-action', handler)
  }, [messages, teacherSessionId, selectedGame?.id, moveNumber, moveRange, teacherSessions])

  useEffect(() => {
    if (!teacherSessionId || messages.length === 0) return
    const timer = window.setTimeout(() => {
      void window.goagent.updateTeacherSessionMessages({ sessionId: teacherSessionId, messages: storedTeacherMessages() })
        .then(() => refreshTeacherSessions())
        .catch(() => undefined)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [messages, teacherSessionId])

  const keyMoveSummaries = useMemo(() => keyMoveSummariesFromEvaluations(evaluations), [evaluations])
  const timelineIssues = useMemo(
    () => timelineIssuesFromEvaluations(evaluations, record, timelineIssueColor),
    [evaluations, record, timelineIssueColor]
  )
  const boardKeyMoveMarks = useMemo(
    () => keyMoveMarksFromSummaries(keyMoveSummaries, evaluations, record?.boardSize ?? 19),
    [keyMoveSummaries, evaluations, record?.boardSize]
  )
  const currentBoardKeyMoveMarks = useMemo(
    () => boardKeyMoveMarks.filter((mark) => mark.moveNumber === moveNumber),
    [boardKeyMoveMarks, moveNumber]
  )
  const currentAnalysis = useMemo(() => {
    const cached = evaluations[moveNumber] ?? null
    const active = analysis?.moveNumber === moveNumber ? analysis : null
    return preferAnalysis(cached, active)
  }, [analysis, evaluations, moveNumber])

  useEffect(() => {
    if (selectedGame && !selectedId) {
      setSelectedId(selectedGame.id)
    }
  }, [selectedGame, selectedId])

  useEffect(() => {
    moveNumberRef.current = moveNumber
    recordRef.current = record
  }, [moveNumber, record])

  useEffect(() => {
    jumpToMoveRef.current = jumpToMove
    teacherBusyRef.current = busy === 'teacher'
  })

  useEffect(() => {
    selectedGameIdRef.current = selectedGame?.id ?? ''
    selectedEvaluationCacheKeyRef.current = selectedGame ? analysisCacheKeyForGame(selectedGame.id) : ''
  }, [selectedGame?.id, dashboard.settings.katagoModelPreset, dashboard.settings.katagoModel])

  useEffect(() => {
    if (!selectedGame) {
      setRecord(null)
      setCurrentStudent(null)
      return
    }
    pauseLiveAnalysis('切换棋谱，准备精读')
    void loadBoundPlayer(selectedGame.id)
    void loadRecord(selectedGame.id)
  }, [selectedGame?.id])

  useEffect(() => {
    const dispose = window.goagent.onDesktopCommand?.((command) => runDesktopCommand(command))
    return () => dispose?.()
  }, [selectedGame?.id, moveNumber, busy, record, dashboard.games.length])

  const arrowDebounceRef = useRef(0)
  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      const key = event.key.toLowerCase()
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
      }
      if (event.key === 'Escape') {
        setCommandPaletteOpen(false)
        setSettingsOpen(false)
      }
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }
      const target = event.target instanceof HTMLElement ? event.target : null
      if (
        target &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, button, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"]'))
      ) {
        return
      }
      const rec = recordRef.current
      if (!rec || teacherBusyRef.current) return
      let nextMove = -1
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        nextMove = Math.max(0, moveNumberRef.current - 1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        nextMove = Math.min(rec.moves.length, moveNumberRef.current + 1)
      } else if (event.key === 'Home') {
        event.preventDefault()
        nextMove = 0
      } else if (event.key === 'End') {
        event.preventDefault()
        nextMove = rec.moves.length
      }
      if (nextMove < 0) return
      setMoveNumber(nextMove)
      moveNumberRef.current = nextMove
      clearTimeout(arrowDebounceRef.current)
      arrowDebounceRef.current = window.setTimeout(() => {
        jumpToMoveRef.current(nextMove)
      }, 150)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(arrowDebounceRef.current)
    }
  }, [])

  async function refresh(): Promise<void> {
    try {
      const next = await window.goagent.getDashboard()
      setDashboard(next)
      if (!playerName && next.settings.defaultPlayerName) {
        setPlayerName(next.settings.defaultPlayerName)
      }
    } catch (cause) {
      setError(`初始化失败: ${String(cause)}`)
    }
  }

  async function refreshKataGoAssets(): Promise<void> {
    try {
      setKatagoAssets(await window.goagent.inspectKataGoAssets())
    } catch (cause) {
      setError(`KataGo 资源检查失败: ${String(cause)}`)
    }
  }

  async function loadRecord(gameId: string): Promise<void> {
    try {
      void cancelKataGoWork({ group: 'quick' })
      const next = await window.goagent.getGameRecord(gameId)
      setDashboard((current) => ({
        ...current,
        games: current.games.map((game) => (game.id === next.game.id ? next.game : game))
      }))
      const cacheKey = analysisCacheKeyForGame(gameId)
      selectedEvaluationCacheKeyRef.current = cacheKey
      const cachedEvaluations = cachedEvaluationsForGame(gameId)
      const cachedCurrent = cachedEvaluations[next.moves.length] ?? null
      userPausedLiveAnalysisRef.current = false
      setRecord(next)
      setMoveNumber(next.moves.length)
      setAnalysis(cachedCurrent)
      setEvaluations(cachedEvaluations)
      setMoveRange(null)
      if (hasCompleteEvaluationGraph(cachedEvaluations, next.moves.length)) {
        setGraphBusy(false)
        setGraphProgress('')
        setLiveAnalysis((current) => ({
          ...current,
          running: false,
          status: '已载入胜率缓存',
          visits: candidateVisitsTotal(cachedCurrent),
          bestVisits: candidateBestVisits(cachedCurrent),
          targetMoveNumber: next.moves.length
        }))
      } else {
        void warmupEvaluationGraph(gameId, next.moves.length)
      }
      queueAutoLiveAnalysis(gameId, next, next.moves.length, 120)
    } catch (cause) {
      setError(String(cause))
    }
  }

  async function loadBoundPlayer(gameId: string): Promise<void> {
    try {
      const student = await window.goagent.getStudentForGame(gameId)
      if (selectedGameIdRef.current === gameId) {
        setCurrentStudent(student)
      }
    } catch (cause) {
      if (selectedGameIdRef.current === gameId) {
        setCurrentStudent(null)
      }
      setError(`棋手绑定读取失败: ${String(cause)}`)
    }
  }

  async function warmupEvaluationGraph(gameId: string, defaultMoveNumber: number): Promise<void> {
    const runId = crypto.randomUUID()
    const cacheKey = analysisCacheKeyForGame(gameId)
    graphRunId.current = runId
    setGraphBusy(true)
    setGraphProgress('启动快速胜率图')
    const disposeProgress = window.goagent.onAnalyzeGameQuickProgress((progress: AnalyzeGameQuickProgress) => {
      if (graphRunId.current !== runId || progress.runId !== runId || progress.gameId !== gameId) {
        return
      }
      const done = Math.min(progress.analyzedPositions, progress.totalPositions)
      setGraphProgress(`${done}/${progress.totalPositions} 局面`)
      rememberEvaluation(progress.evaluation)
      if (progress.evaluation.moveNumber === defaultMoveNumber) {
        setAnalysis((current) => preferAnalysis(current, progress.evaluation))
      }
    })
    try {
      await cancelKataGoWork({ group: 'quick' })
      const fastVisits = quickGraphFastVisits(dashboard.settings.katagoBenchmarkVisitsPerSecond)
      const quickEvaluations = await window.goagent.analyzeGameQuick({
        gameId,
        maxVisits: fastVisits,
        refineVisits: Math.max(QUICK_GRAPH_REFINE_VISITS, fastVisits * 3),
        refineTopN: QUICK_GRAPH_REFINE_TOP_N,
        runId
      })
      if (graphRunId.current !== runId) {
        return
      }
      const nextMap = Object.fromEntries(quickEvaluations.map((item) => [item.moveNumber, item]))
      const base = evaluationCacheRef.current[cacheKey] ?? cachedEvaluationsForGame(gameId)
      const merged = mergeEvaluations(base, quickEvaluations)
      commitEvaluations(cacheKey, merged)
      const preferred = nextMap[defaultMoveNumber] ?? merged[defaultMoveNumber] ?? quickEvaluations[quickEvaluations.length - 1] ?? null
      setAnalysis((current) => preferAnalysis(current, preferred))
    } catch (cause) {
      if (graphRunId.current === runId) {
        setError(t('graphFailed', { error: String(cause) }))
      }
    } finally {
      disposeProgress()
      if (graphRunId.current === runId) {
        setGraphBusy(false)
        setGraphProgress('')
      }
    }
  }

  async function importSgf(): Promise<void> {
    setBusy('import')
    setError('')
    try {
      const { dashboard: next, imported } = await window.goagent.importLibrary()
      setDashboard(next)
      if (imported[0]) {
        setSelectedId(imported[0].id)
        void openStudentBinding(imported[0])
      } else if (next.games[0]) {
        setSelectedId(next.games[0].id)
      }
    } catch (cause) {
      setError(String(cause))
    } finally {
      setBusy('')
    }
  }

  async function deleteLibraryGameFromLibrary(game: LibraryGame): Promise<void> {
    if (busy !== '') {
      return
    }
    const label = gameDisplayName(game)
    const confirmed = window.confirm(t('deleteGameConfirm', { label }))
    if (!confirmed) {
      return
    }

    const deletingSelected = selectedGame?.id === game.id || selectedId === game.id
    const cacheKey = analysisCacheKeyForGame(game.id)
    setBusy('delete-game')
    setError('')
    try {
      const pendingTimer = evaluationPersistTimersRef.current[cacheKey]
      if (pendingTimer) {
        window.clearTimeout(pendingTimer)
        delete evaluationPersistTimersRef.current[cacheKey]
      }
      removeStoredEvaluations(cacheKey)
      delete evaluationCacheRef.current[cacheKey]

      if (deletingSelected) {
        pauseLiveAnalysis(t('gameDeletedPaused'), true)
        graphRunId.current = crypto.randomUUID()
        setGraphBusy(false)
        setGraphProgress('')
      }

      const { dashboard: next } = await window.goagent.deleteLibraryGame({ gameId: game.id })
      setDashboard(next)
      if (deletingSelected) {
        const nextGame = next.games.find((candidate) => candidate.source !== 'fox' || candidate.downloadStatus === 'downloaded') ?? next.games[0]
        setSelectedId(nextGame?.id ?? '')
        setRecord(null)
        setMoveNumber(0)
        setAnalysis(null)
        setEvaluations({})
        setMoveRange(null)
        setCurrentStudent(null)
        if (!nextGame) {
          setPlayerName('')
        }
      }
    } catch (cause) {
      setError(`${t('deleteGameFailed')}：${uiError(cause, 'library-delete')}`)
    } finally {
      setBusy('')
    }
  }

  async function syncFox(): Promise<void> {
    setBusy('fox')
    setError('')
    try {
      const { dashboard: next, result, student } = await window.goagent.syncFox({
        keyword: foxKeyword
      })
      setDashboard(next)
      setCurrentStudent(student ?? null)
      setFoxKeyword(result.nickname)
      if (selectedId && !next.games.some((game) => game.id === selectedId)) {
        setSelectedId('')
      }
    } catch (cause) {
      setError(String(cause))
    } finally {
      setBusy('')
    }
  }

  async function openStudentBinding(game: LibraryGame): Promise<void> {
    try {
      const suggestions = await window.goagent.suggestStudentBindings({
        blackName: game.black,
        whiteName: game.white,
        source: game.source,
        foxNickname: game.source === 'fox' ? (foxKeyword || game.sourceLabel.replace(/^Fox\s*/i, '')) : undefined
      })
      setStudentBinding({ game, suggestions })
    } catch (cause) {
      setError(`${t('playerBindingSuggestionFailed')}: ${String(cause)}`)
    }
  }

  async function bindImportedGameToExisting(input: { studentId: string; aliasFromPlayerName?: string }): Promise<void> {
    if (!studentBinding) {
      return
    }
    try {
      const student = await window.goagent.bindSgfGameToStudent({
        gameId: studentBinding.game.id,
        studentId: input.studentId,
        aliasFromPlayerName: input.aliasFromPlayerName
      })
      setCurrentStudent(student)
      setStudentBinding(null)
    } catch (cause) {
      setError(`${t('bindPlayerFailed')}: ${String(cause)}`)
    }
  }

  async function createStudentAndBind(input: { displayName: string; foxNickname?: string; aliasFromPlayerName?: string }): Promise<void> {
    if (!studentBinding) {
      return
    }
    try {
      const student = input.foxNickname
        ? await window.goagent.bindFoxGamesToStudent({
            foxNickname: input.foxNickname,
            gameIds: [studentBinding.game.id],
            aliases: [input.displayName, input.aliasFromPlayerName ?? ''].filter(Boolean)
          })
        : await window.goagent.bindSgfGameToStudent({
            gameId: studentBinding.game.id,
            createDisplayName: input.displayName,
            aliasFromPlayerName: input.aliasFromPlayerName
          })
      setCurrentStudent(student)
      setStudentBinding(null)
    } catch (cause) {
      setError(`${t('createPlayerProfileFailed')}: ${String(cause)}`)
    }
  }

  async function saveSettings(form: HTMLFormElement): Promise<void> {
    setBusy('settings')
    setError('')
    try {
      const formData = new FormData(form)
      const next = await window.goagent.updateSettings({
        katagoModelPreset: String(formData.get('katagoModelPreset') ?? dashboard.settings.katagoModelPreset) as KataGoModelPresetId,
        reviewLanguage: normalizeUiLocale(String(formData.get('reviewLanguage') ?? dashboard.settings.reviewLanguage)),
        llmBaseUrl: String(formData.get('llmBaseUrl') ?? ''),
        llmApiKey: String(formData.get('llmApiKey') ?? ''),
        llmModel: String(formData.get('llmModel') ?? '')
      })
      setDashboard(next)
      setLlmTestMessage(t('settingsSaved'))
      void refreshKataGoAssets()
      if (selectedGame && record) {
        setAnalysis(null)
        setEvaluations({})
        void warmupEvaluationGraph(selectedGame.id, moveNumber)
      }
    } catch (cause) {
      setError(uiError(cause, 'settings'))
    } finally {
      setBusy('')
    }
  }

  async function testLlmSettings(form: HTMLFormElement): Promise<void> {
    setBusy('llm-test')
    setLlmTestMessage('')
    try {
      const formData = new FormData(form)
      const result = await window.goagent.testLlmSettings({
        llmBaseUrl: String(formData.get('llmBaseUrl') ?? ''),
        llmApiKey: String(formData.get('llmApiKey') ?? ''),
        llmModel: String(formData.get('llmModel') ?? '')
      })
      setLlmTestMessage(result.message)
    } catch (cause) {
      setLlmTestMessage(uiError(cause, 'llm-test'))
    } finally {
      setBusy('')
    }
  }

  async function runKataGoBenchmark(): Promise<void> {
    setBusy('katago-benchmark')
    setKataGoBenchmarkMessage(t('benchmarkStarting'))
    setError('')
    try {
      if (typeof window.goagent.benchmarkKataGo !== 'function') {
        throw new Error('测速服务尚未加载，请重启应用后再试。')
      }
      const result = await window.goagent.benchmarkKataGo()
      setKataGoBenchmark(result)
      setKataGoBenchmarkMessage(`已优化：推荐 ${result.recommendedThreads} 线程，${formatSearchSpeed(result.visitsPerSecond)}。`)
      setDashboard(await window.goagent.getDashboard())
      void refreshKataGoAssets()
      if (selectedGame && record) {
        pauseLiveAnalysis('测速完成，准备使用新配置')
        setAnalysis(null)
        setEvaluations({})
        void warmupEvaluationGraph(selectedGame.id, moveNumber)
        if (!userPausedLiveAnalysisRef.current) {
          void startLiveAnalysis()
        }
      }
    } catch (cause) {
      setKataGoBenchmarkMessage(uiError(cause, 'katago-benchmark'))
    } finally {
      setBusy('')
    }
  }

  async function installOfficialKataGoModel(presetId: KataGoModelPresetId): Promise<void> {
    setBusy('katago-install')
    setError('')
    setKataGoInstallProgress({ stage: 'discovering', message: t('katagoInstallPreparing') })
    setKataGoInstallMessage(t('katagoInstallPreparing'))
    try {
      const result = await window.goagent.installKataGoOfficialModel({ presetId })
      setKataGoInstallMessage(result.detail)
      const next = await window.goagent.updateSettings({ katagoModelPreset: presetId })
      setDashboard(next)
      await refreshKataGoAssets()
      if (selectedGame && record) {
        pauseLiveAnalysis('KataGo 权重已更新，准备重新分析')
        setAnalysis(null)
        setEvaluations({})
        void warmupEvaluationGraph(selectedGame.id, moveNumber)
        if (!userPausedLiveAnalysisRef.current) {
          void startLiveAnalysis()
        }
      }
    } catch (cause) {
      const message = uiError(cause, 'katago-install')
      setKataGoInstallMessage(message)
      setKataGoInstallProgress({ stage: 'error', message })
    } finally {
      setBusy('')
    }
  }

  function appendMessage(message: Omit<ChatMessage, 'id'>): string {
    const id = crypto.randomUUID()
    setMessages((current) => [...current, { ...message, id }])
    return id
  }

  function updateMessage(messageId: string, updater: (message: ChatMessage) => ChatMessage): void {
    setMessages((current) => current.map((message) => (message.id === messageId ? updater(message) : message)))
  }

  function mergeTeacherProgress(messageId: string, progress: TeacherRunProgress): void {
    updateMessage(messageId, (message) => {
      if (message.role !== 'teacher') {
        return message
      }
      if (progress.stage === 'assistant-delta') {
        return {
          ...message,
          status: 'running',
          content: `${message.content}${progress.markdownDelta ?? ''}`
        }
      }
      if (progress.stage === 'done' && progress.result) {
        return {
          ...message,
          status: 'completed',
          content: progress.result.markdown,
          result: progress.result,
          toolLogs: progress.result.toolLogs
        }
      }
      if (progress.stage === 'error') {
        return {
          ...message,
          status: 'error',
          content: message.content || `${t('taskFailed')}：${humanizeUiError(progress.error ?? t('unknownError'), dashboard.settings.reviewLanguage, 'teacher-task')}`,
          toolLogs: progress.toolLogs ?? message.toolLogs
        }
      }
      return {
        ...message,
        status: message.status ?? 'running',
        toolLogs: progress.toolLogs ?? message.toolLogs
      }
    })
  }

  function isActiveTeacherRun(runId: string): boolean {
    return activeTeacherRunRef.current?.runId === runId
  }

  function markTeacherRunStopped(active: ActiveTeacherRunUi): void {
    updateMessage(active.messageId, (message) => {
      if (message.role !== 'teacher') return message
      const content = message.content.trim()
      return {
        ...message,
        status: 'completed',
        content: content ? `${content}\n\n（已停止本次分析）` : '已停止本次分析。',
        toolLogs: message.toolLogs
      }
    })
  }

  async function stopTeacherTask(): Promise<void> {
    const active = activeTeacherRunRef.current
    if (!active) {
      return
    }
    activeTeacherRunRef.current = null
    setBusy('')
    setError('')
    markTeacherRunStopped(active)
    await Promise.all([
      window.goagent.cancelTeacherRun({ runId: active.runId }).catch(() => undefined),
      cancelKataGoWork({ runId: active.runId, group: 'teacher' }).catch(() => undefined)
    ])
  }

  async function runTeacherTaskWithStream(
    request: Omit<TeacherRunRequest, 'runId'>,
    assistantMessageId: string,
    existingRunId?: string
  ): Promise<TeacherRunResult> {
    const runId = existingRunId ?? crypto.randomUUID()
    activeTeacherRunRef.current = { runId, messageId: assistantMessageId }
    const dispose = window.goagent.onTeacherRunProgress((progress) => {
      if (progress.runId === runId && isActiveTeacherRun(runId)) {
        mergeTeacherProgress(assistantMessageId, progress)
      }
    })
    try {
      const result = await window.goagent.runTeacherTask({
        ...request,
        teacherSessionId: teacherSessionId || undefined,
        runId
      })
      if (!isActiveTeacherRun(runId)) {
        throw new Error('老师任务已停止')
      }
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        status: 'completed',
        content: result.markdown,
        result,
        toolLogs: result.toolLogs
      }))
      return result
    } catch (cause) {
      if (!isActiveTeacherRun(runId) || /老师任务已停止|KataGo 分析已取消|AbortError|已取消/i.test(String(cause))) {
        throw new Error('老师任务已停止')
      }
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        status: 'error',
        content: message.content || `${t('taskFailed')}：${uiError(cause, 'teacher-task')}`
      }))
      throw cause
    } finally {
      dispose()
      if (isActiveTeacherRun(runId)) {
        activeTeacherRunRef.current = null
      }
    }
  }

  function rememberEvaluation(nextAnalysis: KataGoMoveAnalysis, options: RememberEvaluationOptions = {}): void {
    const cacheKey = analysisCacheKeyForGame(nextAnalysis.gameId)
    setEvaluations((current) => {
      const isCurrentGame = selectedEvaluationCacheKeyRef.current === cacheKey
      const base = isCurrentGame ? current : (evaluationCacheRef.current[cacheKey] ?? loadStoredEvaluations(cacheKey))
      const preferred = options.force ? nextAnalysis : (preferAnalysis(base[nextAnalysis.moveNumber], nextAnalysis) ?? nextAnalysis)
      if (base[nextAnalysis.moveNumber] === preferred) {
        evaluationCacheRef.current[cacheKey] = base
        return current
      }
      const merged = {
        ...base,
        [nextAnalysis.moveNumber]: preferred
      }
      evaluationCacheRef.current[cacheKey] = merged
      schedulePersistEvaluations(cacheKey)
      return isCurrentGame ? merged : current
    })
  }

  function analysisForMove(targetMove: number): KataGoMoveAnalysis | null {
    const cached = evaluations[targetMove] ?? null
    const active = analysis?.moveNumber === targetMove ? analysis : null
    return preferAnalysis(cached, active)
  }

  function queueAutoLiveAnalysis(gameId: string, targetRecord: GameRecord, targetMove: number, delay = 80): void {
    if (userPausedLiveAnalysisRef.current) {
      return
    }
    const requestId = crypto.randomUUID()
    autoAnalysisRequestId.current = requestId
    window.setTimeout(() => {
      if (
        autoAnalysisRequestId.current !== requestId ||
        selectedGameIdRef.current !== gameId ||
        userPausedLiveAnalysisRef.current
      ) {
        return
      }
      void startLiveAnalysis({
        gameId,
        record: targetRecord,
        moveNumber: targetMove,
        manual: false
      })
    }, delay)
  }

  function jumpToMove(next: number): void {
    const targetMove = record ? Math.max(0, Math.min(record.moves.length, Math.round(next))) : next
    if (liveAnalysis.running) {
      pauseLiveAnalysis('切换手数，准备继续分析')
    }
    setMoveNumber(targetMove)
    setAnalysis(analysisForMove(targetMove))
    if (record && selectedGame && !userPausedLiveAnalysisRef.current) {
      queueAutoLiveAnalysis(selectedGame.id, record, targetMove)
    }
  }

  function flashBoardCoordinate(label: string): void {
    if (!record) {
      return
    }
    const point = parseBoardPoint(label, record.boardSize)
    if (!point) {
      return
    }
    boardFlashNonceRef.current += 1
    setBoardFlash({
      ...point,
      label: boardPointLabel(point, record.boardSize),
      nonce: boardFlashNonceRef.current
    })
  }

  function handleTimelineRangeSelect(start: number, end: number): void {
    const validation = validateMoveRange(start, end, record?.moves.length, MOVE_RANGE_MAX_MOVES)
    if (!validation.ok || !validation.range) {
      setPrompt(`区间过长或无效：${validation.reason ?? '请重新选择更短的手数区间'}`)
      setMoveRange(null)
      return
    }
    setMoveRange(validation.range)
    setPrompt(`分析${describeMoveRange(validation.range)}`)
    jumpToMove(validation.range.start)
  }

  function handleTimelineRangeClear(): void {
    setMoveRange(null)
  }

  function buildMoveRangeSummary(rangeAnalyses: KataGoMoveAnalysis[], rangeStart: number, rangeEnd: number, maxCount = 6): MoveRangeReviewSummary {
    const sorted = [...rangeAnalyses].sort((a, b) => a.moveNumber - b.moveNumber)
    const byLoss = [...sorted]
      .filter((item) => item.playedMove)
      .sort((left, right) =>
        (right.playedMove?.winrateLoss ?? 0) - (left.playedMove?.winrateLoss ?? 0) ||
        (right.playedMove?.scoreLoss ?? 0) - (left.playedMove?.scoreLoss ?? 0) ||
        left.moveNumber - right.moveNumber
      )
    const keyNumbers = new Set<number>([rangeStart, rangeEnd])
    for (const item of byLoss.slice(0, Math.max(0, maxCount - 2))) {
      keyNumbers.add(item.moveNumber)
    }
    const keyMoves = Array.from(keyNumbers)
      .sort((a, b) => a - b)
      .map((moveNo) => sorted.find((item) => item.moveNumber === moveNo))
      .filter((item): item is KataGoMoveAnalysis => Boolean(item))
      .map((item) => ({
        moveNumber: item.moveNumber,
        playedMove: item.playedMove?.move ?? item.currentMove?.gtp,
        bestMove: item.before.topMoves[0]?.move,
        winrateLoss: Math.round((item.playedMove?.winrateLoss ?? 0) * 100) / 100,
        scoreLoss: Math.round((item.playedMove?.scoreLoss ?? 0) * 100) / 100,
        judgement: item.judgement,
        evidenceRefs: [
          `katago:move:${item.moveNumber}`,
          item.analysisQuality ? `analysisQuality:${item.analysisQuality.confidence}` : '',
          item.tacticalSignals?.[0]?.type ? `tactical:${item.tacticalSignals[0].type}` : ''
        ].filter(Boolean)
      }))
    return {
      start: rangeStart,
      end: rangeEnd,
      totalMoves: rangeEnd - rangeStart + 1,
      keyMoves,
      omittedMoves: Math.max(0, rangeEnd - rangeStart + 1 - keyMoves.length),
      analysisMethod: 'cached evaluations or quick sweep, then top-loss key-move review'
    }
  }

  async function renderRangeBoardPngs(targetRecord: GameRecord, summary: MoveRangeReviewSummary, rangeAnalyses: KataGoMoveAnalysis[]): Promise<string[]> {
    const analysisMap = new Map(rangeAnalyses.map((item) => [item.moveNumber, item]))
    return Promise.all(summary.keyMoves.slice(0, 6).map((move) => renderBoardPng(targetRecord, move.moveNumber, analysisMap.get(move.moveNumber) ?? null)))
  }

  function pauseLiveAnalysis(message = '已暂停精读', manual = false): void {
    if (manual) {
      userPausedLiveAnalysisRef.current = true
    }
    autoAnalysisRequestId.current = crypto.randomUUID()
    liveAnalysisRunId.current = crypto.randomUUID()
    void cancelKataGoWork({ group: 'live' })
    setLiveAnalysis((current) => ({
      ...current,
      running: false,
      status: message,
      visitsPerSecond: 0
    }))
  }

  async function startLiveAnalysis(options: {
    gameId?: string
    record?: GameRecord
    moveNumber?: number
    manual?: boolean
  } = {}): Promise<void> {
    const targetRecord = options.record ?? record
    const gameId = options.gameId ?? selectedGame?.id
    if (!targetRecord || !gameId) {
      return
    }
    const forceManualRefresh = options.manual !== false
    if (forceManualRefresh) {
      userPausedLiveAnalysisRef.current = false
    }
    const targetMove = Math.max(0, Math.min(targetRecord.moves.length, Math.round(options.moveNumber ?? moveNumber)))
    if (
      liveAnalysis.running &&
      liveAnalysis.targetMoveNumber === targetMove &&
      selectedGameIdRef.current === gameId
    ) {
      return
    }
    const cachedAnalysis = cachedAnalysisForGameMove(gameId, targetMove) ?? (selectedGameIdRef.current === gameId ? analysisForMove(targetMove) : null)
    const cachedVisits = candidateVisitsTotal(cachedAnalysis)
    const cachedBestVisits = candidateBestVisits(cachedAnalysis)
    const canReuseStrongCache = !forceManualRefresh
    if (
      canReuseStrongCache &&
      cachedAnalysis &&
      (cachedBestVisits >= LIVE_ANALYSIS_BEST_VISIT_LIMIT || cachedVisits >= LIVE_ANALYSIS_TOTAL_VISIT_LIMIT)
    ) {
      setMoveNumber(targetMove)
      setAnalysis(cachedAnalysis)
      setLiveAnalysis({
        running: false,
        status: `已复用缓存 ${formatVisits(cachedVisits)}`,
        visits: cachedVisits,
        bestVisits: cachedBestVisits,
        visitsPerSecond: dashboard.settings.katagoBenchmarkVisitsPerSecond,
        targetMoveNumber: targetMove,
        round: 0
      })
      return
    }
    const runId = crypto.randomUUID()
    const startedAt = Date.now()
    let lastSampleAt = performance.now()
    const cachedVisitSeed = forceManualRefresh ? 0 : candidateVisitsTotal(cachedAnalysis)
    let lastVisitSample = 0
    let lastEffectiveVisitSample = 0
    const benchmarkSpeed = dashboard.settings.katagoBenchmarkVisitsPerSecond
    let lastSpeedSample = benchmarkSpeed
    await cancelKataGoWork({ group: 'live' })
    liveAnalysisRunId.current = runId
    setError('')
    setMoveNumber(targetMove)
    setAnalysis(cachedAnalysis)
    setLiveAnalysis({
      running: true,
      status: `精读第 ${targetMove} 手`,
      visits: cachedVisitSeed,
      bestVisits: forceManualRefresh ? 0 : candidateBestVisits(cachedAnalysis),
      visitsPerSecond: benchmarkSpeed,
      targetMoveNumber: targetMove,
      round: 0
    })

    if (typeof window.goagent.analyzePositionStream === 'function') {
      const disposeProgress = window.goagent.onAnalyzePositionProgress((progress) => {
        if (
          liveAnalysisRunId.current !== runId ||
          progress.runId !== runId ||
          progress.gameId !== gameId ||
          progress.moveNumber !== targetMove ||
          selectedGameIdRef.current !== gameId
        ) {
          return
        }
        const nextAnalysis = progress.analysis
        const displayedAnalysis = forceManualRefresh
          ? nextAnalysis
          : (preferAnalysis(cachedAnalysisForGameMove(gameId, targetMove), nextAnalysis) ?? nextAnalysis)
        const progressVisits = candidateVisitsTotal(nextAnalysis)
        const totalVisits = candidateVisitsTotal(displayedAnalysis)
        const bestVisits = candidateBestVisits(displayedAnalysis)
        const sampledAt = performance.now()
        const sampleSeconds = Math.max(0.1, (sampledAt - lastSampleAt) / 1000)
        const visitsDelta = Math.max(0, progressVisits - lastVisitSample)
        const measuredSpeed = visitsDelta > 0 ? visitsDelta / sampleSeconds : lastSpeedSample
        lastSpeedSample = measuredSpeed > 0 ? Math.max(lastSpeedSample, measuredSpeed) : lastSpeedSample
        const visitsPerSecond = lastSpeedSample || measuredSpeed
        lastVisitSample = Math.max(lastVisitSample, progressVisits)
        lastSampleAt = sampledAt
        rememberEvaluation(nextAnalysis, { force: forceManualRefresh })
        if (moveNumberRef.current === targetMove) {
          setAnalysis((current) => forceManualRefresh ? nextAnalysis : preferAnalysis(current, nextAnalysis))
        }
        setLiveAnalysis({
          running: !progress.isFinal,
          status: progress.isFinal
            ? `已完成 ${formatVisits(totalVisits)}`
            : `实时搜索 ${formatVisits(totalVisits)} · 一选 ${formatVisits(bestVisits)}`,
          visits: totalVisits,
          bestVisits,
          visitsPerSecond,
          targetMoveNumber: targetMove,
          round: 1
        })
      })
      try {
        const finalAnalysis = await window.goagent.analyzePositionStream({
          gameId,
          moveNumber: targetMove,
          maxVisits: LIVE_ANALYSIS_TOTAL_VISIT_LIMIT,
          runId,
          reportDuringSearchEvery: LIVE_ANALYSIS_REPORT_INTERVAL_SECONDS
        })
        if (liveAnalysisRunId.current !== runId || selectedGameIdRef.current !== gameId) {
          return
        }
        const displayedFinal = forceManualRefresh
          ? finalAnalysis
          : (preferAnalysis(cachedAnalysisForGameMove(gameId, targetMove), finalAnalysis) ?? finalAnalysis)
        const totalVisits = candidateVisitsTotal(displayedFinal)
        const bestVisits = candidateBestVisits(displayedFinal)
        rememberEvaluation(finalAnalysis, { force: forceManualRefresh })
        if (moveNumberRef.current === targetMove) {
          setAnalysis((current) => forceManualRefresh ? finalAnalysis : preferAnalysis(current, finalAnalysis))
        }
        setLiveAnalysis((current) => ({
          ...current,
          running: false,
          status: `已完成 ${formatVisits(totalVisits)}`,
          visits: totalVisits,
          bestVisits,
          targetMoveNumber: targetMove
        }))
      } catch (cause) {
        if (liveAnalysisRunId.current === runId) {
          const message = String(cause)
          const hasUsablePartial = lastVisitSample > 0 || analysisHasCandidates(cachedAnalysis)
          if (message.includes('KataGo 分析超时') && hasUsablePartial) {
            setLiveAnalysis((current) => ({
              ...current,
              running: false,
              status: `已保留 ${formatVisits(current.visits || cachedVisitSeed || lastVisitSample)}`
            }))
          } else if (message.includes('KataGo 分析超时')) {
            try {
              const quickAnalysis = await window.goagent.analyzePosition({
                gameId,
                moveNumber: targetMove,
                maxVisits: 120
              })
              if (liveAnalysisRunId.current !== runId || selectedGameIdRef.current !== gameId) {
                return
              }
              const displayedQuick = forceManualRefresh
                ? quickAnalysis
                : (preferAnalysis(cachedAnalysisForGameMove(gameId, targetMove), quickAnalysis) ?? quickAnalysis)
              const totalVisits = candidateVisitsTotal(displayedQuick)
              const bestVisits = candidateBestVisits(displayedQuick)
              rememberEvaluation(quickAnalysis, { force: forceManualRefresh })
              if (moveNumberRef.current === targetMove) {
                setAnalysis((current) => forceManualRefresh ? quickAnalysis : preferAnalysis(current, quickAnalysis))
              }
              setLiveAnalysis((current) => ({
                ...current,
                running: false,
                status: `快速分析 ${formatVisits(totalVisits)}`,
                visits: totalVisits,
                bestVisits,
                targetMoveNumber: targetMove
              }))
            } catch (fallbackCause) {
              setError(`KataGo 暂时没有返回分析，请稍后重试或先运行一键测速。${String(fallbackCause)}`)
              setLiveAnalysis((current) => ({
                ...current,
                running: false,
                status: '等待重试'
              }))
            }
          } else {
            setError(`KataGo 实时分析失败: ${message}`)
            setLiveAnalysis((current) => ({
              ...current,
              running: false,
              status: '实时分析失败'
            }))
          }
        }
      } finally {
        disposeProgress()
      }
      return
    }

    for (const [index, maxVisits] of LIVE_ANALYSIS_VISIT_STEPS.entries()) {
      if (liveAnalysisRunId.current !== runId) {
        return
      }
      setLiveAnalysis((current) => ({
        ...current,
        running: true,
        status: `KataGo 精读中 · 上限 ${formatVisits(maxVisits)} visits`,
        round: index + 1,
        targetMoveNumber: targetMove
      }))
      try {
        const nextAnalysis = await window.goagent.analyzePosition({
          gameId,
          moveNumber: targetMove,
          maxVisits
        })
        if (liveAnalysisRunId.current !== runId || selectedGameIdRef.current !== gameId) {
          return
        }
        const displayedAnalysis = forceManualRefresh
          ? nextAnalysis
          : (preferAnalysis(cachedAnalysisForGameMove(gameId, targetMove), nextAnalysis) ?? nextAnalysis)
        const progressVisits = candidateVisitsTotal(nextAnalysis)
        const totalVisits = candidateVisitsTotal(displayedAnalysis)
        const bestVisits = candidateBestVisits(displayedAnalysis)
        const sampledAt = performance.now()
        const sampleSeconds = Math.max(0.1, (sampledAt - lastSampleAt) / 1000)
        const effectiveVisits = Math.max(progressVisits, maxVisits)
        const visitsDelta = Math.max(0, effectiveVisits - lastEffectiveVisitSample)
        const visitsPerSecond = visitsDelta > 0
          ? visitsDelta / sampleSeconds
          : (benchmarkSpeed || totalVisits / Math.max(0.1, (Date.now() - startedAt) / 1000))
        lastVisitSample = progressVisits
        lastEffectiveVisitSample = effectiveVisits
        lastSampleAt = sampledAt
        rememberEvaluation(nextAnalysis, { force: forceManualRefresh })
        if (moveNumberRef.current === targetMove) {
          setAnalysis((current) => forceManualRefresh ? nextAnalysis : preferAnalysis(current, nextAnalysis))
        }
        setLiveAnalysis({
          running: true,
          status: `已搜索 ${formatVisits(totalVisits)} · 一选 ${formatVisits(bestVisits)}`,
          visits: totalVisits,
          bestVisits,
          visitsPerSecond,
          targetMoveNumber: targetMove,
          round: index + 1
        })
        const elapsed = Date.now() - startedAt
        const reachedTotal = totalVisits >= LIVE_ANALYSIS_TOTAL_VISIT_LIMIT
        const reachedBest = bestVisits >= LIVE_ANALYSIS_BEST_VISIT_LIMIT
        const reachedTime = elapsed >= LIVE_ANALYSIS_TIME_LIMIT_MS
        if (reachedTotal || reachedBest || reachedTime) {
          setLiveAnalysis({
            running: false,
            status: reachedBest
              ? `已达到一选 ${formatVisits(bestVisits)}`
              : reachedTotal
                ? `已达到总搜索 ${formatVisits(totalVisits)}`
                : `已运行 ${Math.round(elapsed / 1000)} 秒`,
            visits: totalVisits,
            bestVisits,
            visitsPerSecond,
            targetMoveNumber: targetMove,
            round: index + 1
          })
          return
        }
      } catch (cause) {
        if (liveAnalysisRunId.current === runId) {
          setError(`KataGo 精读失败: ${String(cause)}`)
          setLiveAnalysis((current) => ({
            ...current,
            running: false,
            status: '精读失败'
          }))
        }
        return
      }
      await sleep(40)
    }

    if (liveAnalysisRunId.current === runId) {
      setLiveAnalysis((current) => ({
        ...current,
        running: false,
        status: `已完成 ${formatVisits(current.visits)}`
      }))
    }
  }

  async function runMoveAnalysisAt(targetMoveNumber: number): Promise<void> {
    if (!record || !selectedGame || busy !== '') {
      return
    }
    const targetMove = Math.max(0, Math.min(record.moves.length, Math.round(targetMoveNumber)))
    if (liveAnalysis.running) {
      pauseLiveAnalysis('老师讲解中，暂停精读')
    }
    setMoveNumber(targetMove)
    setAnalysis(analysisForMove(targetMove))
    setBusy('teacher')
    setError('')
    const ask = `分析第 ${targetMove} 手`
    appendMessage({ role: 'student', content: ask })
    const assistantMessageId = appendMessage({ role: 'teacher', content: '', status: 'running', toolLogs: [] })
    const runId = crypto.randomUUID()
    activeTeacherRunRef.current = { runId, messageId: assistantMessageId }
    try {
      const nextAnalysis = await window.goagent.analyzePosition({
        gameId: selectedGame.id,
        moveNumber: targetMove,
        maxVisits: 520,
        runId
      })
      if (!isActiveTeacherRun(runId)) {
        return
      }
      setAnalysis(nextAnalysis)
      rememberEvaluation(nextAnalysis, { force: true })
      const boardImageDataUrl = await renderBoardPng(record, targetMove, nextAnalysis)
      if (!isActiveTeacherRun(runId)) {
        return
      }
      const result = await runTeacherTaskWithStream({
        mode: 'current-move',
        prompt: ask,
        gameId: selectedGame.id,
        moveNumber: targetMove,
        playerName,
        boardImageDataUrl,
        prefetchedAnalysis: nextAnalysis
      }, assistantMessageId, runId)
      const finalAnalysis = result.analysis ?? nextAnalysis
      setAnalysis(finalAnalysis)
      rememberEvaluation(finalAnalysis, { force: true })
    } catch (cause) {
      if (/老师任务已停止|KataGo 分析已取消|AbortError|已取消/i.test(String(cause))) {
        return
      }
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        status: 'error',
        content: message.content || `${t('taskFailed')}：${uiError(cause, 'teacher-task')}`
      }))
    } finally {
      setLiveAnalysis((current) => current.status === '老师讲解中，暂停精读'
        ? {
            ...current,
            running: false,
            status: '讲解完成，已暂停精读',
            visitsPerSecond: 0
          }
        : current
      )
      if (isActiveTeacherRun(runId)) {
        activeTeacherRunRef.current = null
      }
      setBusy('')
    }
  }

  async function runCurrentMoveAnalysis(): Promise<void> {
    await runMoveAnalysisAt(moveNumber)
  }

  async function runTeacherQuickTask(text: string): Promise<void> {
    if (busy !== '') {
      return
    }
    setPrompt('')
    setBusy('teacher')
    setError('')
    appendMessage({ role: 'student', content: text })
    const assistantMessageId = appendMessage({ role: 'teacher', content: '', status: 'running', toolLogs: [] })
    try {
      const result = await runTeacherTaskWithStream({
        mode: 'freeform',
        prompt: text,
        gameId: selectedGame?.id,
        moveNumber,
        playerName
      }, assistantMessageId)
      if (result.analysis) {
        setAnalysis((current) => preferAnalysis(current, result.analysis))
        rememberEvaluation(result.analysis)
      }
    } catch (cause) {
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        status: 'error',
        content: message.content || `${t('taskFailed')}：${String(cause)}`
      }))
    } finally {
      setBusy('')
    }
  }

  function runDesktopCommand(command: DesktopCommand): void {
    setCommandPaletteOpen(false)
    switch (command) {
      case 'open-command-palette':
        setCommandPaletteOpen(true)
        break
      case 'open-settings':
        setSettingsOpen(true)
        break
      case 'import-sgf':
        void importSgf()
        break
      case 'analyze-current':
        void runCurrentMoveAnalysis()
        break
      case 'analyze-game':
        void runTeacherQuickTask(t('quickAnalyzeGamePrompt'))
        break
      case 'analyze-recent':
        void runTeacherQuickTask(t('quickAnalyzeRecentPrompt'))
        break
      case 'toggle-library':
        setLibraryCollapsed((value) => !value)
        break
      case 'open-ui-gallery':
        window.location.hash = '#/ui-gallery'
        window.location.reload()
        break
    }
  }

  async function submitTeacherPromptText(rawText: string): Promise<void> {
    const text = rawText.trim()
    if (!text || busy !== '') {
      return
    }
    setPrompt('')
    appendMessage({ role: 'student', content: text })
    const assistantMessageId = appendMessage({ role: 'teacher', content: '', status: 'running', toolLogs: [] })
    const runId = crypto.randomUUID()
    activeTeacherRunRef.current = { runId, messageId: assistantMessageId }
    setBusy('teacher')
    try {
      const wantsCurrentMove = /当前手|這手|目前這手|这一手|這一手|本手|current move|this move|この手|현재 수|น้ำนี้|nước này/i.test(text)
      const parsedRange = parseMoveRangeFromPrompt(text, record?.moves.length)
      const selectedRangeText = moveRange ? `分析${describeMoveRange(moveRange)}` : ''
      const range = parsedRange ?? (text === selectedRangeText ? moveRange : null)
      const wantsMoveRange = range !== null
      if (wantsCurrentMove && record && selectedGame) {
        const nextAnalysis = await window.goagent.analyzePosition({
          gameId: selectedGame.id,
          moveNumber,
          maxVisits: 520,
          runId
        })
        if (!isActiveTeacherRun(runId)) {
          return
        }
        setAnalysis(nextAnalysis)
        rememberEvaluation(nextAnalysis, { force: true })
        const boardImageDataUrl = await renderBoardPng(record, moveNumber, nextAnalysis)
        if (!isActiveTeacherRun(runId)) {
          return
        }
        const result = await runTeacherTaskWithStream({
          mode: 'current-move',
          prompt: text,
          gameId: selectedGame.id,
          moveNumber,
          playerName,
          boardImageDataUrl,
          prefetchedAnalysis: nextAnalysis
        }, assistantMessageId, runId)
        if (result.analysis) {
          setAnalysis(result.analysis)
          rememberEvaluation(result.analysis, { force: true })
        }
      } else if (wantsMoveRange && record && selectedGame) {
        if (!range) {
          await runTeacherTaskWithStream({ mode: 'freeform', prompt: text, gameId: selectedGame.id, moveNumber, playerName }, assistantMessageId)
        } else {
          const validation = validateMoveRange(range.start, range.end, record.moves.length, MOVE_RANGE_MAX_MOVES)
          if (!validation.ok || !validation.range) {
            throw new Error(validation.reason ?? t('moveRangeInvalid'))
          }
          const { start: rangeStart, end: rangeEnd } = validation.range
          const merged = new Map<number, KataGoMoveAnalysis>()
          for (const a of Object.values(evaluations)) merged.set(a.moveNumber, a)
          const missing = []
          for (let m = rangeStart; m <= rangeEnd; m += 1) {
            if (!merged.has(m)) missing.push(m)
          }
          if (missing.length > 0) {
            const allAnalyses = await window.goagent.analyzeGameQuick({ gameId: selectedGame.id, maxVisits: 25, refineVisits: 120, refineTopN: 12, runId })
            if (!isActiveTeacherRun(runId)) {
              return
            }
            for (const a of allAnalyses) {
              const next = preferAnalysis(merged.get(a.moveNumber), a) ?? a
              merged.set(a.moveNumber, next)
              rememberEvaluation(next)
            }
          }
          const rangeSlice = [...merged.values()].filter((a) => a.moveNumber >= rangeStart && a.moveNumber <= rangeEnd)
          if (rangeSlice.length === 0) {
            throw new Error(t('moveRangeNoEvaluations'))
          }
          const moveRangeSummary = buildMoveRangeSummary(rangeSlice, rangeStart, rangeEnd)
          const boardImageDataUrls = await renderRangeBoardPngs(record, moveRangeSummary, rangeSlice)
          const result = await runTeacherTaskWithStream({
            mode: 'move-range',
            prompt: text,
            gameId: selectedGame.id,
            moveNumber,
            playerName,
            moveRange: { start: rangeStart, end: rangeEnd },
            moveRangeSummary,
            boardImageDataUrls
          }, assistantMessageId, runId)
          if (result.analysis) {
            setAnalysis((current) => preferAnalysis(current, result.analysis))
            rememberEvaluation(result.analysis)
          }
        }
      } else {
        await runTeacherTaskWithStream({
          mode: 'freeform',
          prompt: text,
          gameId: selectedGame?.id,
          moveNumber,
          playerName
        }, assistantMessageId, runId)
      }
    } catch (cause) {
      if (/老师任务已停止|KataGo 分析已取消|AbortError|已取消/i.test(String(cause))) {
        return
      }
      updateMessage(assistantMessageId, (message) => ({
        ...message,
        status: 'error',
        content: message.content || `任务失败：${String(cause)}`
      }))
    } finally {
      setMoveRange(null)
      if (isActiveTeacherRun(runId)) {
        activeTeacherRunRef.current = null
      }
      setBusy('')
    }
  }

  async function sendTeacherPrompt(event: FormEvent): Promise<void> {
    event.preventDefault()
    await submitTeacherPromptText(prompt)
  }

  const statusItems: StatusPill[] = [
    {
      label: dashboard.systemProfile.katagoReady
        ? localizeKataGoStatus(
          dashboard.systemProfile.katagoStatus,
          dashboard.systemProfile.katagoModelPresets,
          dashboard.systemProfile.katagoModelPreset,
          t
        )
        : t('katagoMissing'),
      tone: dashboard.systemProfile.katagoReady ? 'good' : 'warn'
    },
    {
      label: dashboard.systemProfile.hasLlmApiKey ? t('llmReady') : t('llmMissing'),
      tone: dashboard.systemProfile.hasLlmApiKey ? 'good' : 'warn'
    }
  ]
  const liveAnalysisDisabled = busy === 'katago-install' || busy === 'katago-benchmark'

  return (
    <DiagnosticsGate>
      <div className="desktop-shell">
        <DesktopTitleBar statusItems={statusItems} onCommand={runDesktopCommand} t={t} />
        <div className={`studio ${libraryCollapsed ? 'studio--collapsed' : ''}`}>
        <aside className="library-rail">
          <div className={`rail-head library-rail-head ${libraryCollapsed ? 'is-collapsed' : ''}`}>
            {!libraryCollapsed ? (
              <div className="library-rail-heading">
                <strong>{t('library')}</strong>
                <span>Fox & SGF</span>
              </div>
            ) : null}
            <button className="icon-button library-collapse-button" onClick={() => setLibraryCollapsed((value) => !value)} title={t('toggleLibrary')} aria-label={t('toggleLibrary')}>
              {libraryCollapsed ? '›' : '‹'}
            </button>
          </div>
          {!libraryCollapsed ? (
            <LibraryPanel
              dashboard={dashboard}
              t={t}
              selectedGame={selectedGame}
              foxKeyword={foxKeyword}
              busy={busy}
              currentStudent={currentStudent}
              onSelect={setSelectedId}
              onSync={() => void syncFox()}
              onImport={() => void importSgf()}
              onDeleteGame={(game) => void deleteLibraryGameFromLibrary(game)}
              onFoxKeyword={setFoxKeyword}
              onChangePlayerBinding={() => selectedGame && void openStudentBinding(selectedGame)}
            />
          ) : null}
        </aside>

        <main className="board-workspace">
          <header className="topbar">
            {record ? (
              <BoardContextBar
                title={selectedGame ? boardGameTitle(selectedGame) : t('noGameSelected')}
                record={record}
                moveNumber={moveNumber}
                analysis={currentAnalysis}
                liveAnalysis={liveAnalysis}
                disabled={liveAnalysisDisabled}
                onStart={() => void startLiveAnalysis()}
                onPause={() => pauseLiveAnalysis(t('pausedFineReview'), true)}
                t={t}
              />
            ) : (
              <div className="board-contextbar board-contextbar--empty">
                <div className="board-contextbar__identity">
                  <h1>{t('noGameSelected')}</h1>
                  <span>{t('chooseGameHint')}</span>
                </div>
              </div>
            )}
          </header>

          <section className="board-stage">
            {record ? (
              <div className="board-table board-table--v2">
                {record.boardSize >= 2 ? (
                  <GoBoardV2 record={record} moveNumber={moveNumber} analysis={currentAnalysis} keyMoves={currentBoardKeyMoveMarks} flashPoint={boardFlash} t={t} />
                ) : (
                  <GoBoard record={record} moveNumber={moveNumber} analysis={currentAnalysis} />
                )}
              </div>
            ) : (
              <div className="empty-board">{t('emptyBoard')}</div>
            )}
          </section>

          <section className={`timeline-panel ${record ? 'timeline-panel--with-issues' : 'timeline-panel--empty'}`}>
            {record ? (
              <>
                <TimelineIssueList
                  color={timelineIssueColor}
                  issues={timelineIssues}
                  currentMoveNumber={moveNumber}
                  loading={graphBusy}
                  onColorChange={setTimelineIssueColor}
                  onJump={jumpToMove}
                  t={t}
                />
                <WinrateTimelineV2
                  evaluations={Object.values(evaluations)}
                  currentMoveNumber={moveNumber}
                  totalMoves={record.moves.length}
                  loading={graphBusy}
                  loadingLabel={graphProgress}
                  onMove={jumpToMove}
                  onRangeSelect={handleTimelineRangeSelect}
                  onRangeClear={handleTimelineRangeClear}
                  rangeStart={moveRange?.start ?? null}
                  rangeEnd={moveRange?.end ?? null}
                  t={t}
                />
              </>
            ) : (
              <EvaluationGraph
                analysis={currentAnalysis}
                evaluations={Object.values(evaluations)}
                moveNumber={moveNumber}
                totalMoves={0}
                loading={graphBusy}
                loadingLabel={graphProgress}
                onMove={jumpToMove}
              />
            )}
          </section>
        </main>

        <aside className="teacher-column">
          <TeacherPanel
            messages={messages}
            prompt={prompt}
            busy={busy}
            dashboard={dashboard}
            t={t}
            error={error}
            teacherSessions={teacherSessions}
            teacherSessionId={teacherSessionId}
            onPrompt={setPrompt}
            onQuickPrompt={(value) => void submitTeacherPromptText(value)}
            onSubmit={(event) => void sendTeacherPrompt(event)}
            onStop={() => void stopTeacherTask()}
            onPersonaSettingsSaved={setDashboard}
            onAnalyze={() => void runCurrentMoveAnalysis()}
            onAnalyzeGame={() => void runTeacherQuickTask(t('quickAnalyzeGamePrompt'))}
            onAnalyzeRecent={() => void runTeacherQuickTask(t('quickAnalyzeRecentPrompt'))}
            onJumpToMove={jumpToMove}
            onFlashPoint={flashBoardCoordinate}
            boardSize={record?.boardSize ?? 19}
            totalMoves={record?.moves.length ?? 0}
            onAnalyzeMove={(targetMove) => void runMoveAnalysisAt(targetMove)}
            onNewTeacherSession={() => void startNewTeacherSession()}
            onRestoreTeacherSession={(sessionId) => void restoreTeacherSessionById(sessionId)}
            onDeleteTeacherSession={(sessionId) => void deleteTeacherSessionById(sessionId)}
          />
        </aside>
      </div>
        <DesktopStatusBar
          graphBusy={graphBusy}
          graphProgress={graphProgress}
          katagoReady={katagoAssets?.ready || dashboard.systemProfile.katagoReady}
          llmReady={dashboard.systemProfile.hasLlmApiKey}
          busy={busy}
          t={t}
        />
        <CommandPalette
          open={commandPaletteOpen}
          busy={busy}
          hasRecord={Boolean(record)}
          hasGames={dashboard.games.length > 0}
          onClose={() => setCommandPaletteOpen(false)}
          onRun={runDesktopCommand}
          t={t}
        />
        <DesktopPreferencesModal
          open={settingsOpen}
          dashboard={dashboard}
          katagoAssets={katagoAssets}
          busy={busy}
          llmTestMessage={llmTestMessage}
          katagoBenchmark={katagoBenchmark}
          katagoBenchmarkMessage={katagoBenchmarkMessage}
          katagoInstallMessage={katagoInstallMessage}
          katagoInstallProgress={katagoInstallProgress}
          t={t}
          onClose={() => setSettingsOpen(false)}
          onSave={(form) => void saveSettings(form)}
          onTest={(form) => void testLlmSettings(form)}
          onBenchmark={() => void runKataGoBenchmark()}
          onInstallOfficialModel={(presetId) => void installOfficialKataGoModel(presetId)}
          onRefreshKataGoAssets={() => void refreshKataGoAssets()}
          onDashboardUpdated={setDashboard}
        />
      </div>
      <StudentBindingDialog
        open={Boolean(studentBinding)}
        blackName={studentBinding?.game.black}
        whiteName={studentBinding?.game.white}
        suggestions={studentBinding?.suggestions.map((suggestion) => ({
          ...suggestion.student,
          ...(suggestion.color ? { suggestedColor: suggestion.color } : {})
        }))}
        onClose={() => setStudentBinding(null)}
        onSkip={() => setStudentBinding(null)}
        onBindExisting={(input) => void bindImportedGameToExisting(input)}
        onCreateStudent={(input) => void createStudentAndBind(input)}
        t={t}
      />
    </DiagnosticsGate>
  )
}

function LibraryPanel({
  dashboard,
  t,
  selectedGame,
  foxKeyword,
  busy,
  currentStudent,
  onSelect,
  onSync,
  onImport,
  onDeleteGame,
  onFoxKeyword,
  onChangePlayerBinding
}: {
  dashboard: DashboardData
  t: UiTranslator
  selectedGame?: LibraryGame
  foxKeyword: string
  busy: string
  currentStudent: StudentProfile | null
  onSelect: (id: string) => void
  onSync: () => void
  onImport: () => void
  onDeleteGame: (game: LibraryGame) => void
  onFoxKeyword: (value: string) => void
  onChangePlayerBinding: () => void
}): ReactElement {
  const [page, setPage] = useState(1)
  const keyword = foxKeyword.trim().toLowerCase()
  const visibleGames = useMemo(() => {
    if (!keyword) {
      return dashboard.games
    }
    return dashboard.games.filter((game) => {
      const haystack = [
        gameDisplayName(game),
        game.black,
        game.white,
        game.sourceLabel,
        game.event,
        game.title
      ].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [dashboard.games, keyword])
  const pageCount = Math.max(1, Math.ceil(visibleGames.length / LIBRARY_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageGames = visibleGames.slice((safePage - 1) * LIBRARY_PAGE_SIZE, safePage * LIBRARY_PAGE_SIZE)
  const pageStart = visibleGames.length === 0 ? 0 : (safePage - 1) * LIBRARY_PAGE_SIZE + 1
  const pageEnd = Math.min(visibleGames.length, safePage * LIBRARY_PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [keyword, dashboard.games.length])

  return (
    <div className="rail-body">
      <form
        className="fox-sync-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSync()
        }}
      >
        <input value={foxKeyword} onChange={(event) => onFoxKeyword(event.target.value)} placeholder={t('foxNicknamePlaceholder')} />
        <button className="primary-button fox-search-button" type="submit" disabled={!foxKeyword.trim() || busy !== ''}>
          {busy === 'fox' ? t('searching') : t('foxSearch')}
        </button>
      </form>
      <button className="ghost-button library-import-button" type="button" onClick={onImport} disabled={busy !== ''}>
        {busy === 'import' ? t('importingSgf') : t('importSgf')}
      </button>
      <StudentRailCard
        displayName={currentStudent?.displayName}
        primaryFoxNickname={currentStudent?.primaryFoxNickname}
        disabled={!selectedGame}
        onChangeBinding={onChangePlayerBinding}
        t={t}
      />
      <div className="library-list-head">
        <span>{keyword ? t('foxGames') : t('library')}</span>
        <small>{visibleGames.length} {t('gamesUnit')} · {pageStart}-{pageEnd}</small>
      </div>
      <div className="game-list">
        {pageGames.map((game) => (
          <article key={game.id} className={`game-row ${selectedGame?.id === game.id ? 'is-active' : ''}`}>
            <button type="button" className="game-row__select" onClick={() => onSelect(game.id)}>
              <div className="game-row__title">
                <span>{gameDisplayName(game)}</span>
                {game.source === 'fox' ? (
                  <em className={`game-row__badge ${game.downloadStatus === 'downloaded' ? 'game-row__badge--downloaded' : 'game-row__badge--remote'}`}>
                    {game.downloadStatus === 'downloaded' ? t('cached') : t('remoteOnly')}
                  </em>
                ) : (
                  <em className="game-row__badge">{t('local')}</em>
                )}
              </div>
              <small className="game-row__meta">
                {game.date || t('unknownDate')} · {game.moveCount ? `${game.moveCount}${t('movesSuffix')} · ` : ''}{game.result || t('unknownResult')}
              </small>
            </button>
            <button
              type="button"
              className="game-row__delete"
              onClick={() => onDeleteGame(game)}
              disabled={busy !== ''}
              title={t('deleteGame')}
              aria-label={`${t('deleteGame')} ${gameDisplayName(game)}`}
            >
              {t('delete')}
            </button>
          </article>
        ))}
        {pageGames.length === 0 ? <div className="empty-list">{t('noMatchedGames')}</div> : null}
      </div>
      <div className="pagination-row library-pagination" aria-label={t('gamePagination')}>
        <button className="ghost-button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1} aria-label={t('previousPage')}>
          ‹
        </button>
        <span>{safePage} / {pageCount}</span>
        <button className="ghost-button" onClick={() => setPage(Math.min(pageCount, safePage + 1))} disabled={safePage >= pageCount} aria-label={t('nextPage')}>
          ›
        </button>
      </div>
    </div>
  )
}

function StatusPills({ items }: { items: StatusPill[] }): ReactElement {
  return (
    <div className="status-strip" aria-label="系统状态">
      {items.map((item) => (
        <span key={item.label} className={`status-pill status-pill--${item.tone}`}>
          {item.label}
        </span>
      ))}
    </div>
  )
}

function DesktopTitleBar({
  statusItems,
  onCommand,
  t
}: {
  statusItems: StatusPill[]
  onCommand: (command: DesktopCommand) => void
  t: UiTranslator
}): ReactElement {
  return (
    <header className="desktop-titlebar">
      <div className="desktop-titlebar__brand">
        <img src={logoUrl} alt="" aria-hidden="true" />
        <div>
          <strong>{BRAND_NAME}</strong>
        </div>
      </div>
      <div className="desktop-titlebar__center">
        <StatusPills items={statusItems} />
      </div>
      <div className="desktop-titlebar__actions">
        <button type="button" onClick={() => onCommand('open-settings')}>{t('settings')}</button>
      </div>
    </header>
  )
}

function DesktopStatusBar({
  graphBusy,
  graphProgress,
  katagoReady,
  llmReady,
  busy,
  t
}: {
  graphBusy: boolean
  graphProgress: string
  katagoReady: boolean
  llmReady: boolean
  busy: string
  t: UiTranslator
}): ReactElement {
  return (
    <footer className="desktop-statusbar">
      <span>{graphBusy ? t('winrateAnalyzing', { progress: graphProgress || t('timelineLoading') }) : t('winrateReady')}</span>
      <span data-ready={katagoReady}>{t('katagoEngine')}</span>
      <span data-ready={llmReady}>{t('visionLlm')}</span>
      <em>{busy ? t('appStatusTask', { busy }) : t('appStatusReady')}</em>
    </footer>
  )
}

function CommandPalette({
  open,
  busy,
  hasRecord,
  hasGames,
  onClose,
  onRun,
  t
}: {
  open: boolean
  busy: string
  hasRecord: boolean
  hasGames: boolean
  onClose: () => void
  onRun: (command: DesktopCommand) => void
  t: UiTranslator
}): ReactElement | null {
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (open) {
      setQuery('')
    }
  }, [open])
  const commands = useMemo(() => [
    { id: 'analyze-current' as const, title: t('commandAnalyzeCurrent'), detail: t('commandAnalyzeCurrentDetail'), shortcut: 'Ctrl/Cmd 1', disabled: !hasRecord || busy !== '' },
    { id: 'analyze-game' as const, title: t('commandAnalyzeGame'), detail: t('commandAnalyzeGameDetail'), shortcut: 'Ctrl/Cmd 2', disabled: !hasRecord || busy !== '' },
    { id: 'analyze-recent' as const, title: t('commandAnalyzeRecent'), detail: t('commandAnalyzeRecentDetail'), shortcut: 'Ctrl/Cmd 3', disabled: !hasGames || busy !== '' },
    { id: 'import-sgf' as const, title: t('importSgf'), detail: t('commandImportSgfDetail'), shortcut: 'Ctrl/Cmd O', disabled: busy !== '' },
    { id: 'open-settings' as const, title: t('commandOpenSettings'), detail: t('commandOpenSettingsDetail'), shortcut: 'Ctrl/Cmd ,', disabled: false },
    { id: 'toggle-library' as const, title: t('toggleLibrary'), detail: t('commandToggleLibraryDetail'), shortcut: 'Ctrl/Cmd B', disabled: false },
    { id: 'open-ui-gallery' as const, title: t('commandOpenGallery'), detail: t('commandOpenGalleryDetail'), shortcut: 'Ctrl/Cmd Shift G', disabled: false }
  ], [busy, hasGames, hasRecord, t])
  const filtered = commands.filter((command) => {
    const haystack = `${command.title} ${command.detail}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      onClose()
    }
    if (event.key === 'Enter') {
      const first = filtered.find((command) => !command.disabled)
      if (first) {
        onRun(first.id)
      }
    }
  }
  if (!open) {
    return null
  }
  return (
    <div className="desktop-command-palette" role="dialog" aria-modal="true" aria-label={`${BRAND_NAME} command palette`} onMouseDown={onClose}>
      <section className="desktop-command-palette__panel" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <span>{t('commandPalette')}</span>
          <button type="button" onClick={onClose}>Esc</button>
        </header>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('commandPlaceholder')}
        />
        <div className="desktop-command-palette__list">
          {filtered.map((command) => (
            <button key={command.id} type="button" disabled={command.disabled} onClick={() => onRun(command.id)}>
              <strong>{command.title}</strong>
              <small>{command.detail}</small>
              <em>{command.shortcut}</em>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function DesktopPreferencesModal({
  open,
  dashboard,
  katagoAssets,
  busy,
  llmTestMessage,
  katagoBenchmark,
  katagoBenchmarkMessage,
  katagoInstallMessage,
  katagoInstallProgress,
  onClose,
  onSave,
  onTest,
  onBenchmark,
  onInstallOfficialModel,
  onRefreshKataGoAssets,
  onDashboardUpdated,
  t
}: {
  open: boolean
  dashboard: DashboardData
  katagoAssets: KataGoAssetStatus | null
  busy: string
  llmTestMessage: string
  katagoBenchmark: KataGoBenchmarkResult | null
  katagoBenchmarkMessage: string
  katagoInstallMessage: string
  katagoInstallProgress: KataGoAssetInstallProgress | null
  onClose: () => void
  onSave: (form: HTMLFormElement) => void
  onTest: (form: HTMLFormElement) => void
  onBenchmark: () => void
  onInstallOfficialModel: (presetId: KataGoModelPresetId) => void
  onRefreshKataGoAssets: () => void
  onDashboardUpdated: (dashboard: DashboardData) => void
  t: UiTranslator
}): ReactElement | null {
  if (!open) {
    return null
  }
  const katagoReady = katagoAssets?.ready || dashboard.systemProfile.katagoReady
  const llmReady = dashboard.systemProfile.hasLlmApiKey
  return (
    <div className="desktop-preferences" role="dialog" aria-modal="true" aria-label={t('settingsTitle')} onMouseDown={onClose}>
      <section className="desktop-preferences__window" onMouseDown={(event) => event.stopPropagation()}>
        <header className="desktop-preferences__titlebar">
          <div className="desktop-preferences__heading">
            <span className="desktop-preferences__mark" aria-hidden="true" />
            <div>
              <span>{t('settingsTitle')}</span>
              <strong>{t('settingsSubtitle')}</strong>
              <p>{t('settingsDescription')}</p>
            </div>
          </div>
          <div className="desktop-preferences__meta" aria-label={t('settingsStatus')}>
            <em className={katagoReady ? 'is-ready' : ''}>KataGo {katagoReady ? t('ready') : t('pendingConfig')}</em>
            <em className={llmReady ? 'is-ready' : ''}>LLM {llmReady ? t('ready') : t('pendingConfig')}</em>
            <button type="button" onClick={onClose} aria-label={t('close')}>{t('close')}</button>
          </div>
        </header>
        <SettingsDrawer
          dashboard={dashboard}
          katagoAssets={katagoAssets}
          busy={busy}
          llmTestMessage={llmTestMessage}
          katagoBenchmark={katagoBenchmark}
          katagoBenchmarkMessage={katagoBenchmarkMessage}
          katagoInstallMessage={katagoInstallMessage}
          katagoInstallProgress={katagoInstallProgress}
          onSave={onSave}
          onTest={onTest}
          onBenchmark={onBenchmark}
          onInstallOfficialModel={onInstallOfficialModel}
          onRefreshKataGoAssets={onRefreshKataGoAssets}
          onDashboardUpdated={onDashboardUpdated}
          t={t}
        />
      </section>
    </div>
  )
}

function teacherResultKeyMoves(result: TeacherRunResult | undefined, t: UiTranslator): Array<{ moveNumber: number; title: string; summary: string; severity: string }> {
  const structured = result?.structuredResult ?? result?.structured
  return (structured?.keyMistakes ?? []).flatMap((move, index) => {
    if (typeof move.moveNumber !== 'number') {
      return []
    }
    const title = t('keyMoveTitle', { move: move.moveNumber, played: move.played ? ` ${move.played}` : '' })
    const summary = move.explanation || move.evidence || t('keyMoveDefaultSummary')
    return [{
      moveNumber: move.moveNumber,
      title: title || t('keyMoveFallbackTitle', { index: index + 1 }),
      summary,
      severity: move.errorType || move.severity || '重点'
    }]
  }).slice(0, 4)
}

type TeacherReferenceRenderOptions = {
  boardSize: number
  totalMoves: number
  t: UiTranslator
  onJumpToMove: (moveNumber: number) => void
  onFlashPoint: (point: string) => void
}

type InlineReference =
  | { kind: 'move'; start: number; end: number; text: string; moveNumber: number }
  | { kind: 'point'; start: number; end: number; text: string; pointLabel: string }

function firstInlineReference(text: string, cursor: number, boardSize: number, totalMoves: number): InlineReference | null {
  const movePatterns = [
    /第\s*(\d{1,4})\s*手/g,
    /(?<!\d)(\d{1,4})\s*手/g,
    /\bmove\s*#?\s*(\d{1,4})\b/gi
  ]
  const candidates: InlineReference[] = []
  for (const pattern of movePatterns) {
    pattern.lastIndex = cursor
    const match = pattern.exec(text)
    if (!match) continue
    const moveNumber = Number(match[1])
    if (!Number.isInteger(moveNumber) || moveNumber < 0 || (totalMoves > 0 && moveNumber > totalMoves)) continue
    candidates.push({
      kind: 'move',
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      moveNumber
    })
  }

  const coordPattern = /(^|[^A-Za-z0-9])([A-HJ-Z])\s?([1-9]|1[0-9]|2[0-5])(?![A-Za-z0-9])/g
  coordPattern.lastIndex = cursor
  const coord = coordPattern.exec(text)
  if (coord) {
    const prefixLength = coord[1]?.length ?? 0
    const start = coord.index + prefixLength
    const end = coord.index + coord[0].length
    const pointLabel = `${coord[2]}${coord[3]}`
    if (parseBoardPoint(pointLabel, boardSize)) {
      candidates.push({
        kind: 'point',
        start,
        end,
        text: text.slice(start, end),
        pointLabel
      })
    }
  }

  return candidates
    .filter((item) => item.start >= cursor)
    .sort((left, right) => left.start - right.start || right.end - right.start - (left.end - left.start))[0] ?? null
}

function renderReferenceText(text: string, options: TeacherReferenceRenderOptions, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  while (cursor < text.length) {
    const reference = firstInlineReference(text, cursor, options.boardSize, options.totalMoves)
    if (!reference) {
      nodes.push(text.slice(cursor))
      break
    }
    if (reference.start > cursor) {
      nodes.push(text.slice(cursor, reference.start))
    }
    if (reference.kind === 'move') {
      nodes.push(
        <button
          key={`${keyPrefix}-move-${reference.start}-${reference.moveNumber}`}
          type="button"
          className="chat-reference-link chat-reference-link--move"
          onClick={() => options.onJumpToMove(reference.moveNumber)}
          aria-label={options.t('jumpToReferencedMove', { move: reference.moveNumber })}
        >
          {reference.text}
        </button>
      )
    } else {
      nodes.push(
        <button
          key={`${keyPrefix}-point-${reference.start}-${reference.pointLabel}`}
          type="button"
          className="chat-reference-link chat-reference-link--point"
          onClick={() => options.onFlashPoint(reference.pointLabel)}
          aria-label={options.t('flashReferencedPoint', { point: reference.pointLabel })}
        >
          {reference.text}
        </button>
      )
    }
    cursor = reference.end
  }
  return nodes
}

function renderInlineMarkdown(text: string, options: TeacherReferenceRenderOptions, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).flatMap((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{renderReferenceText(part.slice(2, -2), options, key)}</strong>
    }
    return renderReferenceText(part, options, key)
  })
}

function ChatMarkdown({ text, boardSize, totalMoves, t, onJumpToMove, onFlashPoint }: { text: string; boardSize: number; totalMoves: number; t: UiTranslator; onJumpToMove: (moveNumber: number) => void; onFlashPoint: (point: string) => void }): ReactElement {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const nodes: ReactElement[] = []
  let list: ReactElement[] = []
  const inlineOptions: TeacherReferenceRenderOptions = { boardSize, totalMoves, t, onJumpToMove, onFlashPoint }
  function flushList(): void {
    if (list.length > 0) {
      nodes.push(<ol key={`ol-${nodes.length}`}>{list}</ol>)
      list = []
    }
  }
  for (const line of lines) {
    const numbered = line.match(/^(\d+)[.、]\s*(.+)$/)
    if (numbered) {
      list.push(<li key={`${nodes.length}-${list.length}`}>{renderInlineMarkdown(numbered[2], inlineOptions, `li-${nodes.length}-${list.length}`)}</li>)
      continue
    }
    flushList()
    nodes.push(<p key={`p-${nodes.length}`}>{renderInlineMarkdown(line, inlineOptions, `p-${nodes.length}`)}</p>)
  }
  flushList()
  return <div className="chat-markdown">{nodes}</div>
}

function teacherToolTitle(log: TeacherTraceLog, t: UiTranslator, logs: TeacherTraceLog[] = [], index = 0): string {
  const sameToolCount = logs.filter((item) => item.name === log.name).length
  const occurrence = logs.slice(0, index + 1).filter((item) => item.name === log.name).length
  if (log.name === 'katago.analyzePosition') {
    if (sameToolCount <= 1) return t('toolKatagoCurrent')
    if (occurrence === 1) return t('toolKatagoCurrent')
    if (occurrence === 2) return t('toolKatagoRecheck')
    return t('toolKatagoExtra', { count: occurrence })
  }
  const byName: Record<string, string> = {
    'library.findGames': t('toolFindGames'),
    'sgf.readGameRecord': t('toolReadSgf'),
    'katago.analyzeGameBatch': t('toolAnalyzeGame'),
    'board.captureTeachingImage': t('toolBoardImage'),
    'knowledge.searchLocal': t('toolKnowledge'),
    'studentProfile.read': t('toolProfileRead'),
    'studentProfile.write': t('toolProfileWrite'),
    'system.detectEnvironment': t('toolEnvironment'),
    'settings.writeAppConfig': t('toolSettingsWrite'),
    'katago.verifyAnalysis': t('toolVerifyKatago'),
    'web.searchGoKnowledge': t('toolWebSearch'),
    'filesystem.read': t('toolReadFile'),
    'shell.exec': t('toolShellExec'),
    'shell.kill': t('toolShellKill'),
    'report.saveAnalysis': t('toolSaveReport')
  }
  return byName[log.name] ?? log.label ?? t('toolCall')
}

function teacherToolStatusText(status: TeacherTraceLog['status'], t: UiTranslator): string {
  if (status === 'running') return t('toolRunning')
  if (status === 'done') return t('toolDone')
  if (status === 'error') return t('toolError')
  return t('toolSkipped')
}

function teacherToolDetail(log: TeacherTraceLog, logs: TeacherTraceLog[], index: number, t: UiTranslator): string {
  const sameToolCount = logs.filter((item) => item.name === log.name).length
  const occurrence = logs.slice(0, index + 1).filter((item) => item.name === log.name).length
  if (log.status === 'error') {
    return log.detail.replace(/\s+/g, ' ').slice(0, 96)
  }
  if (log.name === 'katago.analyzePosition') {
    if (occurrence === 1) return t('toolDetailKatagoFirst')
    if (sameToolCount > 1 && occurrence === 2) return t('toolDetailKatagoSecond')
    return t('toolDetailKatagoExtra', { count: occurrence })
  }
  if (log.name === 'knowledge.searchLocal') return t('toolDetailKnowledge')
  if (log.name === 'board.captureTeachingImage') return t('toolDetailBoardImage')
  if (log.name === 'sgf.readGameRecord') return t('toolDetailReadSgf')
  if (log.name === 'katago.analyzeGameBatch') return t('toolDetailAnalyzeGame')
  if (log.status === 'running') return t('toolDetailRunning')
  return log.detail && log.detail.length < 120 ? log.detail.replace(/\s+/g, ' ') : t('toolDetailDone')
}

function teacherToolDisplay(log: TeacherTraceLog, logs: TeacherTraceLog[], index: number, t: UiTranslator): TeacherTraceDisplay {
  return {
    title: teacherToolTitle(log, t, logs, index),
    detail: teacherToolDetail(log, logs, index, t),
    status: teacherToolStatusText(log.status, t)
  }
}

function teacherToolTraceSummary(logs: TeacherTraceLog[], t: UiTranslator): string {
  const runningIndex = logs.findIndex((log) => log.status === 'running')
  if (runningIndex >= 0) {
    return t('toolTraceRunning', { count: logs.length, tool: teacherToolTitle(logs[runningIndex], t, logs, runningIndex) })
  }
  const katagoChecks = logs.filter((log) => log.name === 'katago.analyzePosition').length
  return katagoChecks > 1 ? t('toolTraceChecked', { count: logs.length, countKatago: katagoChecks }) : t('toolTracePlain', { count: logs.length })
}

async function copyTextToClipboard(text: string): Promise<void> {
  const value = text.trim()
  if (!value) {
    return
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) {
    throw new Error('复制失败')
  }
}

function TeacherInlineResponse({
  message,
  t,
  onJumpToMove,
  onFlashPoint,
  boardSize,
  totalMoves,
  onAnalyzeMove,
  ttsEnabled,
  ttsAutoPlay
}: {
  message: ChatMessage
  t: UiTranslator
  onJumpToMove: (moveNumber: number) => void
  onFlashPoint: (point: string) => void
  boardSize: number
  totalMoves: number
  onAnalyzeMove: (moveNumber: number) => void
  ttsEnabled: boolean
  ttsAutoPlay: boolean
}): ReactElement {
  const keyMoves = teacherResultKeyMoves(message.result, t)
  const toolLogs = message.toolLogs ?? message.result?.toolLogs ?? []
  const isRunning = message.status === 'running'
  const isTeacher = message.role === 'teacher'
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  async function copyAssistantText(): Promise<void> {
    if (!message.content.trim()) {
      return
    }
    try {
      await copyTextToClipboard(message.content)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 1400)
    } catch {
      setCopyState('failed')
      window.setTimeout(() => setCopyState('idle'), 1800)
    }
  }
  return (
    <>
      {isTeacher && toolLogs.length > 0 ? (
        <details className="codex-tool-trace" open={isRunning || undefined}>
          <summary>{teacherToolTraceSummary(toolLogs, t)}</summary>
          <div>
            {toolLogs.map((log, index) => {
              const display = teacherToolDisplay(log, toolLogs, index, t)
              return (
                <p key={log.id} className={`codex-tool-trace__row codex-tool-trace__row--${log.status}`} aria-label={`${display.title} · ${display.status} · ${display.detail}`}>
                  <span className="codex-tool-trace__dot" aria-hidden="true" />
                  <span className="codex-tool-trace__copy">
                    <strong>{display.title}</strong>
                    <small>{display.detail}</small>
                  </span>
                  <em>{display.status}</em>
                </p>
              )
            })}
          </div>
        </details>
      ) : null}
      <div className={`message-copy ${message.role === 'teacher' ? 'message-copy--assistant' : 'message-copy--user'}`}>
        {isTeacher && !message.content && isRunning ? (
          <div className="codex-working codex-working--active">
            <span />
            <div>
              <p>{t('workingShort')}</p>
              <small>{t('workingDetail')}</small>
            </div>
          </div>
        ) : isTeacher ? (
          <>
            {message.content.trim() ? (
              <div className="assistant-copybar">
                <button type="button" onClick={() => void copyAssistantText()} aria-label={t('copyTeacherReply')}>
                  {copyState === 'copied' ? t('copied') : copyState === 'failed' ? t('copyFailed') : t('copy')}
                </button>
              </div>
            ) : null}
            <ChatMarkdown text={message.content} boardSize={boardSize} totalMoves={totalMoves} t={t} onJumpToMove={onJumpToMove} onFlashPoint={onFlashPoint} />
            {isRunning ? <span className="streaming-cursor" aria-label={t('streaming')} /> : null}
            <TeacherSpeechControls
              markdown={message.content}
              result={message.result}
              autoPlay={ttsEnabled && ttsAutoPlay && !isRunning && message.status !== 'error'}
              disabled={!ttsEnabled || isRunning || message.status === 'error' || !message.content.trim()}
            />
          </>
        ) : message.content}
      </div>
      {keyMoves.length > 0 ? (
        <div className="codex-keymove-strip" aria-label={t('keyMoveJump')}>
          {keyMoves.map((move) => (
            <button key={`${move.moveNumber}-${move.title}`} type="button" onClick={() => onJumpToMove(move.moveNumber)}>
              <span>{move.title}</span>
              <em>{move.severity}</em>
              <small>{move.summary}</small>
            </button>
          ))}
          <button type="button" className="codex-keymove-strip__analyze" onClick={() => onAnalyzeMove(keyMoves[0].moveNumber)}>
            {t('expandThisMove')}
          </button>
        </div>
      ) : null}
    </>
  )
}

function TeacherPanel({
  messages,
  prompt,
  busy,
  dashboard,
  t,
  error,
  teacherSessions,
  teacherSessionId,
  onPrompt,
  onQuickPrompt,
  onSubmit,
  onStop,
  onPersonaSettingsSaved,
  onAnalyze,
  onAnalyzeGame,
  onAnalyzeRecent,
  onJumpToMove,
  onFlashPoint,
  boardSize,
  totalMoves,
  onAnalyzeMove,
  onNewTeacherSession,
  onRestoreTeacherSession,
  onDeleteTeacherSession
}: {
  messages: ChatMessage[]
  prompt: string
  busy: string
  dashboard: DashboardData
  t: UiTranslator
  error: string
  teacherSessions: TeacherSession[]
  teacherSessionId: string
  onPrompt: (value: string) => void
  onQuickPrompt: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onStop: () => void
  onPersonaSettingsSaved: (dashboard: DashboardData) => void
  onAnalyze: () => void
  onAnalyzeGame: () => void
  onAnalyzeRecent: () => void
  onJumpToMove: (moveNumber: number) => void
  onFlashPoint: (point: string) => void
  boardSize: number
  totalMoves: number
  onAnalyzeMove: (moveNumber: number) => void
  onNewTeacherSession: () => void
  onRestoreTeacherSession: (sessionId: string) => void
  onDeleteTeacherSession: (sessionId: string) => void
}): ReactElement {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [studentSettingsOpen, setStudentSettingsOpen] = useState(true)
  const [teacherSettingsOpen, setTeacherSettingsOpen] = useState(true)
  const [historyQuery, setHistoryQuery] = useState('')
  const [personaSettings, setPersonaSettings] = useState<TeacherPersonaUiSettings>(() => readPersonaUiSettings(dashboard.settings))
  const [draftPersonaSettings, setDraftPersonaSettings] = useState<TeacherPersonaUiSettings>(() => readPersonaUiSettings(dashboard.settings))
  const [personaSaveError, setPersonaSaveError] = useState('')
  const hasRunningTask = busy === 'teacher'
  const hasRunningMessage = messages.some((message) => message.role === 'teacher' && message.status === 'running')
  const visibleSessions = useMemo(() => {
    const query = historyQuery.trim().toLowerCase()
    return teacherSessions
      .filter((session) => {
        if (!hasVisibleTeacherSessionContent(session)) return false
        if (!query) return true
        return `${session.title} ${teacherSessionContext(session, t)} ${teacherSessionPreview(session)}`.toLowerCase().includes(query)
      })
      .slice(0, 24)
  }, [historyQuery, teacherSessions, t])
  const todaySessions = visibleSessions.filter((session) => isTodayDate(session.updatedAt))
  const yesterdaySessions = visibleSessions.filter((session) => !isTodayDate(session.updatedAt) && isYesterdayDate(session.updatedAt))
  const earlierSessions = visibleSessions.filter((session) => !isTodayDate(session.updatedAt) && !isYesterdayDate(session.updatedAt))
  const threadBottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const next = readPersonaUiSettings(dashboard.settings)
    setPersonaSettings(next)
    if (!settingsOpen) setDraftPersonaSettings(next)
  }, [
    dashboard.settings.defaultCoachLevel,
    dashboard.settings.defaultStudentRank,
    dashboard.settings.defaultStudentAge,
    dashboard.settings.defaultStudentAgeRange,
    dashboard.settings.teacherStyle,
    dashboard.settings.teacherTerminologyDensity,
    dashboard.settings.teacherExplanationPace,
    dashboard.settings.teacherVariationDetail,
    settingsOpen
  ])

  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy, error])

  useEffect(() => {
    if (!historyOpen && !settingsOpen) return undefined
    const handler = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeOverlays()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [historyOpen, settingsOpen, personaSettings])

  function patchDraftPersona(next: Partial<TeacherPersonaUiSettings>): void {
    setPersonaSaveError('')
    setDraftPersonaSettings((current) => ({ ...current, ...next }))
  }

  function patchDraftRank(rank: StudentRank): void {
    patchDraftPersona({
      defaultStudentRank: rank,
      defaultCoachLevel: coachLevelFromRank(rank)
    })
  }

  function patchDraftAge(value: string): void {
    const age = value.trim() ? Math.max(0, Math.min(120, Number(value))) : 0
    const safeAge = Number.isFinite(age) ? Math.round(age) : 0
    patchDraftPersona({
      defaultStudentAge: safeAge,
      defaultStudentAgeRange: ageRangeFromExactAge(safeAge)
    })
  }

  async function saveTeacherPersona(): Promise<void> {
    setPersonaSaveError('')
    try {
      const updated = await window.goagent.updateSettings(draftPersonaSettings)
      const nextSettings = readPersonaUiSettings(updated.settings)
      onPersonaSettingsSaved(updated)
      setPersonaSettings(nextSettings)
      setDraftPersonaSettings(nextSettings)
      setSettingsOpen(false)
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : String(cause)
      setPersonaSaveError(t('saveFailed', { error: message }))
    }
  }

  function closeOverlays(): void {
    setHistoryOpen(false)
    setSettingsOpen(false)
    setPersonaSaveError('')
    setDraftPersonaSettings(personaSettings)
  }

  function toggleSettings(): void {
    setHistoryOpen(false)
    setSettingsOpen((open) => {
      if (open) {
        setDraftPersonaSettings(personaSettings)
        setPersonaSaveError('')
        return false
      }
      setDraftPersonaSettings(personaSettings)
      setPersonaSaveError('')
      return true
    })
  }

  function renderHistorySection(label: string, sessions: TeacherSession[]): ReactElement | null {
    if (sessions.length === 0) return null
    return (
      <section className="teacher-history-section">
        <h4>{label}</h4>
        <div className="teacher-history-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`teacher-history-item${session.id === teacherSessionId ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className="teacher-history-item__restore"
                onClick={() => {
                  onRestoreTeacherSession(session.id)
                  setHistoryOpen(false)
                }}
              >
                <span className="teacher-history-item__main">
                  <strong>{session.title}</strong>
                  <small>{formatTeacherSessionTime(session.updatedAt)} · {teacherSessionContext(session, t) || t('freeChat')}</small>
                  <em>{teacherSessionPreview(session)}</em>
                </span>
                <span className="teacher-history-item__icon">↺</span>
              </button>
              <button
                type="button"
                className="teacher-history-item__delete"
                aria-label={`${t('deleteSession')} ${session.title}`}
                title={t('deleteSession')}
                onClick={() => onDeleteTeacherSession(session.id)}
                disabled={busy !== ''}
              >
                {t('delete')}
              </button>
              {session.archivedAt ? <span className="teacher-history-item__archived">{t('archived')}</span> : null}
            </div>
          ))}
        </div>
      </section>
    )
  }
  return (
    <div className="teacher-panel teacher-agent-editor">
      <header className="teacher-editor-head">
        <div className="teacher-editor-title">
          <span className="teacher-contract-copy">{t('teacherThread')}</span>
          <strong>{t('teacherPanelTitle')}</strong>
        </div>
        <div className="teacher-editor-actions">
          <button
            type="button"
            title={t('newSession')}
            aria-label={t('newSession')}
            onClick={() => {
              closeOverlays()
              onNewTeacherSession()
            }}
            disabled={busy !== ''}
          >
            <span>＋</span>
          </button>
          <button
            type="button"
            className={historyOpen ? 'is-active' : ''}
            title={t('historySession')}
            aria-label={t('historySession')}
            aria-pressed={historyOpen}
            onClick={() => {
              setHistoryOpen((open) => !open)
              setSettingsOpen(false)
              setDraftPersonaSettings(personaSettings)
            }}
          >
            <span>◷</span>
          </button>
          <button
            type="button"
            className={settingsOpen ? 'is-active' : ''}
            title={t('teachingSettings')}
            aria-label={t('teachingSettings')}
            aria-pressed={settingsOpen}
            onClick={toggleSettings}
          >
            <span>☷</span>
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <aside className="teacher-persona-popover" aria-label={t('teachingSettings')}>
          <div className="teacher-popover-head">
            <strong>{t('teachingSettings')}</strong>
            <span>{t('teachingSettingsHelp')}</span>
            <button
              type="button"
              aria-label={t('closeTeachingSettings')}
              onClick={() => {
                setDraftPersonaSettings(personaSettings)
                setPersonaSaveError('')
                setSettingsOpen(false)
              }}
            >
              ×
            </button>
          </div>
          <section className="teacher-setting-block">
            <button type="button" className="teacher-setting-block__title" onClick={() => setStudentSettingsOpen((open) => !open)}>
              <span>♙</span>
              <strong>{t('studentSettings')}</strong>
              <em>{studentSettingsOpen ? '⌃' : '⌄'}</em>
            </button>
            {studentSettingsOpen ? (
              <div className="teacher-setting-fields">
                <label className="teacher-field-row">
                  <span>{t('rank')}</span>
                  <select
                    value={draftPersonaSettings.defaultStudentRank}
                    onChange={(event) => patchDraftRank(event.target.value as StudentRank)}
                    disabled={busy !== ''}
                  >
                    {PERSONA_RANK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{rankLabel(t, option.value)}</option>)}
                  </select>
                </label>
                <div className="teacher-segmented teacher-segmented--rank" aria-label={t('rankQuickSelect')}>
                  {PERSONA_RANK_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={option.value === draftPersonaSettings.defaultStudentRank ? 'is-active' : ''}
                      onClick={() => patchDraftRank(option.value)}
                      disabled={busy !== ''}
                    >
                      {rankLabel(t, option.value)}
                    </button>
                  ))}
                </div>
                <label className="teacher-field-row">
                  <span>{t('age')}</span>
                  <div className="teacher-age-stepper">
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={draftPersonaSettings.defaultStudentAge || ''}
                      onChange={(event) => patchDraftAge(event.target.value)}
                      placeholder={t('ageEmpty')}
                      disabled={busy !== ''}
                    />
                    <span>{t('yearsOld')}</span>
                    <button type="button" aria-label={t('increaseAge')} onClick={() => patchDraftAge(String((draftPersonaSettings.defaultStudentAge || 0) + 1))} disabled={busy !== ''}>⌃</button>
                    <button type="button" aria-label={t('decreaseAge')} onClick={() => patchDraftAge(String(Math.max(0, (draftPersonaSettings.defaultStudentAge || 0) - 1)))} disabled={busy !== ''}>⌄</button>
                  </div>
                </label>
              </div>
            ) : null}
          </section>
          <section className="teacher-setting-block">
            <button type="button" className="teacher-setting-block__title" onClick={() => setTeacherSettingsOpen((open) => !open)}>
              <span>♙</span>
              <strong>{t('teacherSettings')}</strong>
              <em>{teacherSettingsOpen ? '⌃' : '⌄'}</em>
            </button>
            {teacherSettingsOpen ? (
              <div className="teacher-setting-fields">
                <label className="teacher-field-label">{t('teacherStyle')}</label>
                <div className="teacher-segmented teacher-segmented--wrap" aria-label={t('teacherStyle')}>
                  {PERSONA_STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={option.value === draftPersonaSettings.teacherStyle ? 'is-active' : ''}
                      onClick={() => patchDraftPersona({ teacherStyle: option.value })}
                      disabled={busy !== ''}
                    >
                      {teacherStyleLabel(t, option.value)}
                    </button>
                  ))}
                </div>
                <label className="teacher-field-label">{t('terminologyDensity')}</label>
                <div className="teacher-density-slider">
                  <span>{t('low')}</span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    value={TERMINOLOGY_DENSITY_OPTIONS.findIndex((option) => option.value === draftPersonaSettings.teacherTerminologyDensity)}
                    onChange={(event) => patchDraftPersona({ teacherTerminologyDensity: TERMINOLOGY_DENSITY_OPTIONS[Number(event.target.value)]?.value ?? 'medium' })}
                    disabled={busy !== ''}
                  />
                  <span>{t('high')}</span>
                  <b>{terminologyDensityLabel(t, draftPersonaSettings.teacherTerminologyDensity)}</b>
                </div>
                <label className="teacher-field-label">{t('explanationPace')}</label>
                <div className="teacher-segmented teacher-segmented--three" aria-label={t('explanationPace')}>
                  {EXPLANATION_PACE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={option.value === draftPersonaSettings.teacherExplanationPace ? 'is-active' : ''}
                      onClick={() => patchDraftPersona({ teacherExplanationPace: option.value })}
                      disabled={busy !== ''}
                    >
                      {explanationPaceLabel(t, option.value)}
                    </button>
                  ))}
                </div>
                <label className="teacher-field-label">{t('variationDetail')}</label>
                <div className="teacher-segmented teacher-segmented--three" aria-label={t('variationDetail')}>
                  {VARIATION_DETAIL_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={option.value === draftPersonaSettings.teacherVariationDetail ? 'is-active' : ''}
                      onClick={() => patchDraftPersona({ teacherVariationDetail: option.value })}
                      disabled={busy !== ''}
                    >
                      {variationDetailLabel(t, option.value)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
          {personaSaveError ? <p className="teacher-popover-error" role="alert">{personaSaveError}</p> : null}
          <footer className="teacher-popover-foot">
            <button type="button" onClick={() => setDraftPersonaSettings(defaultPersonaUiSettings())}>{t('reset')}</button>
            <button type="button" className="is-primary" onClick={() => void saveTeacherPersona()}>{t('done')}</button>
          </footer>
        </aside>
      ) : null}

      {historyOpen ? (
        <aside className="teacher-history-drawer" aria-label={t('historySession')}>
          <div className="teacher-history-head">
            <strong>{t('historySession')}</strong>
            <button type="button" aria-label={t('historySession')} onClick={() => setHistoryOpen(false)}>×</button>
          </div>
          <div className="teacher-history-search" role="search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label={t('searchHistory')}
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder={t('searchHistory')}
            />
            {historyQuery ? (
              <button type="button" aria-label={t('clearSearch')} onClick={() => setHistoryQuery('')}>×</button>
            ) : null}
          </div>
          <div className="teacher-history-scroll">
            {visibleSessions.length === 0 ? (
              <p className="teacher-history-empty">{t('noHistoryMatched')}</p>
            ) : (
              <>
                {renderHistorySection(t('today'), todaySessions)}
                {renderHistorySection(t('yesterday'), yesterdaySessions)}
                {renderHistorySection(t('earlier'), earlierSessions)}
              </>
            )}
          </div>
          <footer className="teacher-history-foot">
            <span>{t('sessionRetention')}</span>
            <button type="button" aria-label={t('historySettings')}>⚙</button>
          </footer>
        </aside>
      ) : null}

      <div
        className={`message-list agent-thread ${messages.length === 0 && !hasRunningTask ? 'agent-thread--empty' : ''}`}
        aria-label={t('teacherThread')}
      >
        {messages.length === 0 && !hasRunningTask ? (
          <section className="teacher-empty-state" aria-label={t('teacherEmptyTitle')}>
            <div className="teacher-empty-state__bubble" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <strong>{t('teacherEmptyTitle')}</strong>
            <p>{t('teacherEmptyDescription')}</p>
            <div className="teacher-empty-state__prompts" aria-label={t('sampleQuestions')}>
              {teacherEmptyPrompts(t).map((item) => (
                <button key={item} type="button" onClick={() => onQuickPrompt(item)} disabled={busy !== ''}>
                  {item}
                </button>
              ))}
            </div>
          </section>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={`message message--${message.role} agent-turn agent-turn--${message.role}`}>
              <div className="agent-turn__body">
                <header className="agent-turn__head">
                  <strong>{message.role === 'teacher' ? BRAND_NAME : t('user')}</strong>
                  <small>{message.status ?? (message.result ? t('completed') : message.role === 'teacher' ? t('assistant') : t('prompt'))}</small>
                </header>
                <TeacherInlineResponse
                  message={message}
                  t={t}
                  onJumpToMove={onJumpToMove}
                  onFlashPoint={onFlashPoint}
                  boardSize={boardSize}
                  totalMoves={totalMoves}
                  onAnalyzeMove={onAnalyzeMove}
                  ttsEnabled={dashboard.settings.ttsEnabled}
                  ttsAutoPlay={dashboard.settings.ttsAutoPlay}
                />
              </div>
            </article>
          ))
        )}
        {hasRunningTask && !hasRunningMessage ? (
          <div className="message message--teacher message--running agent-turn agent-turn--teacher agent-turn--running">
            <div className="agent-turn__body">
              <header className="agent-turn__head">
                <strong>{BRAND_NAME}</strong>
                <small>{t('running')}</small>
              </header>
              <div className="codex-working">
                <span />
                <p>{t('teacherThinking')}</p>
              </div>
            </div>
          </div>
        ) : null}
        <div ref={threadBottomRef} className="agent-thread__bottom" />
      </div>

      {error ? <div className="error-line">{error}</div> : null}
      <TeacherComposerPro
        value={prompt}
        busy={busy !== ''}
        onChange={onPrompt}
        onSubmit={onSubmit}
        onStop={onStop}
        t={t}
      />
    </div>
  )
}

function SettingsDrawer({
  dashboard,
  katagoAssets,
  busy,
  t,
  llmTestMessage,
  katagoBenchmark,
  katagoBenchmarkMessage,
  katagoInstallMessage,
  katagoInstallProgress,
  onSave,
  onTest,
  onBenchmark,
  onInstallOfficialModel,
  onRefreshKataGoAssets,
  onDashboardUpdated
}: {
  dashboard: DashboardData
  katagoAssets: KataGoAssetStatus | null
  busy: string
  t: UiTranslator
  llmTestMessage: string
  katagoBenchmark: KataGoBenchmarkResult | null
  katagoBenchmarkMessage: string
  katagoInstallMessage: string
  katagoInstallProgress: KataGoAssetInstallProgress | null
  onSave: (form: HTMLFormElement) => void
  onTest: (form: HTMLFormElement) => void
  onBenchmark: () => void
  onInstallOfficialModel: (presetId: KataGoModelPresetId) => void
  onRefreshKataGoAssets: () => void
  onDashboardUpdated: (dashboard: DashboardData) => void
}): ReactElement {
  const [releaseReadiness, setReleaseReadiness] = useState<ReleaseReadinessResult | null>(null)
  const [releaseReadinessError, setReleaseReadinessError] = useState('')
  const [refreshedLlmModels, setRefreshedLlmModels] = useState<string[]>([])
  const [llmModelsFetched, setLlmModelsFetched] = useState(false)
  const [llmModelsRefreshing, setLlmModelsRefreshing] = useState(false)
  const [llmModelRefreshMessage, setLlmModelRefreshMessage] = useState('')
  const [selectedLlmModel, setSelectedLlmModel] = useState(dashboard.settings.llmModel)
  const [savedLlmApiKey, setSavedLlmApiKey] = useState('')
  const [showLlmApiKey, setShowLlmApiKey] = useState(false)
  const [llmKeyMessage, setLlmKeyMessage] = useState('')
  const modelPresets = dashboard.systemProfile.katagoModelPresets
  const [selectedPresetId, setSelectedPresetId] = useState<KataGoModelPresetId>(dashboard.settings.katagoModelPreset)
  const selectedPreset = modelPresets.find((preset) => preset.id === selectedPresetId) ?? modelPresets[0]
  const localeOptions = SUPPORTED_UI_LOCALES
  const fallbackLlmModelOptions = uniqueModelOptions([
    selectedLlmModel,
    dashboard.settings.llmModel,
    ...dashboard.systemProfile.proxyModels,
    ...fallbackLlmModels
  ])
  const llmModelOptions = llmModelsFetched ? refreshedLlmModels : fallbackLlmModelOptions
  const groupedModelPresets = useMemo(() => {
    const groups = new Map<string, typeof modelPresets>()
    for (const preset of modelPresets) {
      const group = translateKataGoPresetGroup(preset.group, t)
      groups.set(group, [...(groups.get(group) ?? []), preset])
    }
    const groupOrder = [
      t('modelGroupZhizi'),
      t('modelGroupB18'),
      t('modelGroupB20'),
      t('modelGroupB28'),
      t('modelGroupB40')
    ]
    return [...groups.entries()].sort(([left], [right]) => {
      const leftIndex = groupOrder.indexOf(left)
      const rightIndex = groupOrder.indexOf(right)
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex)
    })
  }, [modelPresets, t])
  const betaItems = useMemo<BetaAcceptanceItem[]>(() => {
    if (releaseReadiness) {
      return releaseReadiness.items.map((item) => ({
        id: item.id,
        label: item.label,
        status: item.status,
        detail: item.detail
      }))
    }
    return [
      {
        id: 'katago-assets',
        label: t('katagoBundledAssets'),
        status: katagoAssets?.ready ? 'pass' : katagoAssets?.manifestFound ? 'warn' : 'fail',
        detail: katagoAssets?.detail ?? localizeKataGoStatus(
          dashboard.systemProfile.katagoStatus,
          dashboard.systemProfile.katagoModelPresets,
          dashboard.systemProfile.katagoModelPreset,
          t
        )
      },
      {
        id: 'llm-provider',
        label: t('claudeProxy'),
        status: dashboard.systemProfile.hasLlmApiKey ? 'pass' : 'warn',
        detail: dashboard.systemProfile.hasLlmApiKey ? t('llmModelDetail', { model: dashboard.settings.llmModel }) : t('llmApiMissingDetail')
      },
      {
        id: 'knowledge',
        label: t('localKnowledgeBase'),
        status: 'pass',
        detail: t('knowledgePackaged')
      },
      {
        id: 'teacher-ui',
        label: t('teacherAgentUi'),
        status: 'pass',
        detail: t('teacherUiReadyDetail')
      }
    ]
  }, [dashboard.settings.llmModel, dashboard.systemProfile.hasLlmApiKey, dashboard.systemProfile.katagoStatus, katagoAssets, releaseReadiness, t])

  async function refreshReleaseReadiness(): Promise<void> {
    try {
      setReleaseReadinessError('')
      if (!window.goagent.getReleaseReadiness) {
        return
      }
      setReleaseReadiness(await window.goagent.getReleaseReadiness())
    } catch (cause) {
      setReleaseReadinessError(t('releaseReadinessFailed', { error: String(cause) }))
    }
  }

  async function refreshLlmModels(form: HTMLFormElement | null): Promise<void> {
    setLlmModelsRefreshing(true)
    setLlmModelRefreshMessage('')
    try {
      const formData = new FormData(form ?? undefined)
      const result = await window.goagent.listLlmModels({
        llmBaseUrl: String(formData.get('llmBaseUrl') ?? dashboard.settings.llmBaseUrl),
        llmApiKey: String(formData.get('llmApiKey') ?? '')
      })
      if (result.ok) {
        const models = uniqueModelOptions(result.models)
        setRefreshedLlmModels(models)
        setLlmModelsFetched(true)
        if (!models.length) {
          setSelectedLlmModel('')
        } else if (!models.includes(selectedLlmModel)) {
          setSelectedLlmModel(
            models.includes('gpt-5.5')
              ? 'gpt-5.5'
              : models.includes(dashboard.settings.llmModel)
                ? dashboard.settings.llmModel
                : models[0]
          )
        }
      }
      setLlmModelRefreshMessage(result.message)
    } catch (cause) {
      setLlmModelRefreshMessage(t('modelRefreshFailed', { error: String(cause) }))
    } finally {
      setLlmModelsRefreshing(false)
    }
  }

  useEffect(() => {
    void refreshReleaseReadiness()
  }, [])

  useEffect(() => {
    setSelectedPresetId(dashboard.settings.katagoModelPreset)
  }, [dashboard.settings.katagoModelPreset])

  useEffect(() => {
    setSelectedLlmModel(dashboard.settings.llmModel)
  }, [dashboard.settings.llmModel])

  async function revealSavedLlmApiKey(): Promise<void> {
    setLlmKeyMessage('')
    try {
      const result = await window.goagent.getSavedLlmApiKey()
      if (!result.hasKey || !result.apiKey) {
        setSavedLlmApiKey('')
        setShowLlmApiKey(false)
        setLlmKeyMessage(t('apiKeyMissingMessage'))
        return
      }
      setSavedLlmApiKey(result.apiKey)
      setShowLlmApiKey(true)
    } catch (cause) {
      setLlmKeyMessage(t('apiKeyReadFailed', { error: String(cause) }))
    }
  }

  async function saveTtsSettings(next: Partial<AppSettings>): Promise<void> {
    const updated = await window.goagent.updateSettings(next)
    onDashboardUpdated(updated)
  }

  return (
    <div className="settings-drawer">
      <form
        key={`${dashboard.settings.katagoModelPreset}|${dashboard.settings.llmBaseUrl}|${dashboard.settings.llmModel}|${dashboard.settings.reviewLanguage}`}
        className="settings-drawer__form"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(event.currentTarget)
        }}
      >
      <label className="katago-preset-select">
        {t('katagoWeights')}
        <select
          name="katagoModelPreset"
          value={selectedPresetId}
          onChange={(event) => setSelectedPresetId(event.target.value as KataGoModelPresetId)}
        >
          {groupedModelPresets.map(([group, presets]) => (
            <optgroup key={group} label={group}>
              {presets.map((preset) => {
                const presetCopy = translateKataGoPreset(preset, t)
                return (
                  <option key={preset.id} value={preset.id}>
                    {presetCopy.label} · {presetCopy.badge} · {presetCopy.sizeHint}
                  </option>
                )
              })}
            </optgroup>
          ))}
        </select>
        {selectedPreset ? <small>{translateKataGoPreset(selectedPreset, t).description}</small> : null}
      </label>
      <KataGoAssetsPanel
        status={katagoAssets}
        selectedPreset={selectedPreset}
        busy={busy === 'katago-install'}
        installProgress={katagoInstallProgress}
        installMessage={katagoInstallMessage}
        onInstall={() => onInstallOfficialModel(selectedPreset?.id ?? dashboard.settings.katagoModelPreset)}
        onRefresh={onRefreshKataGoAssets}
        t={t}
      />
      <KataGoBenchmarkPanel
        settings={dashboard.settings}
        result={katagoBenchmark}
        message={katagoBenchmarkMessage}
        busy={busy === 'katago-benchmark'}
        onRun={onBenchmark}
        t={t}
      />
      <BetaAcceptancePanel
        items={betaItems}
        flags={releaseReadiness?.flags}
        onRunChecks={() => {
          void refreshReleaseReadiness()
          onRefreshKataGoAssets()
        }}
        t={t}
      />
      {releaseReadinessError ? <div className="test-message">{releaseReadinessError}</div> : null}
      <section className="settings-section settings-section-language">
        <h3>{t('languageLabel')}</h3>
        <p>{t('languageHelp')}</p>
        <label>
          <span>{t('reviewLanguage')}</span>
          <select name="reviewLanguage" defaultValue={dashboard.settings.reviewLanguage}>
            {localeOptions.map((locale) => (
              <option key={locale.value} value={locale.value}>
                {locale.label}
              </option>
            ))}
          </select>
        </label>
      </section>
      <label>
        {t('llmBaseUrl')}
        <input
          className="llm-config-input"
          name="llmBaseUrl"
          defaultValue={dashboard.settings.llmBaseUrl}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <small>{t('currentApi', { url: dashboard.settings.llmBaseUrl || t('apiNotSet') })}</small>
      </label>
      <div className="llm-api-key-field">
        <label>
        {t('llmApiKey')}
          <div className="llm-secret-input-row">
            <input
              className="llm-config-input"
              name="llmApiKey"
              type={showLlmApiKey ? 'text' : 'password'}
              defaultValue={showLlmApiKey ? savedLlmApiKey : ''}
              placeholder={dashboard.systemProfile.hasLlmApiKey ? t('apiKeySavedPlaceholder') : t('apiKeyNeededPlaceholder')}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              className="ghost-button"
              type="button"
              onClick={() => showLlmApiKey ? setShowLlmApiKey(false) : void revealSavedLlmApiKey()}
              disabled={busy !== ''}
            >
              {showLlmApiKey ? t('hide') : t('showKey')}
            </button>
          </div>
        </label>
        <small>{showLlmApiKey ? t('apiKeyShownHelp') : dashboard.systemProfile.hasLlmApiKey ? t('apiKeySavedHelp') : t('apiKeyMissingHelp')}</small>
        {llmKeyMessage ? <small>{llmKeyMessage}</small> : null}
      </div>
      <label>
        {t('multimodalModel')}
        <div className="llm-model-picker">
          <select
            className="llm-model-select"
            name="llmModel"
            value={selectedLlmModel}
            onChange={(event) => setSelectedLlmModel(event.target.value)}
            aria-label={t('selectMultimodalModel')}
          >
            {llmModelOptions.length ? (
              llmModelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))
            ) : (
              <option value="" disabled>
                {t('noModelReturned')}
              </option>
            )}
          </select>
          <button
            className="ghost-button"
            type="button"
            onClick={(event) => void refreshLlmModels(event.currentTarget.form)}
            disabled={busy !== '' || llmModelsRefreshing}
          >
            {llmModelsRefreshing ? t('refreshing') : t('refreshModels')}
          </button>
        </div>
        <small>{t('modelPickerHelp')}</small>
        {llmModelRefreshMessage ? <small>{llmModelRefreshMessage}</small> : null}
      </label>
      <div className="settings-actions">
        <button className="ghost-button" type="button" onClick={(event) => onTest(event.currentTarget.form!)} disabled={busy !== ''}>
          {t('imageTest')}
        </button>
        <button className="primary-button" type="submit" disabled={busy !== ''}>
          {t('save')}
        </button>
      </div>
      {llmTestMessage ? <div className="test-message">{llmTestMessage}</div> : null}
      </form>
      <TtsSettingsPanel
        settings={dashboard.settings}
        busy={busy !== ''}
        onSave={(next) => void saveTtsSettings(next)}
      />
    </div>
  )
}

function KataGoBenchmarkPanel({
  settings,
  result,
  message,
  busy,
  onRun,
  t
}: {
  settings: DashboardData['settings']
  result: KataGoBenchmarkResult | null
  message: string
  busy: boolean
  onRun: () => void
  t: UiTranslator
}): ReactElement {
  const bestThreads = result?.recommendedThreads || settings.katagoBenchmarkThreads
  const bestSpeed = result?.visitsPerSecond || settings.katagoBenchmarkVisitsPerSecond
  const tunedAt = result?.updatedAt || settings.katagoBenchmarkUpdatedAt
  return (
    <section className="runtime-card katago-benchmark-card">
      <header>
        <strong>{t('katagoBenchmarkTitle')}</strong>
        <span className={bestThreads ? 'runtime-pill runtime-pill--ready' : 'runtime-pill runtime-pill--warn'}>
          {bestThreads ? `${bestThreads} threads` : t('benchmarkNotRun')}
        </span>
      </header>
      <p>{t('benchmarkDescription')}</p>
      <div className="runtime-list">
        <div><span>{t('recommendedThreads')}</span><strong>{bestThreads || t('benchmarkPending')}</strong></div>
        <div><span>{t('benchmarkSpeed')}</span><strong>{bestSpeed ? formatSearchSpeed(bestSpeed) : t('benchmarkPending')}</strong></div>
        <div><span>{t('analysisConfig')}</span><strong>{settings.katagoAnalysisThreads || 'auto'} × {settings.katagoSearchThreadsPerAnalysisThread || 1}</strong></div>
        <div><span>{t('batchSize')}</span><strong>{settings.katagoMaxBatchSize || 32}</strong></div>
        {tunedAt ? <div><span>{t('updatedAt')}</span><strong>{new Date(tunedAt).toLocaleString()}</strong></div> : null}
      </div>
      <button className="primary-button" type="button" onClick={onRun} disabled={busy}>
        {busy ? t('benchmarkRunning') : t('benchmarkRun')}
      </button>
      {message ? <p className="test-message">{message}</p> : null}
      {result?.tested.length ? (
        <div className="benchmark-results">
          {result.tested.map((item) => (
            <span key={item.threads}>{item.threads}T · {formatSearchSpeed(item.visitsPerSecond)}</span>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function ToolLogList({ result }: { result: TeacherRunResult }): ReactElement {
  const statusLabel: Record<string, string> = {
    running: '运行中',
    done: '完成',
    error: '错误',
    skipped: '跳过'
  }
  return (
    <details className="tool-log">
      <summary>工具执行日志 · {result.toolLogs.length} 步</summary>
      {result.toolLogs.map((log) => (
        <div key={log.id} className={`tool-log-row tool-log-row--${log.status}`}>
          <span>
            {log.label}
            <em>{statusLabel[log.status] ?? log.status}</em>
          </span>
          <small>{log.detail}</small>
        </div>
      ))}
      {result.reportPath ? <small className="report-path">报告: {result.reportPath}</small> : null}
    </details>
  )
}

function MoveControls({ record, moveNumber, onMove }: { record: GameRecord | null; moveNumber: number; onMove: (value: number) => void }): ReactElement {
  const total = record?.moves.length ?? 0
  const current = moveNumber > 0 ? record?.moves[moveNumber - 1] : undefined
  return (
    <div className="move-controls">
      <div className="move-buttons">
        <button className="icon-button" onClick={() => onMove(0)} disabled={!record || moveNumber === 0}>
          {'|<'}
        </button>
        <button className="icon-button" onClick={() => onMove(Math.max(0, moveNumber - 10))} disabled={!record || moveNumber === 0}>
          -10
        </button>
        <button className="icon-button" onClick={() => onMove(Math.max(0, moveNumber - 1))} disabled={!record || moveNumber === 0}>
          {'<'}
        </button>
        <button className="icon-button" onClick={() => onMove(Math.min(total, moveNumber + 1))} disabled={!record || moveNumber === total}>
          {'>'}
        </button>
        <button className="icon-button" onClick={() => onMove(Math.min(total, moveNumber + 10))} disabled={!record || moveNumber === total}>
          +10
        </button>
        <button className="icon-button" onClick={() => onMove(total)} disabled={!record || moveNumber === total}>
          {'>|'}
        </button>
      </div>
      <div className="move-meta">
        <strong>{moveNumber}</strong>
        <span>/ {total}</span>
        <span>{current ? `${current.color === 'B' ? '黑' : '白'} ${current.gtp}` : '开局'}</span>
      </div>
    </div>
  )
}

function BoardContextBar({
  title,
  record,
  moveNumber,
  analysis,
  liveAnalysis,
  disabled,
  onStart,
  onPause,
  t
}: {
  title: string
  record: GameRecord
  moveNumber: number
  analysis: KataGoMoveAnalysis | null
  liveAnalysis: LiveAnalysisState
  disabled: boolean
  onStart: () => void
  onPause: () => void
  t: UiTranslator
}): ReactElement {
  const current = moveNumber > 0 ? record.moves[moveNumber - 1] : undefined
  const scoreLead = analysis?.after.scoreLead
  const winrate = analysis?.after.winrate
  const isCurrentLiveTarget = liveAnalysis.targetMoveNumber === moveNumber
  const totalVisits = isCurrentLiveTarget ? liveAnalysis.visits : candidateVisitsTotal(analysis)
  const bestVisits = isCurrentLiveTarget ? liveAnalysis.bestVisits : candidateBestVisits(analysis)
  const status = isCurrentLiveTarget
    ? liveAnalysis.status
    : (analysis ? t('analysisSearched', { visits: formatVisits(totalVisits) }) : t('analysisWaiting'))
  const speedLabel = isCurrentLiveTarget && liveAnalysis.visitsPerSecond > 0
    ? formatSearchSpeed(liveAnalysis.visitsPerSecond)
    : '—'
  return (
    <div className="board-contextbar">
      <div className="board-contextbar__identity">
        <h1>{title}</h1>
        <span>{moveNumber}/{record.moves.length}</span>
        <em>{current ? `${current.color === 'B' ? t('black') : t('white')} ${current.gtp}` : t('opening')}</em>
      </div>
      <div className="board-contextbar__metrics" aria-label={t('currentBoardMetrics')}>
        <div className="board-contextbar__metric">
          <span>{t('timelineBlackWinrate')}</span>
          <strong>{typeof winrate === 'number' ? `${winrate.toFixed(1)}%` : t('toAnalyze')}</strong>
        </div>
        <div className="board-contextbar__metric">
          <span>{t('timelineScoreLead')}</span>
          <strong>{formatScoreLead(scoreLead, t)}</strong>
        </div>
        <div className="board-contextbar__metric board-contextbar__metric--search">
          <span>{status}</span>
          <strong>{t('totalAndBestVisits', { total: formatVisits(totalVisits), best: formatVisits(bestVisits) })}</strong>
        </div>
        <div className="board-contextbar__metric board-contextbar__metric--speed">
          <span>{t('searchSpeed')}</span>
          <strong>{speedLabel}</strong>
        </div>
      </div>
      <div className="analysis-control-strip" aria-label="KataGo live analysis control">
        <button
          type="button"
          className={`analysis-toggle-button ${liveAnalysis.running ? 'is-running' : ''}`}
          onClick={liveAnalysis.running ? onPause : onStart}
          disabled={!liveAnalysis.running && disabled}
        >
          <span className="analysis-toggle-button__dot" />
          {liveAnalysis.running ? t('pauseAnalysis') : t('startAnalysis')}
        </button>
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundedScale(value: number, granularity: number, floor: number): number {
  return Math.max(floor, Math.ceil(Math.max(0, value) / granularity) * granularity)
}

function formatScoreLead(scoreLead: number | undefined, t?: UiTranslator): string {
  if (scoreLead === undefined) {
    return t ? t('toAnalyze') : '待分析'
  }
  if (Math.abs(scoreLead) < 0.05) {
    return t ? t('even') : '均势'
  }
  return `${scoreLead > 0 ? (t ? t('black') : '黑') : (t ? t('white') : '白')}+${Math.abs(scoreLead).toFixed(1)}`
}

function formatVisits(visits: number): string {
  if (!Number.isFinite(visits) || visits <= 0) {
    return '0'
  }
  if (visits >= 1_000_000) {
    return `${(visits / 1_000_000).toFixed(visits >= 10_000_000 ? 0 : 1)}m`
  }
  if (visits >= 1_000) {
    return `${(visits / 1_000).toFixed(visits >= 10_000 ? 0 : 1)}k`
  }
  return String(Math.round(visits))
}

function formatSearchSpeed(visitsPerSecond: number): string {
  if (!Number.isFinite(visitsPerSecond) || visitsPerSecond <= 0) {
    return '0/s'
  }
  if (visitsPerSecond >= 1000) {
    return `${(visitsPerSecond / 1000).toFixed(visitsPerSecond >= 10000 ? 0 : 1)}k/s`
  }
  return `${Math.round(visitsPerSecond)}/s`
}

function evaluationSeverity(item: KataGoMoveAnalysis): 'quiet' | 'inaccuracy' | 'mistake' | 'blunder' {
  const winrateLoss = normalizeLossPercent(item.playedMove?.winrateLoss)
  if (item.judgement === 'blunder' || winrateLoss >= 18) {
    return 'blunder'
  }
  if (item.judgement === 'mistake' || winrateLoss >= 10) {
    return 'mistake'
  }
  if (item.judgement === 'inaccuracy' || winrateLoss >= 4) {
    return 'inaccuracy'
  }
  return 'quiet'
}

function formatIssueLoss(loss: number): string {
  return `${loss.toFixed(loss >= 10 ? 0 : 1)}%`
}

function timelineIssueColorLabel(color: TimelineIssueColor, t: UiTranslator): string {
  return color === 'B' ? t('black') : t('white')
}

function TimelineIssueList({
  color,
  issues,
  currentMoveNumber,
  loading,
  onColorChange,
  onJump,
  t
}: {
  color: TimelineIssueColor
  issues: TimelineIssueItem[]
  currentMoveNumber: number
  loading: boolean
  onColorChange: (color: TimelineIssueColor) => void
  onJump: (moveNumber: number) => void
  t: UiTranslator
}): ReactElement {
  return (
    <aside className="timeline-issues" aria-label={t('issueList')}>
      <div className="timeline-issues__head">
        <div className="timeline-issues__title">
          <span>{t('issueList')}</span>
          <strong>{issues.length}</strong>
        </div>
        <div className="timeline-issues__switch" role="group" aria-label={t('choosePlayerColor')}>
          {(['B', 'W'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={item === color ? 'is-active' : ''}
              aria-pressed={item === color}
              onClick={() => onColorChange(item)}
            >
              {timelineIssueColorLabel(item, t)}
            </button>
          ))}
        </div>
      </div>
      <div className="timeline-issues__list">
        {issues.length > 0 ? issues.map((issue) => (
          <button
            key={`${issue.color}-${issue.moveNumber}`}
            type="button"
            className={`timeline-issue timeline-issue--${issue.severity} ${issue.moveNumber === currentMoveNumber ? 'is-current' : ''}`}
            onClick={() => onJump(issue.moveNumber)}
            title={t('issueTitle', { move: issue.moveNumber, loss: formatIssueLoss(issue.loss) })}
          >
            <span className="timeline-issue__move">{t('issueMove', { move: issue.moveNumber })}</span>
            <span className="timeline-issue__line">
              {issue.playedMove || t('actualMove')}{issue.bestMove ? ` → ${issue.bestMove}` : ''}
            </span>
            <strong>{formatIssueLoss(issue.loss)}</strong>
          </button>
        )) : (
          <div className="timeline-issues__empty">
            {loading ? t('loadingIssues') : t('noIssues', { color: timelineIssueColorLabel(color, t) })}
          </div>
        )}
      </div>
    </aside>
  )
}

function EvaluationGraph({
  analysis,
  evaluations,
  moveNumber,
  totalMoves,
  loading,
  loadingLabel,
  onMove
}: {
  analysis: KataGoMoveAnalysis | null
  evaluations: KataGoMoveAnalysis[]
  moveNumber: number
  totalMoves: number
  loading: boolean
  loadingLabel: string
  onMove: (value: number) => void
}): ReactElement {
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)
  const sortedEvaluations = evaluations.slice().sort((left, right) => left.moveNumber - right.moveNumber)
  const currentAnalysis = analysis ?? sortedEvaluations.find((item) => item.moveNumber === moveNumber) ?? null
  const hasEvaluations = sortedEvaluations.length > 0
  const width = 720
  const height = 168
  const plotLeft = 42
  const plotRight = 34
  const plotTop = 16
  const plotBottom = 108
  const barTop = 119
  const barBottom = 132
  const plotWidth = width - plotLeft - plotRight
  const plotHeight = plotBottom - plotTop
  const centerY = plotTop + plotHeight / 2
  const moveTickLabelY = 144
  const currentBadgeY = 149
  const currentBadgeHeight = 16
  const domainMoves = Math.max(totalMoves, 1)
  const xForMove = (move: number): number => plotLeft + (clamp(move, 0, domainMoves) / domainMoves) * plotWidth
  const lossScale = roundedScale(Math.max(...sortedEvaluations.map((item) => normalizeLossPercent(item.playedMove?.winrateLoss)), 0), 10, 10)
  const yForWinrate = (winrate: number): number => clamp(plotTop + ((100 - winrate) / 100) * plotHeight, plotTop, plotBottom)
  const winrateTicks = [
    { label: '黑100', value: 100 },
    { label: '75', value: 75 },
    { label: '50', value: 50 },
    { label: '25', value: 25 },
    { label: '白100', value: 0 }
  ]
  const moveTicks = Array.from(new Set([
    0,
    Math.round(totalMoves * 0.25),
    Math.round(totalMoves * 0.5),
    Math.round(totalMoves * 0.75),
    totalMoves
  ])).filter((tick) => tick >= 0 && tick <= totalMoves)
  const winrateSamples = sortedEvaluations.length > 0
    ? [
        { move: Math.max(0, sortedEvaluations[0].moveNumber - 1), winrate: sortedEvaluations[0].before.winrate },
        ...sortedEvaluations.map((item) => ({ move: item.moveNumber, winrate: item.after.winrate }))
      ]
    : []
  const winratePath = winrateSamples
    .map((item, index) => `${index === 0 ? 'M' : 'L'} ${xForMove(item.move).toFixed(2)} ${yForWinrate(item.winrate).toFixed(2)}`)
    .join(' ')
  const areaPath = winrateSamples.length > 0
    ? `${winratePath} L ${xForMove(winrateSamples[winrateSamples.length - 1].move).toFixed(2)} ${centerY.toFixed(2)} L ${xForMove(winrateSamples[0].move).toFixed(2)} ${centerY.toFixed(2)} Z`
    : ''
  const currentX = xForMove(moveNumber)
  const currentY = currentAnalysis ? yForWinrate(currentAnalysis.after.winrate) : centerY
  const blackWinrate = currentAnalysis?.after.winrate
  const whiteWinrate = blackWinrate === undefined ? undefined : 100 - blackWinrate
  const leadText = formatScoreLead(currentAnalysis?.after.scoreLead)
  const bestCandidate = boardDisplayCandidateMoves(currentAnalysis)[0]
  const currentLabel = currentAnalysis
    ? `第 ${moveNumber} 手，黑胜率 ${currentAnalysis.after.winrate.toFixed(1)}%，${leadText}`
    : (loading ? `KataGo 正在快速生成整盘胜率图${loadingLabel ? ` · ${loadingLabel}` : ''}` : '等待 KataGo 分析')
  const currentMoveLabel = totalMoves > 0 ? `第 ${moveNumber}/${totalMoves} 手` : '第 0 手'
  const currentBadgeWidth = clamp(68 + currentMoveLabel.length * 5, 92, 136)
  const currentBadgeX = clamp(currentX - currentBadgeWidth / 2, plotLeft, width - plotRight - currentBadgeWidth)

  function moveFromPointer(event: PointerEvent<SVGSVGElement>): number {
    const rect = event.currentTarget.getBoundingClientRect()
    const svgX = ((event.clientX - rect.left) / rect.width) * width
    const ratio = clamp((svgX - plotLeft) / plotWidth, 0, 1)
    return Math.round(ratio * totalMoves)
  }

  function selectMoveFromPointer(event: PointerEvent<SVGSVGElement>): void {
    if (totalMoves < 1) {
      return
    }
    onMove(moveFromPointer(event))
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    setDragging(true)
    selectMoveFromPointer(event)
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>): void {
    if (!draggingRef.current) {
      return
    }
    selectMoveFromPointer(event)
  }

  function handlePointerEnd(event: PointerEvent<SVGSVGElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    draggingRef.current = false
    setDragging(false)
    selectMoveFromPointer(event)
  }

  return (
    <div className="evaluation-graph">
      <svg
        className={`evaluation-canvas ${dragging ? 'is-dragging' : ''}`}
        viewBox={`0 0 ${width} ${height}`}
        role="slider"
        aria-label="KataGo 评估图"
        aria-valuemin={0}
        aria-valuemax={totalMoves}
        aria-valuenow={moveNumber}
        aria-valuetext={currentLabel}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            onMove(Math.max(0, moveNumber - 1))
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            onMove(Math.min(totalMoves, moveNumber + 1))
          }
          if (event.key === 'Home') {
            event.preventDefault()
            onMove(0)
          }
          if (event.key === 'End') {
            event.preventDefault()
            onMove(totalMoves)
          }
        }}
      >
        <title>{currentLabel}</title>
        <defs>
          <linearGradient id="evaluation-board-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#20242a" />
            <stop offset="49%" stopColor="#191d22" />
            <stop offset="51%" stopColor="#171b20" />
            <stop offset="100%" stopColor="#242018" />
          </linearGradient>
          <linearGradient id="evaluation-winrate-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e7d9b4" stopOpacity="0.28" />
            <stop offset="50%" stopColor="#d2b36a" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#d2b36a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect className="evaluation-plot" x="0" y="0" width={width} height={height} rx="6" />
        <rect className="evaluation-zone evaluation-zone--black" x={plotLeft} y={plotTop} width={plotWidth} height={plotHeight / 2} />
        <rect className="evaluation-zone evaluation-zone--white" x={plotLeft} y={centerY} width={plotWidth} height={plotHeight / 2} />
        {winrateTicks.map((tick) => (
          <g key={`winrate-tick-${tick.value}`}>
            <line className="evaluation-grid evaluation-grid--horizontal" x1={plotLeft} y1={yForWinrate(tick.value)} x2={width - plotRight} y2={yForWinrate(tick.value)} />
            <text className="evaluation-axis-label" x={plotLeft - 8} y={yForWinrate(tick.value)}>
              {tick.label}
            </text>
          </g>
        ))}
        {moveTicks.map((tick) => (
          <g key={`move-tick-${tick}`}>
            <line className="evaluation-grid evaluation-grid--vertical" x1={xForMove(tick)} y1={plotTop} x2={xForMove(tick)} y2={barBottom} />
            <text className="evaluation-move-label" x={xForMove(tick)} y={moveTickLabelY}>
              {tick}
            </text>
          </g>
        ))}
        <line className="evaluation-grid evaluation-grid--center" x1={plotLeft} y1={centerY} x2={width - plotRight} y2={centerY} />

        {hasEvaluations ? (
          <>
            <path className="evaluation-area" d={areaPath} />
            <path className="evaluation-line evaluation-line--winrate" d={winratePath} />
            {sortedEvaluations.map((item) => {
              const loss = normalizeLossPercent(item.playedMove?.winrateLoss)
              if (loss <= 0.5) {
                return null
              }
              const barHeight = clamp((loss / lossScale) * (barBottom - barTop), 1, barBottom - barTop)
              const x = xForMove(item.moveNumber)
              return <rect key={`loss-${item.moveNumber}`} className={`loss-bar loss-bar--${evaluationSeverity(item)}`} x={x - 2.5} y={barBottom - barHeight} width="5" height={barHeight} />
            })}
            {sortedEvaluations.filter((item) => evaluationSeverity(item) !== 'quiet').map((item) => (
              <circle key={`dot-${item.moveNumber}`} className={`evaluation-dot evaluation-dot--${evaluationSeverity(item)}`} cx={xForMove(item.moveNumber)} cy={yForWinrate(item.after.winrate)} r={item.moveNumber === moveNumber ? 4.2 : 2.4} />
            ))}
          </>
        ) : (
          <>
            <path className="evaluation-empty-line" d={`M ${plotLeft} ${centerY} L ${width - plotRight} ${centerY}`} />
            <text className="evaluation-empty-copy" x={plotLeft + plotWidth / 2} y={centerY - 8}>
              {loading ? `正在生成胜率图${loadingLabel ? ` · ${loadingLabel}` : ''}` : '待 KataGo 分析'}
            </text>
          </>
        )}

        <line className="evaluation-current" x1={currentX} y1={plotTop} x2={currentX} y2={barBottom} />
        <circle className="evaluation-current-dot" cx={currentX} cy={currentY} r="5.2" />
        {currentAnalysis ? (
          <g className="evaluation-readout-panel">
            <rect className="evaluation-readout-bg" x={plotLeft + 12} y="18" width="276" height="34" rx="7" />
            <text className="evaluation-readout evaluation-readout--black" x={plotLeft + 26} y="35">
              {`黑 ${blackWinrate?.toFixed(1)}%`}
            </text>
            <text className="evaluation-readout evaluation-readout--white" x={plotLeft + 98} y="35">
              {`白 ${whiteWinrate?.toFixed(1)}%`}
            </text>
            <text className="evaluation-readout evaluation-readout--lead" x={plotLeft + 172} y="35">
              {leadText}
            </text>
          </g>
        ) : null}
        {bestCandidate ? (
          <g className="evaluation-candidate-readout">
            <rect className="evaluation-readout-bg" x={width - 254} y="18" width="232" height="34" rx="7" />
            <text className="evaluation-readout evaluation-readout--candidate" x={width - 240} y="35">
              {`1选 ${bestCandidate.move} · ${bestCandidate.winrate.toFixed(1)}%`}
            </text>
          </g>
        ) : null}
        <line className="evaluation-bar-baseline" x1={plotLeft} y1={barBottom} x2={width - plotRight} y2={barBottom} />
        <path className="evaluation-current-caret" d={`M ${currentX.toFixed(2)} ${barBottom + 2} l -4 6 h 8 Z`} />
        <rect className="evaluation-current-label-bg" x={currentBadgeX} y={currentBadgeY} width={currentBadgeWidth} height={currentBadgeHeight} rx="5" />
        <text className="evaluation-current-label" x={currentBadgeX + currentBadgeWidth / 2} y={currentBadgeY + currentBadgeHeight / 2}>
          {currentMoveLabel}
        </text>
      </svg>
    </div>
  )
}

function GoBoard({ record, moveNumber, analysis }: { record: GameRecord; moveNumber: number; analysis: KataGoMoveAnalysis | null }): ReactElement {
  const size = record.boardSize
  const board = computeBoard(record, moveNumber)
  const viewSize = 760
  const boardInset = 18
  const gridInset = 76
  const step = (viewSize - gridInset * 2) / (size - 1)
  const starPoints = getStarPoints(size)
  const lastMove = moveNumber > 0 ? record.moves[moveNumber - 1] : undefined
  const candidateMoves = boardDisplayCandidateMoves(analysis).slice(0, 6)
  const maxVisits = Math.max(...candidateMoves.map((candidate) => candidate.visits), 1)
  const candidates = candidateMoves.map((candidate, index) => ({
    ...candidate,
    index,
    point: gtpToPoint(candidate.move, size),
    searchShare: clamp(candidate.visits / maxVisits, 0.08, 1)
  }))
  const coordinates = Array.from({ length: size }, (_, index) => index)

  return (
    <svg className="go-board" viewBox={`0 0 ${viewSize} ${viewSize}`} role="img" aria-label="围棋棋盘">
      <defs>
        <pattern id="lizzie-board-texture" patternUnits="userSpaceOnUse" width="438" height="567">
          <image href={lizzieBoardUrl} width="438" height="567" preserveAspectRatio="none" />
        </pattern>
        <filter id="stone-shadow" x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="2.4" stdDeviation="2.1" floodColor="#000000" floodOpacity="0.42" />
        </filter>
      </defs>
      <rect className="board-edge" x="0" y="0" width={viewSize} height={viewSize} rx="8" />
      <rect className="board-surface" x={boardInset} y={boardInset} width={viewSize - boardInset * 2} height={viewSize - boardInset * 2} rx="6" />
      <g className="board-grid">
        {coordinates.map((index) => {
          const p = gridInset + index * step
          return (
            <g key={`line-${index}`}>
              <line x1={gridInset} y1={p} x2={viewSize - gridInset} y2={p} />
              <line x1={p} y1={gridInset} x2={p} y2={viewSize - gridInset} />
            </g>
          )
        })}
      </g>
      <g className="board-coordinates" aria-hidden="true">
        {coordinates.map((index) => {
          const p = gridInset + index * step
          return (
            <g key={`coord-${index}`}>
              <text x={p} y="46">
                {letters[index]}
              </text>
              <text x={p} y={viewSize - 43}>
                {letters[index]}
              </text>
              <text x="45" y={p}>
                {size - index}
              </text>
              <text x={viewSize - 45} y={p}>
                {size - index}
              </text>
            </g>
          )
        })}
      </g>
      {starPoints.map(([row, col]) => (
        <circle key={`${row}-${col}`} className="star-point" cx={gridInset + col * step} cy={gridInset + row * step} r={step * 0.095} />
      ))}
      {board.flatMap((row, rowIndex) =>
        row.map((stone, colIndex) => {
          if (!stone) {
            return null
          }
          const x = gridInset + colIndex * step
          const y = gridInset + rowIndex * step
          const isLast = lastMove?.row === rowIndex && lastMove.col === colIndex
          const stoneRadius = step * 0.505
          return (
            <g key={`${rowIndex}-${colIndex}`}>
              <image
                className={`stone stone--${stone}`}
                href={stone === 'B' ? lizzieBlackStoneUrl : lizzieWhiteStoneUrl}
                x={x - stoneRadius}
                y={y - stoneRadius}
                width={stoneRadius * 2}
                height={stoneRadius * 2}
                preserveAspectRatio="xMidYMid meet"
                filter="url(#stone-shadow)"
              />
              {isLast ? <circle className={`last-marker last-marker--${stone}`} cx={x} cy={y} r={step * 0.19} /> : null}
            </g>
          )
        })
      )}
      {candidates.map((candidate) => {
        if (!candidate.point) {
          return null
        }
        const x = gridInset + candidate.point.col * step
        const y = gridInset + candidate.point.row * step
        const radius = step * (candidate.index === 0 ? 0.49 : 0.4 + candidate.searchShare * 0.07)
        const orderX = x + radius * 0.7
        const orderY = y - radius * 0.7
        return (
          <g key={`${candidate.move}-${candidate.index}`} className={`candidate candidate--${candidate.index + 1}`}>
            <title>
              {`${candidate.index + 1}选 ${candidate.move} · 胜率 ${candidate.winrate.toFixed(1)}% · 目差 ${candidate.scoreLead.toFixed(1)} · 搜索 ${formatVisits(candidate.visits)} · 先验 ${candidate.prior.toFixed(1)}%${candidate.pv.length ? ` · PV ${candidate.pv.join(' ')}` : ''}`}
            </title>
            <circle className="candidate-halo" cx={x} cy={y} r={radius + step * 0.065} opacity={0.28 + candidate.searchShare * 0.28} />
            <circle className="candidate-stone" cx={x} cy={y} r={radius} opacity={0.72 + candidate.searchShare * 0.24} />
            <circle className="candidate-order-bg" cx={orderX} cy={orderY} r={step * 0.155} />
            <text className="candidate-order" x={orderX} y={orderY}>
              {candidate.index + 1}
            </text>
            <text className="candidate-winrate" x={x} y={y - radius * 0.22}>
              {candidate.winrate.toFixed(1)}
            </text>
            <text className="candidate-visits" x={x} y={y + radius * 0.34}>
              {formatVisits(candidate.visits)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

type Board = Array<Array<StoneColor | null>>

function computeBoard(record: GameRecord, moveNumber: number): Board {
  const size = record.boardSize
  const board: Board = Array.from({ length: size }, () => Array<StoneColor | null>(size).fill(null))
  for (const move of record.moves.slice(0, moveNumber)) {
    if (move.pass || move.row === null || move.col === null) {
      continue
    }
    board[move.row][move.col] = move.color
    const opponent = move.color === 'B' ? 'W' : 'B'
    for (const [row, col] of neighbors(move.row, move.col, size)) {
      if (board[row][col] === opponent && countLiberties(board, row, col).liberties === 0) {
        for (const [groupRow, groupCol] of countLiberties(board, row, col).stones) {
          board[groupRow][groupCol] = null
        }
      }
    }
    if (countLiberties(board, move.row, move.col).liberties === 0) {
      board[move.row][move.col] = null
    }
  }
  return board
}

function neighbors(row: number, col: number, size: number): Array<[number, number]> {
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1]
  ].filter(([r, c]) => r >= 0 && c >= 0 && r < size && c < size) as Array<[number, number]>
}

function countLiberties(board: Board, row: number, col: number): { stones: Array<[number, number]>; liberties: number } {
  const color = board[row][col]
  if (!color) {
    return { stones: [], liberties: 0 }
  }
  const seen = new Set<string>()
  const liberties = new Set<string>()
  const stones: Array<[number, number]> = []
  const stack: Array<[number, number]> = [[row, col]]
  while (stack.length > 0) {
    const [r, c] = stack.pop()!
    const key = `${r}:${c}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    stones.push([r, c])
    for (const [nr, nc] of neighbors(r, c, board.length)) {
      if (!board[nr][nc]) {
        liberties.add(`${nr}:${nc}`)
      } else if (board[nr][nc] === color) {
        stack.push([nr, nc])
      }
    }
  }
  return { stones, liberties: liberties.size }
}

function getStarPoints(size: number): Array<[number, number]> {
  if (size < 7) {
    return []
  }
  const starPointPosition = size <= 11 ? 3 : 4
  const points = [starPointPosition - 1, size - starPointPosition]
  if (size % 2 === 1 && size > 7) {
    points.splice(1, 0, Math.floor(size / 2))
  }
  return points.flatMap((row) => points.map((col) => [row, col] as [number, number]))
}

function gtpToPoint(gtp: string, size: number): { row: number; col: number } | null {
  if (!gtp || gtp.toLowerCase() === 'pass') {
    return null
  }
  const col = letters.indexOf(gtp[0].toUpperCase())
  const row = size - Number.parseInt(gtp.slice(1), 10)
  if (col < 0 || !Number.isFinite(row) || row < 0 || row >= size) {
    return null
  }
  return { row, col }
}

async function renderBoardPng(record: GameRecord, moveNumber: number, analysis: KataGoMoveAnalysis | null, useExternalAssets = true): Promise<string> {
  const size = record.boardSize
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 1000
  const ctx = canvas.getContext('2d')!
  const boardInset = 24
  const margin = 104
  const step = (canvas.width - margin * 2) / (size - 1)
  const board = computeBoard(record, moveNumber)
  const lastMove = moveNumber > 0 ? record.moves[moveNumber - 1] : undefined
  const { boardTexture, blackStone, whiteStone } = useExternalAssets
    ? await loadBoardPngAssets()
    : { boardTexture: null, blackStone: null, whiteStone: null }

  ctx.fillStyle = '#0b0d10'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  roundedCanvasRect(ctx, boardInset, boardInset, canvas.width - boardInset * 2, canvas.height - boardInset * 2, 10)
  ctx.clip()
  if (boardTexture) {
    const boardPattern = ctx.createPattern(boardTexture, 'repeat')
    ctx.fillStyle = boardPattern ?? '#d8b15e'
    ctx.fillRect(boardInset, boardInset, canvas.width - boardInset * 2, canvas.height - boardInset * 2)
  } else {
    paintProceduralBoardTexture(ctx, boardInset, boardInset, canvas.width - boardInset * 2, canvas.height - boardInset * 2)
  }
  ctx.restore()

  ctx.strokeStyle = '#11100d'
  for (let i = 0; i < size; i += 1) {
    const p = margin + i * step
    ctx.lineWidth = i === 0 || i === size - 1 ? 3 : 1.8
    ctx.beginPath()
    ctx.moveTo(margin, p)
    ctx.lineTo(canvas.width - margin, p)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(p, margin)
    ctx.lineTo(p, canvas.height - margin)
    ctx.stroke()
  }
  ctx.fillStyle = '#11100d'
  for (const [row, col] of getStarPoints(size)) {
    ctx.beginPath()
    ctx.arc(margin + col * step, margin + row * step, step * 0.095, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#15130f'
  ctx.font = 'bold 28px Avenir Next, PingFang SC, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < size; i += 1) {
    const p = margin + i * step
    ctx.fillText(letters[i], p, 62)
    ctx.fillText(letters[i], p, canvas.height - 52)
    ctx.fillText(String(size - i), 60, p)
    ctx.fillText(String(size - i), canvas.width - 60, p)
  }

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const stone = board[row][col]
      if (!stone) {
        continue
      }
      const x = margin + col * step
      const y = margin + row * step
      const stoneRadius = step * 0.505
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.42)'
      ctx.shadowBlur = 7
      ctx.shadowOffsetY = 3
      const stoneAsset = stone === 'B' ? blackStone : whiteStone
      if (stoneAsset) {
        ctx.drawImage(stoneAsset, x - stoneRadius, y - stoneRadius, stoneRadius * 2, stoneRadius * 2)
      } else {
        paintProceduralStone(ctx, x, y, stoneRadius, stone)
      }
      ctx.restore()
      if (lastMove?.row === row && lastMove.col === col) {
        ctx.strokeStyle = stone === 'B' ? '#f4efe4' : '#17191a'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.arc(x, y, step * 0.19, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  ctx.font = 'bold 22px Avenir Next, PingFang SC, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const candidateColors = ['#66c783', '#5aa8d6', '#d6b45f', '#b783d9', '#8f9ba8']
  const imageCandidates = boardDisplayCandidateMoves(analysis).slice(0, 6)
  const maxImageVisits = Math.max(...imageCandidates.map((candidate) => candidate.visits), 1)
  for (const [index, candidate] of imageCandidates.entries()) {
    const point = gtpToPoint(candidate.move, size)
    if (!point) {
      continue
    }
    const x = margin + point.col * step
    const y = margin + point.row * step
    const searchShare = clamp(candidate.visits / maxImageVisits, 0.08, 1)
    const radius = step * (index === 0 ? 0.46 : 0.38 + searchShare * 0.06)
    ctx.fillStyle = candidateColors[index] ?? '#8f9ba8'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#f4f2ec'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#101417'
    ctx.font = 'bold 19px Avenir Next, PingFang SC, sans-serif'
    ctx.fillText(candidate.winrate.toFixed(1), x, y - radius * 0.16)
    ctx.font = 'bold 15px Avenir Next, PingFang SC, sans-serif'
    ctx.fillText(formatVisits(candidate.visits), x, y + radius * 0.38)
    ctx.fillStyle = '#f8f4ea'
    ctx.beginPath()
    ctx.arc(x + radius * 0.72, y - radius * 0.72, step * 0.13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#101417'
    ctx.font = 'bold 13px Avenir Next, PingFang SC, sans-serif'
    ctx.fillText(String(index + 1), x + radius * 0.72, y - radius * 0.72)
  }

  ctx.fillStyle = '#1f1a12'
  ctx.font = '24px Avenir Next, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`Move ${moveNumber} / ${record.moves.length}`, margin, canvas.height - 28)
  if (analysis?.playedMove) {
    ctx.fillText(`Loss ${analysis.playedMove.winrateLoss.toFixed(1)}% / ${analysis.playedMove.scoreLoss.toFixed(1)}目`, margin + 230, canvas.height - 28)
  }

  try {
    return canvas.toDataURL('image/png')
  } catch (cause) {
    if (useExternalAssets) {
      return renderBoardPng(record, moveNumber, analysis, false)
    }
    throw cause
  }
}

async function loadBoardPngAssets(): Promise<BoardPngAssets> {
  const [boardTexture, blackStone, whiteStone] = await Promise.allSettled([
    loadCanvasImage(lizzieBoardUrl),
    loadCanvasImage(lizzieBlackStoneUrl),
    loadCanvasImage(lizzieWhiteStoneUrl)
  ])
  return {
    boardTexture: boardTexture.status === 'fulfilled' ? boardTexture.value : null,
    blackStone: blackStone.status === 'fulfilled' ? blackStone.value : null,
    whiteStone: whiteStone.status === 'fulfilled' ? whiteStone.value : null
  }
}

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`无法加载棋盘素材: ${src}`))
    image.src = src
  })
}

function paintProceduralBoardTexture(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  const base = ctx.createLinearGradient(x, y, x + width, y + height)
  base.addColorStop(0, '#e5c36e')
  base.addColorStop(0.48, '#d6aa55')
  base.addColorStop(1, '#c89343')
  ctx.fillStyle = base
  ctx.fillRect(x, y, width, height)

  ctx.save()
  ctx.globalAlpha = 0.18
  for (let i = -2; i < 46; i += 1) {
    const startX = x + i * 28
    ctx.strokeStyle = i % 3 === 0 ? '#f6d98d' : '#6d411d'
    ctx.lineWidth = i % 5 === 0 ? 2.1 : 1.1
    ctx.beginPath()
    ctx.moveTo(startX, y)
    ctx.bezierCurveTo(startX - 22, y + height * 0.32, startX + 24, y + height * 0.64, startX - 8, y + height)
    ctx.stroke()
  }
  ctx.restore()
}

function paintProceduralStone(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: StoneColor): void {
  const gradient = ctx.createRadialGradient(x - radius * 0.32, y - radius * 0.36, radius * 0.12, x, y, radius)
  if (color === 'B') {
    gradient.addColorStop(0, '#656b72')
    gradient.addColorStop(0.34, '#25292d')
    gradient.addColorStop(1, '#050607')
  } else {
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.52, '#f0eadf')
    gradient.addColorStop(1, '#b4ab9f')
  }
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.globalAlpha = color === 'B' ? 0.18 : 0.34
  ctx.fillStyle = color === 'B' ? '#ffffff' : '#ffffff'
  ctx.beginPath()
  ctx.ellipse(x - radius * 0.32, y - radius * 0.38, radius * 0.28, radius * 0.16, -0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function roundedCanvasRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}
