import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { getGames, getSettings, replaceSettings, reportsDir } from '@main/lib/store'
import type {
  AgentToolImageResult,
  BoardImageCaptureSelection,
  CoachUserLevel,
  GameMove,
  KataGoMoveAnalysis,
  KnowledgeMatch,
  KnowledgePacket,
  LibraryGame,
  RecommendedProblem,
  StructuredTeacherResult,
  MoveRangeReviewSummary,
  StudentProfile,
  TeachingPacingAdvice,
  TeacherArtifact,
  TeacherArtifactKind,
  TeacherBoardImageRenderImage,
  TeacherBoardImageRenderRequest,
  TeacherRunRequest,
  TeacherRunProgress,
  TeacherRunResult,
  TeacherToolLog,
  VisionEvidenceImage,
  VisionEvidenceImageRole,
  VisionEvidenceReport
} from '@main/lib/types'
import type { ChatContentPart, ChatMessage, ChatTool, ChatToolCall, ProviderSettings } from './llm/provider'
import { analyzeGameQuick, analyzePosition, cancelKataGoAnalysis } from './katago'
import { MOVE_RANGE_KEY_MOVE_LIMIT, MOVE_RANGE_MAX_MOVES, parseMoveRangeFromPrompt, validateMoveRange } from '@shared/moveRange'
import { formatMoveRangeSummaryForPrompt, selectMoveNumbersForRangeRefine } from './teacher/moveRangeReview'
import { searchKnowledge, searchKnowledgeMatches } from './knowledge'
import { recommendedProblemsFromMatches, type BoardSnapshotStone, type LocalWindow } from './knowledge/matchEngine'
import { buildBoardState, boardStateToSnapshot } from './go/boardState'
import { formatKataGoTraceForPrompt } from './teacher/katagoTraceTranslator'
import { detectTacticalSignals } from './knowledge/tacticalDetectors'
import { readGameRecord } from './sgf'
import { ensureFoxGameDownloaded } from './fox'
import { gameResultSummary, komiSummary } from './sgfScoring'
import { getStudentProfile, readStudentForGame, updateStudentProfile } from './studentProfile'
import { applyDetectedDefaults, detectSystemProfile } from './systemProfile'
import { parseStructuredTeacherResult } from './teacher/structuredResultParser'
import { classifyTeacherIntent, type TeacherIntent } from './teacher/intentClassifier'
import { buildTeachingPacingAdvice } from './teacher/teachingEvidence'
import { buildTeacherArtifact, validateTeachingArtifact } from './teacher/teachingArtifact'
import { buildTeachingEvidenceBundle, formatTeachingEvidenceBundleForPrompt } from './teacher/evidenceBundle'
import { scoreLeadForColor, scoreSummaryFromBlackLead } from './teacher/scorePerspective'
import {
  buildTeacherPersonaInstruction,
  normalizeCoachLevel,
  normalizeExactStudentAge,
  normalizeExplanationPace,
  normalizeStudentAgeRange,
  normalizeStudentRank,
  normalizeTeacherStyle,
  normalizeTerminologyDensity,
  normalizeVariationDetail
} from './teacher/teacherPersona'
import {
  buildVisionEvidenceReport,
  buildVisionImageContentParts,
  formatVisionEvidenceForPrompt,
  validateVisionEvidenceForIntent
} from './teacher/visionEvidence'
import { buildVisionEvidenceRepairNote, verifyVisionEvidenceMarkdown } from './teacher/visionEvidenceVerifier'
import { streamOpenAICompatibleToolTurn } from './llm/openaiCompatibleProvider'

type TeacherProgressEmitter = (progress: TeacherRunProgress) => void
type TeacherBoardImageCaptureHandler = (request: TeacherBoardImageRenderRequest) => Promise<TeacherBoardImageRenderImage[]>

interface RunTeacherTaskOptions {
  captureBoardImages?: TeacherBoardImageCaptureHandler
}

interface TeacherRunContext {
  runId: string
  emit?: TeacherProgressEmitter
  signal?: AbortSignal
  captureBoardImages?: TeacherBoardImageCaptureHandler
}

interface BatchIssue {
  game: LibraryGame
  moveNumber: number
  playedMove: string
  bestMove: string
  loss: number
  scoreLead: number
  pv: string[]
}

function startTool(logs: TeacherToolLog[], name: string, label: string, detail: string): TeacherToolLog {
  const log: TeacherToolLog = {
    id: randomUUID(),
    name,
    label,
    detail,
    status: 'running',
    startedAt: new Date().toISOString()
  }
  logs.push(log)
  return log
}

function finishTool(log: TeacherToolLog, status: TeacherToolLog['status'], detail?: string): void {
  log.status = status
  if (detail) {
    log.detail = detail
  }
  log.endedAt = new Date().toISOString()
}

function cloneToolLogs(logs: TeacherToolLog[]): TeacherToolLog[] {
  return logs.map((log) => ({ ...log }))
}

function emitProgress(context: TeacherRunContext | undefined, progress: Omit<TeacherRunProgress, 'runId'>): void {
  context?.emit?.({
    runId: context.runId,
    ...progress
  })
}

function emitToolState(context: TeacherRunContext | undefined, logs: TeacherToolLog[], message: string): void {
  emitProgress(context, {
    stage: 'tool',
    message,
    toolLogs: cloneToolLogs(logs)
  })
}

function emitAssistantDelta(context: TeacherRunContext | undefined, delta: string): void {
  emitProgress(context, {
    stage: 'assistant-delta',
    markdownDelta: delta
  })
}

function inferCount(prompt: string): number {
  const arabic = prompt.match(/(\d+)\s*盘/)
  if (arabic) {
    return Math.max(1, Math.min(20, Number(arabic[1])))
  }
  if (/十盘|10盘|最近十/.test(prompt)) {
    return 10
  }
  return 10
}

function detectStudentName(request: TeacherRunRequest, game?: LibraryGame): string {
  const settings = getSettings()
  return (
    request.playerName?.trim() ||
    settings.defaultPlayerName.trim() ||
    game?.sourceLabel.replace(/^Fox\s*/, '').trim() ||
    game?.black ||
    '默认学生'
  )
}

function findGamesForStudent(studentName: string, count: number): LibraryGame[] {
  const target = studentName.trim().toLowerCase()
  const games = getGames()
  const matched = target
    ? games.filter((game) =>
        [game.black, game.white, game.sourceLabel, game.title].some((value) =>
          value.toLowerCase().includes(target)
        )
      )
    : games
  return (matched.length > 0 ? matched : games).slice(0, count)
}

function gtpToCoord(point: string, boardSize: number): { row: number; col: number } | null {
  const match = point.trim().toUpperCase().match(/^([A-HJ-T])(\d{1,2})$/)
  if (!match) return null
  const letters = 'ABCDEFGHJKLMNOPQRST'
  const col = letters.indexOf(match[1])
  const number = Number(match[2])
  if (col < 0 || col >= boardSize || number < 1 || number > boardSize) return null
  return { row: boardSize - number, col }
}

function coordToGtp(row: number, col: number, boardSize: number): string {
  const letters = 'ABCDEFGHJKLMNOPQRST'
  return `${letters[col]}${boardSize - row}`
}

function coordKey(row: number, col: number): string {
  return `${row},${col}`
}

function neighborsOf(row: number, col: number, boardSize: number): Array<{ row: number; col: number }> {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 }
  ].filter((point) => point.row >= 0 && point.col >= 0 && point.row < boardSize && point.col < boardSize)
}

function collectGroup(board: Map<string, 'B' | 'W'>, row: number, col: number, boardSize: number): Array<{ row: number; col: number }> {
  const color = board.get(coordKey(row, col))
  if (!color) return []
  const seen = new Set<string>()
  const group: Array<{ row: number; col: number }> = []
  const stack = [{ row, col }]
  while (stack.length > 0) {
    const current = stack.pop()!
    const key = coordKey(current.row, current.col)
    if (seen.has(key)) continue
    if (board.get(key) !== color) continue
    seen.add(key)
    group.push(current)
    for (const next of neighborsOf(current.row, current.col, boardSize)) {
      if (board.get(coordKey(next.row, next.col)) === color) {
        stack.push(next)
      }
    }
  }
  return group
}

function groupHasLiberty(board: Map<string, 'B' | 'W'>, group: Array<{ row: number; col: number }>, boardSize: number): boolean {
  return group.some((stone) => neighborsOf(stone.row, stone.col, boardSize).some((next) => !board.has(coordKey(next.row, next.col))))
}

function buildBoardSnapshot(moves: GameMove[], uptoMoveNumber: number, boardSize: number): BoardSnapshotStone[] {
  const board = new Map<string, 'B' | 'W'>()
  for (const move of moves.slice(0, Math.max(0, uptoMoveNumber))) {
    if (move.pass) continue
    const coord = move.row !== null && move.col !== null ? { row: move.row, col: move.col } : gtpToCoord(move.gtp, boardSize)
    if (!coord) continue
    const key = coordKey(coord.row, coord.col)
    board.set(key, move.color)
    const opponent = move.color === 'B' ? 'W' : 'B'
    for (const next of neighborsOf(coord.row, coord.col, boardSize)) {
      if (board.get(coordKey(next.row, next.col)) !== opponent) continue
      const group = collectGroup(board, next.row, next.col, boardSize)
      if (!groupHasLiberty(board, group, boardSize)) {
        for (const stone of group) board.delete(coordKey(stone.row, stone.col))
      }
    }
    const ownGroup = collectGroup(board, coord.row, coord.col, boardSize)
    if (!groupHasLiberty(board, ownGroup, boardSize)) {
      for (const stone of ownGroup) board.delete(coordKey(stone.row, stone.col))
    }
  }
  return [...board.entries()].map(([key, color]) => {
    const [row, col] = key.split(',').map(Number)
    return { color, point: coordToGtp(row, col, boardSize) }
  })
}

function buildLocalWindows(snapshot: BoardSnapshotStone[], anchors: Array<string | undefined>, boardSize: number): LocalWindow[] {
  return [...new Set(anchors.filter(Boolean) as string[])]
    .filter((anchor) => gtpToCoord(anchor, boardSize))
    .map((anchor) => {
      const anchorPoint = gtpToCoord(anchor, boardSize)!
      return {
        anchor,
        stones: snapshot.filter((stone) => {
          const point = gtpToCoord(stone.point, boardSize)
          if (!point) return false
          return Math.max(Math.abs(point.row - anchorPoint.row), Math.abs(point.col - anchorPoint.col)) <= 4
        })
      }
    })
    .filter((window) => window.stones.length > 0)
}

function tagsFromAnalysis(analysis: KataGoMoveAnalysis, move?: GameMove): string[] {
  const tags = new Set<string>()
  if (analysis.moveNumber <= 40) {
    tags.add('布局')
    tags.add('方向')
    tags.add('大场')
  }
  if ((analysis.playedMove?.winrateLoss ?? 0) >= 4) {
    tags.add('急所')
    tags.add('价值判断')
  }
  if ((analysis.playedMove?.winrateLoss ?? 0) >= 10) {
    tags.add('问题手')
  }
  if (move && move.row !== null && move.col !== null) {
    const edge = Math.min(move.row, move.col, analysis.boardSize - 1 - move.row, analysis.boardSize - 1 - move.col)
    if (edge <= 4) {
      tags.add('角部')
      tags.add('定式')
    }
  }
  for (const candidate of analysis.before.topMoves.slice(0, 2)) {
    if (candidate.pv.length > 0) {
      tags.add('变化')
    }
  }
  return [...tags]
}

function themesFromProfile(profile: StudentProfile): string[] {
  const tags = profile.commonMistakes.slice(0, 4).map((item) => item.tag)
  if (tags.length === 0) {
    return ['大场与急所判断', '每手棋先看全局价值', '跟着 KataGo PV 复盘关键变化']
  }
  return tags.map((tag) => {
    if (tag.includes('布局') || tag.includes('大场')) {
      return '布局阶段先比较大场和急所'
    }
    if (tag.includes('计算')) {
      return '关键战斗前先读 3 手变化'
    }
    if (tag.includes('形势')) {
      return '用目差和胜率变化校准形势判断'
    }
    return `围绕${tag}做专项复盘`
  })
}

function teacherLanguageName(locale: unknown): string {
  if (locale === 'zh-CN') return '简体中文'
  if (locale === 'zh-TW') return '繁體中文'
  if (locale === 'en-US') return 'English'
  if (locale === 'ja-JP') return '日本語'
  if (locale === 'ko-KR') return '한국어'
  if (locale === 'th-TH') return 'ไทย'
  if (locale === 'vi-VN') return 'Tiếng Việt'
  return '简体中文'
}

function systemPrompt(level: CoachUserLevel): string {
  const settings = getSettings()
  return [
    '你是 GoAgent 的围棋老师。',
    `请默认使用${teacherLanguageName(settings.reviewLanguage)}回答；只有用户明确要求其它语言时才切换。`,
    '帮助学生理解棋局，并提升下一次判断。',
    '需要信息时调用工具；不要靠印象猜局面。',
    '你具备真正的工具调用能力：棋谱、棋盘截图、KataGo、知识库、学生画像、报告和本机工具都应按需调用；不要靠按钮预处理或印象猜局面。',
    '分析当前手、整盘复盘或区间复盘时，必须通过工具取得棋盘图、KataGo 证据和知识库匹配。当前手至少调用 board.captureTeachingImage、katago.analyzePosition、knowledge.matchPosition 或 knowledge.searchLocal；整盘复盘先调用 sgf.readGameRecord、katago.analyzeGameBatch，再截图 3-6 个关键手；区间复盘先精读区间关键手，再截图关键手。',
    '工具结果和 KataGo 是事实依据。',
    '如果 KataGo 结果包含 tracePacket，优先使用 tracePacket.searchSummary、candidateComparison、policySearchDelta、pvSupport、ownershipSummary、humanPolicySignals 和 shallowSearchTree 来解释“为什么”。',
    'tracePacket 是给老师的搜索证据摘要，不要把原始 MCTS/搜索字段生硬堆给学生；请翻译成“自然但被搜索否定”“不直观但搜索支持”“PV 支撑弱所以只能参考”等教学语言。',
    '如果 tracePacket 的置信度或 PV 支撑不足，必须降级措辞，不能说唯一、必杀、必败或绝对。',
    '讲胜负、领先、落后和目数时，优先使用工具结果里的 teacherScore.text；没有 teacherScore 时再使用 scoreSummary.text/leader/leadPoints。blackScoreLead 是黑棋为正，负数表示白棋领先，不要自己用裸 scoreLead 符号猜胜负。',
    '内部核验时仍可用 scoreSummary.leader 和 scoreSummary.leadPoints 判断方向和数字，但对学生优先输出 teacherScore.text 这种简洁说法。',
    '棋谱的 result / game.result / rawResult 是终局记录，不是 KataGo 当前目差；Fox 数字结果还有平台口径换算，只有 resultSummary.displayLeadPoints / comparisonLeadPoints 才能和 KataGo/LizzieYzy 风格的目差比较。',
    '如果当前手是终局，且工具返回 resultSummary.confidence=recorded-result，请把 resultSummary.teacherText 当作终局目数来源。',
    '对学生输出时保持简洁：直接说“黑领先 X 目”或“白领先 X 目”；不要主动解释“棋谱记录、KataGo估值、Fox平台口径、换算口径”，除非用户追问来源。',
    '不要编造坐标、胜率、PV、定式名或来源。',
    '每个关键结论都应能回指到工具证据；数字、坐标、PV、定式名、死活结论和先后手判断没有证据时必须降级成假设。',
    '当 analysisQuality.confidence 不是 high，必须使用“AI 更倾向 / 更像 / 不宜下绝对结论”等低风险措辞。',
    '强匹配才能明确说定式、死活型或手筋名；相似匹配只能说“像某某型”。',
    '把握讲解火候：常规定式少讲，分支列变化，中盘战详细讲目的和后续。',
    '如果工具结果给出 teachingDensity，就按它控制详略：minimal 很短，branch 讲 1-2 个关键变化，detailed 讲目的、应手、后续变化和实战评价，caution 只说倾向。',
    '像老师讲棋：先帮学生看懂棋形和判断方法，再自然引用必要证据；不要按固定栏目或机器报告口吻堆字段。',
    '区间复盘要先讲区间走势，再聚焦 3-5 个关键手；不要逐手流水账；每个关键手必须引用 KataGo、analysisQuality、棋形识别或战术信号。',
    '区间过长或证据不足时要建议缩小范围或只做抽样总结，不能把低 visits 区间分析说成最终结论。',
    `学生水平：${level}。`,
    buildTeacherPersonaInstruction({
      level,
      rank: normalizeStudentRank(settings.defaultStudentRank),
      exactAge: normalizeExactStudentAge(settings.defaultStudentAge),
      ageRange: normalizeStudentAgeRange(settings.defaultStudentAgeRange),
      style: normalizeTeacherStyle(settings.teacherStyle),
      terminologyDensity: normalizeTerminologyDensity(settings.teacherTerminologyDensity),
      explanationPace: normalizeExplanationPace(settings.teacherExplanationPace),
      variationDetail: normalizeVariationDetail(settings.teacherVariationDetail)
    })
  ].join('\n')
}

function saveReport(id: string, title: string, markdown: string, extra: Record<string, unknown>): string {
  const dir = join(reportsDir, id)
  mkdirSync(dir, { recursive: true })
  const markdownPath = join(dir, 'report.md')
  const jsonPath = join(dir, 'report.json')
  writeFileSync(markdownPath, redactSensitiveText(markdown), 'utf8')
  writeFileSync(jsonPath, JSON.stringify(redactSensitiveValue({ title, ...extra }), null, 2), 'utf8')
  return markdownPath
}

function structuredFromTeacherText(
  markdown: string,
  taskType: StructuredTeacherResult['taskType'],
  knowledge: KnowledgePacket[],
  knowledgeMatches: KnowledgeMatch[] = [],
  recommendedProblems: RecommendedProblem[] = []
): StructuredTeacherResult {
  const parsed = parseStructuredTeacherResult({
    text: markdown,
    taskType,
    knowledgeCardIds: knowledge.map((card) => card.id)
  }) as StructuredTeacherResult
  return {
    ...parsed,
    knowledgeMatches: parsed.knowledgeMatches?.length ? parsed.knowledgeMatches : knowledgeMatches,
    recommendedProblems: parsed.recommendedProblems?.length ? parsed.recommendedProblems : recommendedProblems,
    profileUpdates: {
      ...parsed.profileUpdates,
      patterns: parsed.profileUpdates.patterns,
      trainingFocus: parsed.profileUpdates.trainingFocus
    }
  }
}

function extractIssuesFromAnalyses(analyses: KataGoMoveAnalysis[], game: LibraryGame, minWinrateDrop: number): BatchIssue[] {
  return analyses
    .filter((analysis) => (analysis.playedMove?.winrateLoss ?? 0) >= minWinrateDrop)
    .sort((left, right) =>
      (right.playedMove?.winrateLoss ?? 0) - (left.playedMove?.winrateLoss ?? 0) ||
      left.moveNumber - right.moveNumber
    )
    .slice(0, 6)
    .map((analysis) => ({
    game,
    moveNumber: analysis.moveNumber,
    playedMove: analysis.currentMove?.gtp ?? analysis.playedMove?.move ?? '',
    bestMove: analysis.before.topMoves[0]?.move ?? '',
    loss: analysis.playedMove?.winrateLoss ?? 0,
    scoreLead: analysis.playedMove?.scoreLoss ?? 0,
    pv: analysis.before.topMoves[0]?.pv?.slice(0, 10) ?? []
  }))
}

type JsonObject = Record<string, unknown>

interface TeacherAgentToolDefinition {
  apiName: string
  canonicalName: string
  label: string
  description: string
  parameters: JsonObject
  execute: (input: JsonObject, state: TeacherAgentSessionState) => Promise<unknown>
}

interface TeacherAgentSessionState {
  id: string
  request: TeacherRunRequest
  intent: TeacherIntent
  logs: TeacherToolLog[]
  context?: TeacherRunContext
  studentName: string
  profile: StudentProfile
  game?: LibraryGame
  record?: ReturnType<typeof readGameRecord>
  lastAnalysis?: KataGoMoveAnalysis
  rangeAnalyses?: KataGoMoveAnalysis[]
  batchIssues: BatchIssue[]
  pendingToolMessages: ChatMessage[]
  knowledge: KnowledgePacket[]
  knowledgeMatches: KnowledgeMatch[]
  recommendedProblems: RecommendedProblem[]
  teachingPacing?: TeachingPacingAdvice
  agentArtifact?: TeacherArtifact
  finalMarkdown: string
}

interface ShellTask {
  id: string
  command: string
  cwd: string
  process: ChildProcessWithoutNullStreams
  startedAt: string
}

const SHELL_TASKS = new Map<string, ShellTask>()
const ACTIVE_TEACHER_RUNS = new Map<string, { abortController: AbortController; cancelled: boolean }>()
const MAX_TOOL_RESULT_CHARS = 18_000
const MAX_SHELL_OUTPUT_CHARS = 24_000

class TeacherRunCancelledError extends Error {
  constructor() {
    super('老师任务已停止')
    this.name = 'TeacherRunCancelledError'
  }
}

function isTeacherRunCancelled(context: TeacherRunContext | undefined): boolean {
  if (!context) return false
  return Boolean(context.signal?.aborted || ACTIVE_TEACHER_RUNS.get(context.runId)?.cancelled)
}

function assertTeacherRunActive(context: TeacherRunContext | undefined): void {
  if (isTeacherRunCancelled(context)) {
    throw new TeacherRunCancelledError()
  }
}

function isCancellationError(error: unknown): boolean {
  return error instanceof TeacherRunCancelledError || /老师任务已停止|KataGo 分析已取消|AbortError|LLM 请求已取消/i.test(String(error))
}

function allowToolFirstVision(request: TeacherRunRequest): boolean {
  return request.toolPolicy === 'auto' || request.toolPolicy === undefined
}

export function cancelTeacherRun(payload: { runId?: string } = {}): { cancelled: number } {
  let cancelled = 0
  for (const [runId, active] of ACTIVE_TEACHER_RUNS.entries()) {
    if (payload.runId && payload.runId !== runId) {
      continue
    }
    if (!active.cancelled) {
      active.cancelled = true
      active.abortController.abort(new TeacherRunCancelledError())
      cancelled += 1
    }
  }
  const katago = payload.runId
    ? cancelKataGoAnalysis({ runId: payload.runId })
    : cancelKataGoAnalysis({ group: 'teacher' })
  if (payload.runId) {
    const teacherGroup = cancelKataGoAnalysis({ group: 'teacher' })
    cancelled += katago.cancelled + teacherGroup.cancelled
  } else {
    cancelled += katago.cancelled
  }
  return { cancelled }
}

function agentSystemPrompt(level: CoachUserLevel): string {
  return systemPrompt(level)
}

function providerSettingsFromApp(): ProviderSettings {
  const settings = getSettings()
  if (!settings.llmBaseUrl.trim() || !settings.llmApiKey.trim() || !settings.llmModel.trim()) {
    throw new Error('请先配置支持 tool calling 和图片输入的 OpenAI-compatible LLM 代理。')
  }
  return {
    llmBaseUrl: settings.llmBaseUrl,
    llmApiKey: settings.llmApiKey,
    llmModel: settings.llmModel
  }
}

function stringInput(input: JsonObject, key: string, fallback = ''): string {
  const value = input[key]
  return typeof value === 'string' ? value.trim() : fallback
}

function numberInput(input: JsonObject, key: string, fallback: number, min = -Infinity, max = Infinity): number {
  const value = input[key]
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

function booleanInput(input: JsonObject, key: string, fallback = false): boolean {
  const value = input[key]
  return typeof value === 'boolean' ? value : fallback
}

function arrayInput(input: JsonObject, key: string): string[] {
  const value = input[key]
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
}

function numberArrayInput(input: JsonObject, key: string): number[] {
  const value = input[key]
  if (!Array.isArray(value)) return []
  return value
    .map((item) => typeof item === 'number' ? item : typeof item === 'string' ? Number(item) : NaN)
    .filter((item) => Number.isInteger(item) && item >= 0)
}

function pauseInteractiveKataGoWork(): void {
  cancelKataGoAnalysis({ group: 'quick' })
  cancelKataGoAnalysis({ group: 'live' })
}

function redactSensitiveText(text: string): string {
  const secretKeyPattern = '(?:api[_-]?key|apikey|llmApiKey|ttsCustomApiKey|ttsVolcengineApiKey|ttsVolcengineAccessToken|proxyApiKey|token|password|secret|authorization|github[_-]?token|gh[_-]?token|csc_link|apple_app_specific_password)'
  return text
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=_-]+/gi, '[REDACTED_IMAGE_DATA]')
    .replace(/file:\/\/[^\s"'<>)]*/gi, '[REDACTED_LOCAL_PATH]')
    .replace(/(^|[\s"'(])(?:\/Users|\/home|\/var|\/private|\/tmp|\/Volumes)\/[^\s"'<>)]*/g, '$1[REDACTED_LOCAL_PATH]')
    .replace(/\b[A-Za-z]:\\[^\s"'<>)]*/g, '[REDACTED_LOCAL_PATH]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,}|github_pat_[A-Za-z0-9_]{12,}|ghp_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|AKIA[A-Z0-9]{12,})\b/g, '[REDACTED_TOKEN]')
    .replace(new RegExp(`["']?${secretKeyPattern}["']?\\s*[:=]\\s*["'][^"']+["']`, 'gi'), '[REDACTED_SECRET]')
    .replace(new RegExp(`(["']?${secretKeyPattern}["']?\\s*[:=]\\s*["'])[^"']+(["'])`, 'gi'), '$1[REDACTED]$2')
    .replace(new RegExp(`(["']?${secretKeyPattern}["']?\\s*[:=]\\s*)[^\\s"',}\\]]+`, 'gi'), '$1[REDACTED]')
}

function redactSensitiveValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[REDACTED_DEPTH]'
  if (typeof value === 'string') return redactSensitiveText(value)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((item) => redactSensitiveValue(item, depth + 1))
  if (typeof value !== 'object') return String(value)
  return Object.fromEntries(Object.entries(value as JsonObject).map(([key, item]) => {
    if (/(api[_-]?key|apikey|token|password|secret|authorization|csc_link|apple_app_specific_password)/i.test(key)) {
      return [key, item ? '[REDACTED]' : item]
    }
    return [key, redactSensitiveValue(item, depth + 1)]
  }))
}

function compactToolResult(value: unknown, maxChars = MAX_TOOL_RESULT_CHARS): string {
  const raw = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  const redacted = redactSensitiveText(raw)
  if (redacted.length <= maxChars) {
    return redacted
  }
  return `${redacted.slice(0, maxChars)}\n\n[tool result truncated: ${redacted.length - maxChars} chars omitted]`
}

function stripImageData(image: TeacherBoardImageRenderImage): AgentToolImageResult {
  return {
    imageId: image.imageId,
    gameId: image.gameId,
    moveNumber: image.moveNumber,
    caption: image.caption,
    mimeType: image.mimeType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    hash: image.hash,
    source: 'tool-capture'
  }
}

function toolImageRoleForState(state: TeacherAgentSessionState, imageCount: number): VisionEvidenceImageRole {
  if (state.intent === 'current-move') return 'current-board'
  if (state.intent === 'move-range') return 'range-key-move'
  return imageCount > 1 ? 'range-key-move' : 'current-board'
}

function toolImageToVisionImage(
  state: TeacherAgentSessionState,
  image: TeacherBoardImageRenderImage,
  index: number,
  imageCount: number
): VisionEvidenceImage {
  return {
    id: image.imageId,
    index,
    role: toolImageRoleForState(state, imageCount),
    source: 'tool-capture',
    moveNumber: image.moveNumber,
    mimeType: image.mimeType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    detail: 'high',
    caption: image.caption,
    valid: Boolean(image.dataUrl && image.dataUrl.startsWith('data:image/') && image.bytes > 0),
    warnings: []
  }
}

function appendToolCapturedVisionEvidence(state: TeacherAgentSessionState, images: TeacherBoardImageRenderImage[]): VisionEvidenceReport {
  const existing = state.request.visionEvidence ?? buildVisionEvidenceReport(state.request, state.intent)
  const existingImages = existing.images ?? []
  const captured = images.map((image, offset) => toolImageToVisionImage(state, image, existingImages.length + offset, images.length))
  const merged: VisionEvidenceReport = {
    ...existing,
    attached: existing.attached || captured.length > 0,
    imageCount: existingImages.length + captured.length,
    source: captured.length > 0 ? 'tool-capture' : existing.source,
    images: [...existingImages, ...captured],
    warnings: existing.warnings,
    blockingIssues: existing.blockingIssues.filter((issue) => !/image|棋盘图|board/i.test(issue)),
    createdAt: new Date().toISOString()
  }
  state.request.visionEvidence = merged
  return merged
}

function toolImageMessages(images: TeacherBoardImageRenderImage[]): ChatMessage[] {
  return images.map((image) => ({
    role: 'user',
    content: [
      { type: 'text', text: `${image.caption}\n这是 board.captureTeachingImage 工具刚生成的棋盘图。请先观察这张图，再结合 KataGo 和知识库继续分析。` },
      { type: 'image_url', image_url: { url: image.dataUrl, detail: 'high' } }
    ] satisfies ChatContentPart[]
  }))
}

function parseToolArguments(call: ChatToolCall): JsonObject {
  try {
    const parsed = JSON.parse(call.function.arguments || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonObject : {}
  } catch {
    return {}
  }
}

function chatTool(tool: TeacherAgentToolDefinition): ChatTool {
  return {
    type: 'function',
    function: {
      name: tool.apiName,
      description: `${tool.canonicalName}: ${tool.description}`,
      parameters: tool.parameters
    }
  }
}

function schema(properties: JsonObject, required: string[] = []): JsonObject {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false
  }
}

async function safeSystemProfileForAgent(): Promise<JsonObject> {
  const profile: Awaited<ReturnType<typeof detectSystemProfile>> = await detectSystemProfile()
  return {
    katagoReady: profile.katagoReady,
    katagoStatus: profile.katagoStatus,
    katagoModelPreset: profile.katagoModelPreset,
    katagoModelPresets: profile.katagoModelPresets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      badge: preset.badge,
      group: preset.group,
      blockSize: preset.blockSize,
      speedTier: preset.speedTier,
      sizeHint: preset.sizeHint,
      recommended: preset.recommended
    })),
    katagoBinaryConfigured: Boolean(profile.katagoBin),
    katagoConfigConfigured: Boolean(profile.katagoConfig),
    katagoModelConfigured: Boolean(profile.katagoModel),
    proxyBaseUrl: profile.proxyBaseUrl,
    hasProxyApiKey: Boolean(profile.proxyApiKey || profile.hasLlmApiKey),
    proxyModels: profile.proxyModels,
    notes: profile.notes
  }
}

function safeSettingsSummaryForAgent(settings: ReturnType<typeof getSettings>): JsonObject {
  return {
    katagoModelPreset: settings.katagoModelPreset,
    katagoBinaryConfigured: Boolean(settings.katagoBin),
    katagoConfigConfigured: Boolean(settings.katagoConfig),
    katagoModelConfigured: Boolean(settings.katagoModel),
    llmBaseUrl: settings.llmBaseUrl,
    llmModel: settings.llmModel,
    hasLlmApiKey: Boolean(settings.llmApiKey),
    ttsProvider: settings.ttsProvider,
    ttsLanguage: settings.ttsLanguage,
    hasTtsCustomApiKey: Boolean(settings.ttsCustomApiKey),
    hasTtsVolcengineApiKey: Boolean(settings.ttsVolcengineApiKey),
    hasTtsVolcengineAccessToken: Boolean(settings.ttsVolcengineAccessToken),
    reviewLanguage: settings.reviewLanguage
  }
}

async function ensureSessionGame(state: TeacherAgentSessionState, gameIdInput?: string): Promise<LibraryGame | undefined> {
  const gameId = gameIdInput || state.request.gameId
  if (!gameId) {
    return undefined
  }
  if (state.game?.id === gameId) {
    return state.game
  }
  const indexed = getGames().find((item) => item.id === gameId)
  if (!indexed) {
    throw new Error(`找不到棋谱: ${gameId}`)
  }
  const game = await ensureFoxGameDownloaded(indexed)
  state.game = game
  return game
}

async function ensureSessionRecord(state: TeacherAgentSessionState, gameIdInput?: string): Promise<ReturnType<typeof readGameRecord> | undefined> {
  const game = await ensureSessionGame(state, gameIdInput)
  if (!game) {
    return undefined
  }
  if (state.record?.game.id === game.id) {
    return state.record
  }
  const record = readGameRecord(game)
  state.record = record
  return record
}

function taskTypeForIntent(intent: TeacherIntent): StructuredTeacherResult['taskType'] {
  if (intent === 'current-move') return 'current-move'
  if (intent === 'game-review') return 'full-game'
  if (intent === 'batch-review') return 'recent-games'
  if (intent === 'move-range') return 'move-range'
  return 'freeform'
}

function artifactKindForIntent(intent: TeacherIntent): TeacherArtifactKind {
  if (intent === 'current-move') return 'current-move-review'
  if (intent === 'move-range') return 'move-range-review'
  if (intent === 'game-review' || intent === 'batch-review') return 'game-review'
  if (intent === 'training-plan') return 'training-plan'
  return 'freeform'
}

function defaultArtifactTitleForState(state: TeacherAgentSessionState): string {
  if (state.intent === 'current-move') {
    return `第 ${state.request.moveNumber ?? state.lastAnalysis?.moveNumber ?? 0} 手分析`
  }
  if (state.intent === 'move-range') {
    return `第 ${state.request.moveRange?.start ?? '?'}-${state.request.moveRange?.end ?? '?'} 手区间复盘`
  }
  if (state.intent === 'game-review') return '整盘复盘'
  if (state.intent === 'batch-review') return `${state.studentName} 最近对局分析`
  if (state.intent === 'training-plan') return `${state.studentName} 训练计划`
  return `${state.studentName} 对话`
}

function initialAgentUserMessage(state: TeacherAgentSessionState): ChatMessage {
  const visionEvidence = state.request.visionEvidence ?? buildVisionEvidenceReport(state.request, state.intent)
  const visionValidation = validateVisionEvidenceForIntent(visionEvidence, state.intent)
  if (!visionValidation.ok && !allowToolFirstVision(state.request)) {
    throw new Error(`棋盘图证据不完整：${visionValidation.blockingIssues.join('；')}`)
  }
  const currentGame = state.request.gameId ? getGames().find((game) => game.id === state.request.gameId) : undefined
  const context = {
    userPrompt: state.request.prompt,
    intent: state.intent,
    gameId: state.request.gameId,
    game: currentGame ? summarizeGames([currentGame])[0] : undefined,
    moveNumber: state.request.moveNumber,
    playerName: state.request.playerName || state.studentName,
    coachLevel: state.request.coachLevel ?? state.profile.userLevel,
    studentAgeRange: state.request.studentAgeRange ?? getSettings().defaultStudentAgeRange,
    teacherStyle: state.request.teacherStyle ?? getSettings().teacherStyle,
    studentRank: getSettings().defaultStudentRank,
    studentAge: getSettings().defaultStudentAge,
    responseLanguage: teacherLanguageName(getSettings().reviewLanguage),
    terminologyDensity: getSettings().teacherTerminologyDensity,
    explanationPace: getSettings().teacherExplanationPace,
    variationDetail: getSettings().teacherVariationDetail,
    visionEvidence,
    visionWarnings: visionValidation.warnings,
    boardImageAttached: visionEvidence.attached,
    boardImagesAttached: visionEvidence.imageCount,
    boardImageRequired: visionEvidence.required,
    moveRange: state.request.moveRange,
    moveRangeSummary: state.request.moveRangeSummary,
    prefetchedAnalysisAvailable: Boolean(state.request.prefetchedAnalysis),
    note: '请按需要调用工具取得事实；没有工具证据时不要猜坐标、胜率、PV、定式名或来源；默认使用 responseLanguage 回答。讲目数优先使用 teacherScore.text；对学生不要主动解释内部口径。'
  }
  const text = [
    '任务说明：请根据 intent 完成用户请求。',
    '你可以自主调用工具获取棋谱、棋盘图、KataGo 数据、知识库和学生画像；不要等待程序替你预处理。',
    'board.captureTeachingImage 是用来看棋盘图片的工具；拿到图后再调用 KataGo、调用知识库，匹配棋形、定式、死活、手筋或常见错误类型。',
    '如果 intent 是 current-move，请调用 board.captureTeachingImage 获取当前手棋盘图，再调用 katago.analyzePosition 和 knowledge.matchPosition/searchLocal 核对事实。',
    '如果 intent 是 game-review，请先调用 sgf.readGameRecord 和 katago.analyzeGameBatch 找关键问题手，再调用 board.captureTeachingImage(selection=top-loss,maxImages=3-6) 获取关键手图，最后调用知识库工具讲解。',
    '如果 intent 是 move-range，请调用 katago.analyzeMoveRangeKeyMoves 精读区间关键手，再调用 board.captureTeachingImage(selection=move-range-top-loss,maxImages=3-6) 获取关键手图。',
    '当前手讲解要按工具返回的 teachingDensity 掌握详略：常规定式少讲；定式分支或相似型列关键变化；中盘战、攻杀、转换要讲目的、对方应手、后续变化和实战评价。',
    'boardImageAttached=true 表示本轮用户消息已附棋盘图；否则请先调用 board.captureTeachingImage。请把图片中的棋形、厚薄、急所和全局方向作为局面判断依据。',
    '如果 visionEvidence.attached=true，本轮已经提供棋盘图，严禁说“没有棋盘图”“看不到棋盘”“未提供图片”。',
    '如果 visionEvidence.required=true 但证据不完整，程序会阻止任务执行；你不需要猜测缺失图片。',
    formatVisionEvidenceForPrompt(visionEvidence),
    'moveRangeSummary 是 renderer/cache 预先提取的区间关键手摘要；如证据不足，可调用 katago.analyzeMoveRangeKeyMoves 精读这些关键手。',
    '区间摘要：',
    formatMoveRangeSummaryForPrompt(state.request.moveRangeSummary),
    'KataGo 搜索证据摘要：',
    formatKataGoTraceForPrompt(state.request.prefetchedAnalysis?.tracePacket ?? state.lastAnalysis?.tracePacket),
    'prefetchedAnalysisAvailable=true 表示 katago.analyzePosition 可复用已缓存的 KataGo 分析结果。',
    '上下文JSON：',
    JSON.stringify(context)
  ].join('\n')
  const visionParts = buildVisionImageContentParts(state.request, visionEvidence)
  if (visionParts.length > 0) {
    return {
      role: 'user',
      content: [{ type: 'text', text }, ...visionParts]
    }
  }
  return { role: 'user', content: text }
}

function summarizeGames(games: LibraryGame[]): JsonObject[] {
  return games.map((game) => ({
    id: game.id,
    title: game.title,
    black: game.black,
    white: game.white,
    rawResult: game.result,
    resultSummary: gameResultSummary(game),
    date: game.date,
    source: game.source,
    downloadStatus: game.downloadStatus,
    moveCount: game.moveCount
  }))
}

function komiSummaryForRecord(record: ReturnType<typeof readGameRecord>): ReturnType<typeof komiSummary> {
  return komiSummary(record.komi, {
    source: record.game.source,
    rules: record.rules,
    handicap: record.handicap,
    initialStoneCount: record.initialStones?.length ?? 0
  })
}

type StoneColor = GameMove['color']

function oppositeColor(color: StoneColor): StoneColor {
  return color === 'B' ? 'W' : 'B'
}

function displayWinrateForColor(blackWinrate: number | undefined, color: StoneColor): number {
  const value = typeof blackWinrate === 'number' && Number.isFinite(blackWinrate) ? blackWinrate : 0
  return color === 'B' ? value : 100 - value
}

function displayScoreLeadForColor(blackScoreLead: number | undefined, color: StoneColor): number {
  return scoreLeadForColor(blackScoreLead, color)
}

function roundMetric(value: number | undefined, digits = 2): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function compactCandidateForColor(candidate: KataGoMoveAnalysis['before']['topMoves'][number], color: StoneColor, rank: number): JsonObject {
  return {
    ...candidate,
    rank,
    order: rank,
    perspectiveColor: color,
    winrate: roundMetric(displayWinrateForColor(candidate.winrate, color), 2),
    scoreLead: roundMetric(displayScoreLeadForColor(candidate.scoreLead, color), 2),
    blackWinrate: roundMetric(candidate.winrate, 2),
    blackScoreLead: roundMetric(candidate.scoreLead, 2),
    scoreSummary: scoreSummaryFromBlackLead(candidate.scoreLead, color)
  }
}

function compactPlayedMoveForColor(
  playedMove: KataGoMoveAnalysis['playedMove'],
  color: StoneColor
): JsonObject | undefined {
  if (!playedMove) return undefined
  return {
    ...playedMove,
    perspectiveColor: color,
    winrate: roundMetric(playedMove.playerWinrate ?? displayWinrateForColor(playedMove.winrate, color), 2),
    scoreLead: roundMetric(playedMove.playerScoreLead ?? displayScoreLeadForColor(playedMove.scoreLead, color), 2),
    blackWinrate: roundMetric(playedMove.winrate, 2),
    blackScoreLead: roundMetric(playedMove.scoreLead, 2),
    scoreSummary: scoreSummaryFromBlackLead(playedMove.scoreLead, color),
    playerWinrate: roundMetric(playedMove.playerWinrate ?? displayWinrateForColor(playedMove.winrate, color), 2),
    playerScoreLead: roundMetric(playedMove.playerScoreLead ?? displayScoreLeadForColor(playedMove.scoreLead, color), 2)
  }
}

function teacherScoreForAnalysis(
  analysis: KataGoMoveAnalysis,
  record?: ReturnType<typeof readGameRecord>
): JsonObject {
  const finalResult = record && analysis.moveNumber === record.moves.length ? gameResultSummary(record.game) : undefined
  if (finalResult?.confidence === 'recorded-result' && finalResult.teacherText) {
    return {
      text: finalResult.teacherText,
      source: 'game-record',
      resultSummary: finalResult,
      note: '终局手使用棋谱记录结果；对学生直接讲 text。'
    }
  }
  const scoreSummary = scoreSummaryFromBlackLead(analysis.after.scoreLead)
  return {
    text: scoreSummary.text,
    source: 'katago-current-position',
    scoreSummary,
    note: '中盘和当前局面使用 KataGo 当前估值；对学生直接讲 text。'
  }
}

function compactAnalysis(
  analysis: KataGoMoveAnalysis,
  record?: ReturnType<typeof readGameRecord>
): JsonObject {
  const teachingPacing = buildTeachingPacingAdvice(analysis)
  const teachingEvidenceBundle = buildTeachingEvidenceBundle({ analysis })
  const playerColor = analysis.currentMove?.color ?? 'B'
  const afterSideToMoveColor = analysis.currentMove ? oppositeColor(analysis.currentMove.color) : playerColor
  return {
    gameId: analysis.gameId,
    moveNumber: analysis.moveNumber,
    boardSize: analysis.boardSize,
    currentMove: analysis.currentMove,
    judgement: analysis.judgement,
    teacherScore: teacherScoreForAnalysis(analysis, record),
    winratePerspective: {
      primaryFields: 'board-display/player perspective',
      rawFields: 'blackWinrate/blackScoreLead',
      beforePerspectiveColor: playerColor,
      afterActualPerspectiveColor: playerColor,
      afterTopMovesPerspectiveColor: afterSideToMoveColor,
      scorePerspective: 'Use scoreSummary for winner and margin claims. scoreLead is perspectiveColor-relative; blackScoreLead is black-positive.',
      note: 'Use winrate for teacher-visible winrate claims. For score winner/margin, use scoreSummary.text/leader/leadPoints for internal verification, but prefer teacherScore.text for student-facing wording; do not explain internal score-source details unless asked.'
    },
    before: {
      perspectiveColor: playerColor,
      winrate: roundMetric(displayWinrateForColor(analysis.before.winrate, playerColor), 2),
      scoreLead: roundMetric(displayScoreLeadForColor(analysis.before.scoreLead, playerColor), 2),
      blackWinrate: roundMetric(analysis.before.winrate, 2),
      blackScoreLead: roundMetric(analysis.before.scoreLead, 2),
      scoreSummary: scoreSummaryFromBlackLead(analysis.before.scoreLead, playerColor),
      topMoves: analysis.before.topMoves.slice(0, 8).map((candidate, index) => compactCandidateForColor(candidate, playerColor, index + 1))
    },
    after: {
      perspectiveColor: playerColor,
      topMovesPerspectiveColor: afterSideToMoveColor,
      winrate: roundMetric(displayWinrateForColor(analysis.after.winrate, playerColor), 2),
      scoreLead: roundMetric(displayScoreLeadForColor(analysis.after.scoreLead, playerColor), 2),
      blackWinrate: roundMetric(analysis.after.winrate, 2),
      blackScoreLead: roundMetric(analysis.after.scoreLead, 2),
      scoreSummary: scoreSummaryFromBlackLead(analysis.after.scoreLead, playerColor),
      topMoves: analysis.after.topMoves.slice(0, 5).map((candidate, index) => compactCandidateForColor(candidate, afterSideToMoveColor, index + 1))
    },
    playedMove: compactPlayedMoveForColor(analysis.playedMove, playerColor),
    analysisQuality: analysis.analysisQuality,
    moveClassification: analysis.moveClassification,
    pvConfidence: analysis.pvConfidence,
    tracePacket: analysis.tracePacket,
    teachingEvidenceBundle,
    teachingEvidenceSummary: formatTeachingEvidenceBundleForPrompt(teachingEvidenceBundle),
    humanCalibration: analysis.humanCalibration,
    ownershipSummary: analysis.ownershipSummary,
    tacticalSignals: analysis.tacticalSignals,
    teachingPacing
  }
}

async function knowledgeBundleForState(state: TeacherAgentSessionState, input: JsonObject): Promise<{
  knowledge: KnowledgePacket[]
  knowledgeMatches: KnowledgeMatch[]
  recommendedProblems: RecommendedProblem[]
  teachingPacing?: TeachingPacingAdvice
}> {
  const record = await ensureSessionRecord(state).catch(() => undefined)
  const analysis = state.lastAnalysis
  const moveNumber = numberInput(input, 'moveNumber', analysis?.moveNumber ?? state.request.moveNumber ?? record?.moves.length ?? 80, 0, record?.moves.length ?? 400)
  const boardSize = record?.boardSize ?? analysis?.boardSize ?? 19
  const boardState = record ? buildBoardState({
    boardSize,
    moves: record.moves,
    uptoMoveNumber: Math.max(0, moveNumber - 1),
    initialStones: record.initialStones
  }) : undefined
  const boardSnapshot = boardState ? boardStateToSnapshot(boardState) : undefined
  const anchors = (analysis
    ? [
        analysis.playedMove?.move ?? analysis.currentMove?.gtp,
        ...analysis.before.topMoves.slice(0, 6).map((candidate) => candidate.move),
        ...analysis.before.topMoves.slice(0, 2).flatMap((candidate) => candidate.pv.slice(0, 4))
      ]
    : arrayInput(input, 'candidateMoves')).filter((move): move is string => typeof move === 'string' && move.length > 0)
  const localWindows = boardSnapshot ? buildLocalWindows(boardSnapshot, anchors, boardSize) : undefined
  const tacticalSignals = boardState ? detectTacticalSignals(boardState, anchors) : []
  if (analysis) {
    analysis.tacticalSignals = tacticalSignals
  }
  const query = {
    text: stringInput(input, 'text', state.request.prompt),
    moveNumber,
    totalMoves: record?.moves.length ?? moveNumber,
    boardSize,
    recentMoves: record?.moves.slice(Math.max(0, moveNumber - 40), moveNumber) ?? [],
    userLevel: state.profile.userLevel,
    studentLevel: state.profile.userLevel,
    playerColor: analysis?.currentMove?.color,
    lossScore: analysis?.playedMove?.scoreLoss ?? numberInput(input, 'lossScore', 2),
    judgement: analysis?.judgement ?? 'mistake',
    contextTags: analysis ? tagsFromAnalysis(analysis, analysis.currentMove) : themesFromProfile(state.profile),
    playedMove: analysis?.playedMove?.move ?? analysis?.currentMove?.gtp ?? stringInput(input, 'playedMove'),
    candidateMoves: analysis?.before.topMoves.slice(0, 8).map((candidate) => candidate.move) ?? arrayInput(input, 'candidateMoves'),
    principalVariation: analysis?.before.topMoves.slice(0, 3).flatMap((candidate) => candidate.pv.slice(0, 8)) ?? arrayInput(input, 'principalVariation'),
    boardSnapshot,
    localWindows,
    maxResults: numberInput(input, 'maxResults', 4, 1, 8)
  }
  const knowledgeMatches = searchKnowledgeMatches({ ...query, maxResults: 8 })
  const recommendedProblems = recommendedProblemsFromMatches(knowledgeMatches, 3, { includeWeakFallback: true, includeJosekiFallback: true, includeDrillFallback: true })
  const knowledge = searchKnowledge(query)
  const teachingPacing = analysis ? buildTeachingPacingAdvice(analysis, knowledgeMatches) : undefined
  state.knowledge = knowledge
  state.knowledgeMatches = knowledgeMatches
  state.recommendedProblems = recommendedProblems
  state.teachingPacing = teachingPacing
  return { knowledge, knowledgeMatches, recommendedProblems, teachingPacing }
}

function analysisForMoveNumber(state: TeacherAgentSessionState, moveNumber: number): KataGoMoveAnalysis | undefined {
  if (state.lastAnalysis?.moveNumber === moveNumber) return state.lastAnalysis
  return state.rangeAnalyses?.find((analysis) => analysis.moveNumber === moveNumber)
}

function explicitMoveNumbers(input: JsonObject): number[] {
  const direct = numberArrayInput(input, 'moveNumbers')
  if (direct.length) return direct
  const single = numberInput(input, 'moveNumber', Number.NaN)
  return Number.isInteger(single) ? [single] : []
}

function selectCaptureMoveNumbers(
  input: JsonObject,
  state: TeacherAgentSessionState,
  record: ReturnType<typeof readGameRecord>,
  selection: BoardImageCaptureSelection,
  maxImages: number
): number[] {
  const clamp = (moveNumber: number): number => Math.max(0, Math.min(record.moves.length, Math.round(moveNumber)))
  if (selection === 'explicit-moves') {
    return explicitMoveNumbers(input).map(clamp)
  }
  if (selection === 'top-loss') {
    return state.batchIssues
      .filter((issue) => issue.moveNumber > 0)
      .sort((left, right) => right.loss - left.loss || left.moveNumber - right.moveNumber)
      .slice(0, maxImages)
      .map((issue) => clamp(issue.moveNumber))
  }
  if (selection === 'move-range-top-loss') {
    return (state.rangeAnalyses ?? [])
      .filter((analysis) => analysis.playedMove)
      .sort((left, right) =>
        (right.playedMove?.winrateLoss ?? 0) - (left.playedMove?.winrateLoss ?? 0) ||
        (right.playedMove?.scoreLoss ?? 0) - (left.playedMove?.scoreLoss ?? 0) ||
        left.moveNumber - right.moveNumber
      )
      .slice(0, maxImages)
      .map((analysis) => clamp(analysis.moveNumber))
  }
  const current = explicitMoveNumbers(input)[0] ?? state.request.moveNumber ?? state.lastAnalysis?.moveNumber ?? record.moves.length
  return [clamp(current)]
}

async function captureTeachingImagesForState(state: TeacherAgentSessionState, input: JsonObject): Promise<{
  images: AgentToolImageResult[]
  visionEvidence: VisionEvidenceReport
}> {
  if (!state.context?.captureBoardImages) {
    throw new Error('当前窗口没有注册棋盘截图渲染器，无法生成棋盘图。')
  }
  const gameId = stringInput(input, 'gameId', state.request.gameId)
  if (!gameId) throw new Error('board.captureTeachingImage 需要 gameId。')
  const record = await ensureSessionRecord(state, gameId)
  if (!record) throw new Error('没有可截图的棋谱。')
  const rawSelection = stringInput(input, 'selection', 'current') as BoardImageCaptureSelection
  const allowedSelections: BoardImageCaptureSelection[] = ['current', 'explicit-moves', 'top-loss', 'move-range-top-loss']
  const selection = allowedSelections.includes(rawSelection) ? rawSelection : 'current'
  const maxImages = numberInput(input, 'maxImages', selection === 'current' ? 1 : 6, 1, 6)
  let moveNumbers = selectCaptureMoveNumbers(input, state, record, selection, maxImages)
    .filter((moveNumber, index, all) => all.indexOf(moveNumber) === index)
    .slice(0, maxImages)
  if (!moveNumbers.length && selection !== 'current') {
    moveNumbers = selectCaptureMoveNumbers(input, state, record, 'current', 1)
  }
  if (!moveNumbers.length) {
    throw new Error('没有可截图的手数。请先读取棋谱或给出 moveNumber/moveNumbers。')
  }
  const captions = Object.fromEntries(moveNumbers.map((moveNumber, index) => {
    const prefix = moveNumbers.length > 1 ? `关键手图 ${index + 1}` : '棋盘图'
    return [moveNumber, `${prefix}: 第 ${moveNumber} 手；请结合这张棋盘图、KataGo 候选点和知识库匹配讲解。`]
  }))
  const analyses = moveNumbers
    .map((moveNumber) => analysisForMoveNumber(state, moveNumber))
    .filter((analysis): analysis is KataGoMoveAnalysis => Boolean(analysis))
  const rendered = await state.context.captureBoardImages({
    requestId: randomUUID(),
    runId: state.id,
    gameId,
    moveNumbers,
    captions,
    analyses
  })
  if (!rendered.length) {
    throw new Error('棋盘截图工具没有返回图片。')
  }
  const visionEvidence = appendToolCapturedVisionEvidence(state, rendered)
  state.pendingToolMessages.push(...toolImageMessages(rendered))
  return {
    images: rendered.map(stripImageData),
    visionEvidence
  }
}

function dangerousShellCommand(command: string): string | null {
  const normalized = command.trim().toLowerCase()
  const patterns: Array<[RegExp, string]> = [
    [/\brm\s+(-[a-z]*r[a-z]*f|-rf|-fr)\b/, '拒绝执行递归强制删除命令'],
    [/\bgit\s+reset\s+--hard\b/, '拒绝执行 git reset --hard'],
    [/\bgit\s+clean\s+-[a-z]*f\b/, '拒绝执行 git clean -f'],
    [/\bsudo\b/, '拒绝执行 sudo'],
    [/\b(shutdown|reboot|halt)\b/, '拒绝执行关机/重启命令'],
    [/\bmkfs\b|\bdd\s+if=.*\bof=\/dev\//, '拒绝执行磁盘破坏性命令']
  ]
  return patterns.find(([pattern]) => pattern.test(normalized))?.[1] ?? null
}

function runShell(input: JsonObject): Promise<unknown> {
  const command = stringInput(input, 'command')
  if (!command) {
    throw new Error('shell.exec 需要 command。')
  }
  const blocked = dangerousShellCommand(command)
  if (blocked) {
    throw new Error(blocked)
  }
  const cwdInput = stringInput(input, 'cwd')
  const cwd = cwdInput ? resolve(cwdInput) : process.cwd()
  const timeoutMs = numberInput(input, 'timeoutMs', 60_000, 1_000, 180_000)
  const runInBackground = booleanInput(input, 'runInBackground', false)
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.env.SHELL || 'zsh', ['-lc', command], {
      cwd,
      env: process.env,
      stdio: 'pipe'
    })
    const startedAt = new Date().toISOString()
    const taskId = randomUUID()
    let stdout = ''
    let stderr = ''
    let settled = false
    const append = (target: 'stdout' | 'stderr', chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      if (target === 'stdout') stdout = (stdout + text).slice(-MAX_SHELL_OUTPUT_CHARS)
      else stderr = (stderr + text).slice(-MAX_SHELL_OUTPUT_CHARS)
    }
    child.stdout.on('data', (chunk: Buffer) => append('stdout', chunk))
    child.stderr.on('data', (chunk: Buffer) => append('stderr', chunk))
    child.on('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
    const timer = setTimeout(() => {
      if (settled) return
      child.kill('SIGTERM')
      settled = true
      reject(new Error(`shell.exec 超时: ${timeoutMs}ms`))
    }, timeoutMs)
    if (runInBackground) {
      SHELL_TASKS.set(taskId, { id: taskId, command, cwd, process: child, startedAt })
      clearTimeout(timer)
      settled = true
      resolvePromise({
        backgroundTaskId: taskId,
        command: redactSensitiveText(command),
        cwd: redactSensitiveText(cwd),
        startedAt
      })
      return
    }
    child.on('close', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise({
        command: redactSensitiveText(command),
        cwd: redactSensitiveText(cwd),
        exitCode: code,
        signal,
        stdout: redactSensitiveText(stdout),
        stderr: redactSensitiveText(stderr)
      })
    })
  })
}

async function searchWebForGoKnowledge(input: JsonObject): Promise<unknown> {
  const query = stringInput(input, 'query', '围棋 复盘 教学')
  const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(12_000)
  })
  const html = await response.text()
  const titles = [...html.matchAll(/class="result__a"[^>]*>(.*?)<\/a>/g)]
    .slice(0, 5)
    .map((match) => match[1].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').trim())
    .filter(Boolean)
  return { query, titles }
}

function createTeacherAgentTools(state: TeacherAgentSessionState): TeacherAgentToolDefinition[] {
  return [
    {
      apiName: 'library_findGames',
      canonicalName: 'library.findGames',
      label: '筛选棋谱',
      description: '按棋手名、最近 N 盘或当前上下文查找本地棋谱列表。',
      parameters: schema({
        studentName: { type: 'string' },
        count: { type: 'number' }
      }),
      execute: async (input) => {
        const count = numberInput(input, 'count', inferCount(state.request.prompt), 1, 20)
        const studentName = stringInput(input, 'studentName', state.studentName)
        const games = findGamesForStudent(studentName, count)
        return { studentName, count, games: summarizeGames(games) }
      }
    },
    {
      apiName: 'sgf_readGameRecord',
      canonicalName: 'sgf.readGameRecord',
      label: '读取棋谱',
      description: '读取 SGF 主线、棋局信息和最近手顺。',
      parameters: schema({
        gameId: { type: 'string' },
        maxMoves: { type: 'number' }
      }),
      execute: async (input) => {
        const record = await ensureSessionRecord(state, stringInput(input, 'gameId'))
        if (!record) throw new Error('没有可读取的棋谱。')
        const maxMoves = numberInput(input, 'maxMoves', 80, 1, record.moves.length)
        const normalizedKomi = komiSummaryForRecord(record)
        return {
          game: summarizeGames([record.game])[0],
          boardSize: record.boardSize,
          rules: record.rules,
          komi: normalizedKomi.normalized,
          komiSummary: normalizedKomi,
          handicap: record.handicap,
          totalMoves: record.moves.length,
          moves: record.moves.slice(0, maxMoves)
        }
      }
    },
    {
      apiName: 'katago_analyzePosition',
      canonicalName: 'katago.analyzePosition',
      label: 'KataGo 局面分析',
      description: '分析单个局面，返回胜率、目差、候选点、搜索数、PV 和实战手损失。',
      parameters: schema({
        gameId: { type: 'string' },
        moveNumber: { type: 'number' },
        maxVisits: { type: 'number' }
      }),
      execute: async (input) => {
        assertTeacherRunActive(state.context)
        const gameId = stringInput(input, 'gameId', state.request.gameId)
        if (!gameId) throw new Error('katago.analyzePosition 需要 gameId。')
        const record = await ensureSessionRecord(state, gameId)
        const moveNumber = numberInput(input, 'moveNumber', state.request.moveNumber ?? record?.moves.length ?? 0, 0, record?.moves.length ?? 400)
        const prefetched = state.request.prefetchedAnalysis
        const analysis = prefetched?.gameId === gameId && prefetched.moveNumber === moveNumber
          ? prefetched
          : await (async () => {
              pauseInteractiveKataGoWork()
              return analyzePosition(gameId, moveNumber, numberInput(input, 'maxVisits', 520, 40, 3000), {
                runId: state.id,
                group: 'teacher'
              })
            })()
        assertTeacherRunActive(state.context)
        state.lastAnalysis = analysis
        state.teachingPacing = buildTeachingPacingAdvice(analysis)
        return compactAnalysis(analysis, record)
      }
    },
    {
      apiName: 'katago_analyzeGameBatch',
      canonicalName: 'katago.analyzeGameBatch',
      label: '批量 KataGo',
      description: '分析一盘或多盘棋，提取按胜率损失排序的问题手。',
      parameters: schema({
        studentName: { type: 'string' },
        count: { type: 'number' },
        gameId: { type: 'string' },
        maxVisits: { type: 'number' },
        minWinrateDrop: { type: 'number' }
      }),
      execute: async (input) => {
        const gameId = stringInput(input, 'gameId')
        const count = gameId ? 1 : numberInput(input, 'count', inferCount(state.request.prompt), 1, 20)
        const studentName = stringInput(input, 'studentName', state.studentName)
        const games = gameId
          ? getGames().filter((game) => game.id === gameId)
          : findGamesForStudent(studentName, count)
        const issues: BatchIssue[] = []
        const failedGames: Array<{ gameId: string; title: string; error: string }> = []
        const requestedVisits = numberInput(input, 'maxVisits', 24, 1, 600)
        const sweepVisits = Math.min(80, Math.max(24, requestedVisits))
        const refineVisits = Math.max(120, Math.min(420, requestedVisits * 16))
        const refineTopN = count > 1 ? 2 : 4
        const minWinrateDrop = numberInput(input, 'minWinrateDrop', 6, 1, 40)
        cancelKataGoAnalysis({ group: 'quick' })
        for (const game of games) {
          assertTeacherRunActive(state.context)
          let analyses: Awaited<ReturnType<typeof analyzeGameQuick>>
          try {
            analyses = await analyzeGameQuick(game.id, sweepVisits, undefined, {
              refineVisits,
              refineTopN,
              runId: `${state.id}-batch-${game.id}`,
              group: 'teacher'
            })
          } catch (error) {
            if (/KataGo 分析超时|timed out|timeout/i.test(String(error))) {
              failedGames.push({
                gameId: game.id,
                title: game.title,
                error: 'KataGo 整盘快扫超时，已跳过这盘。'
              })
              continue
            }
            throw error
          }
          assertTeacherRunActive(state.context)
          issues.push(...extractIssuesFromAnalyses(analyses, game, minWinrateDrop))
        }
        state.batchIssues = issues
        return {
          studentName,
          analysisMode: 'fast-sweep-plus-key-move-refine',
          visits: {
            sweep: sweepVisits,
            refine: refineVisits,
            refineTopN
          },
          status: failedGames.length === 0 ? 'complete' : issues.length > 0 ? 'partial' : 'failed',
          games: summarizeGames(games),
          failedGames,
          issues: issues.filter((issue) => issue.loss > 0).sort((a, b) => b.loss - a.loss).slice(0, 30)
        }
      }
    },
    {
      apiName: 'katago_analyzeMoveRangeKeyMoves',
      canonicalName: 'katago.analyzeMoveRangeKeyMoves',
      label: 'KataGo 区间关键手精读',
      description: '只精读区间内 top-loss 关键手，避免对长区间逐手高成本分析。返回每个关键手的 KataGo 证据、analysisQuality 和候选点。',
      parameters: schema({
        moveNumbers: {
          type: 'array',
          items: { type: 'number' },
          description: '需要精读的手数；为空时使用 moveRangeSummary.keyMoves。最多 6 手。'
        }
      }),
      execute: async (input) => {
        const gameId = state.request.gameId
        if (!gameId) throw new Error('katago.analyzeMoveRangeKeyMoves 需要 gameId。')
        const fallbackRange = state.request.moveRange ?? parseMoveRangeFromPrompt(state.request.prompt ?? '') ?? undefined
        const raw = Array.isArray(input.moveNumbers) ? input.moveNumbers : []
        const requested = raw.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
        const selected = (requested.length ? requested : selectMoveNumbersForRangeRefine(state.request.moveRangeSummary, fallbackRange))
          .filter((moveNumber, index, all) => all.indexOf(moveNumber) === index)
          .slice(0, MOVE_RANGE_KEY_MOVE_LIMIT)
        if (!selected.length) {
          throw new Error('没有可精读的区间关键手。请先提供 moveRangeSummary 或 moveNumbers。')
        }
        const analyses = []
        pauseInteractiveKataGoWork()
        for (const moveNumber of selected) {
          assertTeacherRunActive(state.context)
          analyses.push(await analyzePosition(gameId, moveNumber, 500, {
            runId: state.id,
            group: 'teacher'
          }))
        }
        state.rangeAnalyses = analyses
        return {
          moveRange: state.request.moveRange,
          refinedMoveCount: analyses.length,
          analyses: analyses.map((analysis) => compactAnalysis(analysis))
        }
      }
    },
    {
      apiName: 'board_captureTeachingImage',
      canonicalName: 'board.captureTeachingImage',
      label: '棋盘截图',
      description: '生成当前手、指定手数、整盘 top-loss 或区间 top-loss 的棋盘截图，并把图片作为下一轮多模态输入回填给模型。',
      parameters: schema({
        gameId: { type: 'string' },
        moveNumber: { type: 'number' },
        moveNumbers: { type: 'array', items: { type: 'number' } },
        selection: { type: 'string', enum: ['current', 'explicit-moves', 'top-loss', 'move-range-top-loss'] },
        maxImages: { type: 'number' }
      }),
      execute: async (input) => captureTeachingImagesForState(state, input)
    },
    {
      apiName: 'knowledge_searchLocal',
      canonicalName: 'knowledge.searchLocal',
      label: '本地知识库',
      description: '检索本地教学卡、定式、死活、手筋和训练题。',
      parameters: schema({
        text: { type: 'string' },
        moveNumber: { type: 'number' },
        playedMove: { type: 'string' },
        candidateMoves: { type: 'array', items: { type: 'string' } },
        principalVariation: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' }
      }),
      execute: async (input) => knowledgeBundleForState(state, input)
    },
    {
      apiName: 'knowledge_matchPosition',
      canonicalName: 'knowledge.matchPosition',
      label: '匹配棋形',
      description: '结合当前棋盘、KataGo 候选点、PV 和局部窗口匹配定式、死活、手筋、棋形与概念。',
      parameters: schema({
        text: { type: 'string' },
        moveNumber: { type: 'number' },
        playedMove: { type: 'string' },
        candidateMoves: { type: 'array', items: { type: 'string' } },
        principalVariation: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' }
      }),
      execute: async (input) => knowledgeBundleForState(state, { ...input, maxResults: numberInput(input, 'maxResults', 6, 1, 8) })
    },
    {
      apiName: 'knowledge_searchJoseki',
      canonicalName: 'knowledge.searchJoseki',
      label: '检索定式',
      description: '优先检索本局相关的定式、布局分支、选择条件和常见误区。',
      parameters: schema({
        text: { type: 'string' },
        moveNumber: { type: 'number' },
        maxResults: { type: 'number' }
      }),
      execute: async (input) => {
        const bundle = await knowledgeBundleForState(state, { ...input, text: `定式 joseki ${stringInput(input, 'text', state.request.prompt)}` })
        return {
          ...bundle,
          knowledgeMatches: bundle.knowledgeMatches.filter((match) => match.matchType === 'joseki').slice(0, numberInput(input, 'maxResults', 4, 1, 8))
        }
      }
    },
    {
      apiName: 'knowledge_searchLifeDeath',
      canonicalName: 'knowledge.searchLifeDeath',
      label: '检索死活',
      description: '优先检索本局相关的死活题型、眼形、对杀、劫活和训练题。',
      parameters: schema({
        text: { type: 'string' },
        moveNumber: { type: 'number' },
        maxResults: { type: 'number' }
      }),
      execute: async (input) => {
        const bundle = await knowledgeBundleForState(state, { ...input, text: `死活 life death ${stringInput(input, 'text', state.request.prompt)}` })
        return {
          ...bundle,
          knowledgeMatches: bundle.knowledgeMatches.filter((match) => match.matchType === 'life_death').slice(0, numberInput(input, 'maxResults', 4, 1, 8))
        }
      }
    },
    {
      apiName: 'knowledge_searchTesuji',
      canonicalName: 'knowledge.searchTesuji',
      label: '检索手筋',
      description: '优先检索本局相关的手筋、筋形、攻击防守技巧和训练题。',
      parameters: schema({
        text: { type: 'string' },
        moveNumber: { type: 'number' },
        maxResults: { type: 'number' }
      }),
      execute: async (input) => {
        const bundle = await knowledgeBundleForState(state, { ...input, text: `手筋 tesuji ${stringInput(input, 'text', state.request.prompt)}` })
        return {
          ...bundle,
          knowledgeMatches: bundle.knowledgeMatches.filter((match) => match.matchType === 'tesuji').slice(0, numberInput(input, 'maxResults', 4, 1, 8))
        }
      }
    },
    {
      apiName: 'knowledge_recommendProblems',
      canonicalName: 'knowledge.recommendProblems',
      label: '推荐训练题',
      description: '基于当前知识匹配和学生画像推荐 2-4 道相关死活或手筋训练题。',
      parameters: schema({
        text: { type: 'string' },
        moveNumber: { type: 'number' },
        maxResults: { type: 'number' }
      }),
      execute: async (input) => {
        const bundle = await knowledgeBundleForState(state, input)
        const maxResults = numberInput(input, 'maxResults', 3, 1, 6)
        return {
          recommendedProblems: recommendedProblemsFromMatches(bundle.knowledgeMatches, maxResults, {
            includeWeakFallback: true,
            includeJosekiFallback: true,
            includeDrillFallback: true
          })
        }
      }
    },
    {
      apiName: 'katago_getAnalysisCache',
      canonicalName: 'katago.getAnalysisCache',
      label: '读取分析缓存',
      description: '读取本轮 agent 已经取得的 KataGo 单点、区间或整盘关键手摘要。',
      parameters: schema({}),
      execute: async () => ({
        lastAnalysis: state.lastAnalysis ? compactAnalysis(state.lastAnalysis, state.record) : null,
        rangeAnalyses: state.rangeAnalyses?.slice(0, 8).map((analysis) => compactAnalysis(analysis, state.record)) ?? [],
        batchIssues: state.batchIssues.slice(0, 12).map((issue) => ({
          gameId: issue.game.id,
          moveNumber: issue.moveNumber,
          playedMove: issue.playedMove,
          bestMove: issue.bestMove,
          winrateLoss: issue.loss,
          scoreLoss: issue.scoreLead,
          pv: issue.pv
        }))
      })
    },
    {
      apiName: 'katago_getTracePacket',
      canonicalName: 'katago.getTracePacket',
      label: '读取搜索证据',
      description: '获取指定局面的 KataGo tracePacket，解释 policy/value/search/PV/ownership/humanPolicy 信号。',
      parameters: schema({
        gameId: { type: 'string' },
        moveNumber: { type: 'number' },
        maxVisits: { type: 'number' }
      }),
      execute: async (input) => {
        const gameId = stringInput(input, 'gameId', state.request.gameId)
        if (!gameId) throw new Error('katago.getTracePacket 需要 gameId。')
        const record = await ensureSessionRecord(state, gameId)
        const moveNumber = numberInput(input, 'moveNumber', state.request.moveNumber ?? record?.moves.length ?? 0, 0, record?.moves.length ?? 400)
        const cached = analysisForMoveNumber(state, moveNumber)
        if (!cached) {
          pauseInteractiveKataGoWork()
        }
        const analysis = cached ?? await analyzePosition(gameId, moveNumber, numberInput(input, 'maxVisits', 520, 40, 3000), {
          runId: state.id,
          group: 'teacher'
        })
        state.lastAnalysis = analysis
        return {
          gameId,
          moveNumber,
          tracePacket: analysis.tracePacket,
          analysisQuality: analysis.analysisQuality,
          teachingPacing: buildTeachingPacingAdvice(analysis)
        }
      }
    },
    {
      apiName: 'katago_compareMoves',
      canonicalName: 'katago.compareMoves',
      label: '比较候选点',
      description: '比较实战点、指定候选点和 KataGo 一选之间的胜率差、目差差、搜索数、PV 支撑。',
      parameters: schema({
        gameId: { type: 'string' },
        moveNumber: { type: 'number' },
        moves: { type: 'array', items: { type: 'string' } },
        maxVisits: { type: 'number' }
      }),
      execute: async (input) => {
        const gameId = stringInput(input, 'gameId', state.request.gameId)
        if (!gameId) throw new Error('katago.compareMoves 需要 gameId。')
        const record = await ensureSessionRecord(state, gameId)
        const moveNumber = numberInput(input, 'moveNumber', state.request.moveNumber ?? record?.moves.length ?? 0, 0, record?.moves.length ?? 400)
        const analysis = analysisForMoveNumber(state, moveNumber) ?? await analyzePosition(gameId, moveNumber, numberInput(input, 'maxVisits', 520, 40, 3000), {
          runId: state.id,
          group: 'teacher'
        })
        state.lastAnalysis = analysis
        const requested = new Set(arrayInput(input, 'moves').map((move) => move.toUpperCase()))
        const playerColor = analysis.currentMove?.color ?? 'B'
        const top = analysis.before.topMoves[0]
        return {
          gameId,
          moveNumber,
          playedMove: compactPlayedMoveForColor(analysis.playedMove, playerColor),
          bestMove: top ? compactCandidateForColor(top, playerColor, 1) : null,
          requestedMoves: analysis.before.topMoves
            .filter((candidate) => requested.size === 0 || requested.has(candidate.move.toUpperCase()))
            .slice(0, requested.size ? 12 : 6)
            .map((candidate, index) => compactCandidateForColor(candidate, playerColor, index + 1)),
          tracePacket: analysis.tracePacket
        }
      }
    },
    {
      apiName: 'studentProfile_read',
      canonicalName: 'studentProfile.read',
      label: '读取棋手画像',
      description: '读取棋手长期画像、常见问题和训练重点。',
      parameters: schema({
        studentName: { type: 'string' }
      }),
      execute: async (input) => {
        const profile = getStudentProfile(stringInput(input, 'studentName', state.studentName))
        state.profile = profile
        return profile
      }
    },
    {
      apiName: 'studentProfile_write',
      canonicalName: 'studentProfile.write',
      label: '更新棋手画像',
      description: '把本次分析得到的弱点、问题模式和训练重点写入棋手画像。',
      parameters: schema({
        studentName: { type: 'string' },
        reviewedGames: { type: 'number' },
        mistakeTags: { type: 'array', items: { type: 'string' } },
        recentPatterns: { type: 'array', items: { type: 'string' } },
        trainingFocus: { type: 'array', items: { type: 'string' } }
      }),
      execute: async (input) => {
        const profile = updateStudentProfile(stringInput(input, 'studentName', state.studentName), {
          reviewedGames: numberInput(input, 'reviewedGames', 0, 0, 100),
          mistakeTags: arrayInput(input, 'mistakeTags'),
          recentPatterns: arrayInput(input, 'recentPatterns'),
          trainingFocus: arrayInput(input, 'trainingFocus'),
          gameId: state.request.gameId,
          typicalMoves: state.lastAnalysis?.playedMove
            ? [{
                gameId: state.lastAnalysis.gameId,
                moveNumber: state.lastAnalysis.moveNumber,
                label: `${state.lastAnalysis.playedMove.move} -> ${state.lastAnalysis.before.topMoves[0]?.move ?? '未知'}`,
                lossWinrate: state.lastAnalysis.playedMove.winrateLoss,
                lossScore: state.lastAnalysis.playedMove.scoreLoss
              }]
            : []
        })
        state.profile = profile
        return profile
      }
    },
    {
      apiName: 'system_detectEnvironment',
      canonicalName: 'system.detectEnvironment',
      label: '探测环境',
      description: '探测 KataGo、模型、配置和本机兼容代理。',
      parameters: schema({}),
      execute: async () => safeSystemProfileForAgent()
    },
    {
      apiName: 'settings_writeAppConfig',
      canonicalName: 'settings.writeAppConfig',
      label: '写入配置',
      description: '应用自动探测到的 KataGo 和 LLM 配置。',
      parameters: schema({}),
      execute: async () => {
        const updated = replaceSettings(await applyDetectedDefaults(getSettings()))
        return {
          ok: true,
          settings: safeSettingsSummaryForAgent(updated)
        }
      }
    },
    {
      apiName: 'katago_verifyAnalysis',
      canonicalName: 'katago.verifyAnalysis',
      label: '验证 KataGo',
      description: '用当前棋谱做一次低访问量分析，验证 KataGo 可运行。',
      parameters: schema({
        gameId: { type: 'string' },
        moveNumber: { type: 'number' }
      }),
      execute: async (input) => {
        assertTeacherRunActive(state.context)
        const gameId = stringInput(input, 'gameId', state.request.gameId)
        if (!gameId) throw new Error('katago.verifyAnalysis 需要 gameId。')
        const record = await ensureSessionRecord(state, gameId)
        const analysis = await analyzePosition(gameId, numberInput(input, 'moveNumber', state.request.moveNumber ?? record?.moves.length ?? 0), 80, {
          runId: state.id,
          group: 'teacher'
        })
        return compactAnalysis(analysis, record)
      }
    },
    {
      apiName: 'web_searchGoKnowledge',
      canonicalName: 'web.searchGoKnowledge',
      label: '联网搜索',
      description: '按泛化围棋主题搜索外部资料，不发送隐私、棋谱原文或截图。',
      parameters: schema({
        query: { type: 'string' }
      }, ['query']),
      execute: async (input) => searchWebForGoKnowledge(input)
    },
    {
      apiName: 'filesystem_read',
      canonicalName: 'filesystem.read',
      label: '读取文件',
      description: '读取本机文件内容，输出会自动截断并脱敏。',
      parameters: schema({
        path: { type: 'string' },
        maxBytes: { type: 'number' }
      }, ['path']),
      execute: async (input) => {
        const filePath = resolve(stringInput(input, 'path'))
        if (!existsSync(filePath)) throw new Error(`文件不存在: ${filePath}`)
        const maxBytes = numberInput(input, 'maxBytes', 16_000, 1, 80_000)
        return {
          path: redactSensitiveText(filePath),
          content: redactSensitiveText(readFileSync(filePath, 'utf8').slice(0, maxBytes))
        }
      }
    },
    {
      apiName: 'shell_exec',
      canonicalName: 'shell.exec',
      label: 'Shell',
      description: '在本机 shell 执行命令，支持 cwd、超时和后台任务；输出会截断并脱敏。',
      parameters: schema({
        command: { type: 'string' },
        cwd: { type: 'string' },
        timeoutMs: { type: 'number' },
        description: { type: 'string' },
        runInBackground: { type: 'boolean' }
      }, ['command']),
      execute: async (input) => runShell(input)
    },
    {
      apiName: 'shell_kill',
      canonicalName: 'shell.kill',
      label: '停止 Shell',
      description: '停止 shell.exec 启动的后台任务。',
      parameters: schema({
        backgroundTaskId: { type: 'string' }
      }, ['backgroundTaskId']),
      execute: async (input) => {
        const id = stringInput(input, 'backgroundTaskId')
        const task = SHELL_TASKS.get(id)
        if (!task) return { stopped: false, reason: 'background task not found' }
        task.process.kill('SIGTERM')
        SHELL_TASKS.delete(id)
        return {
          stopped: true,
          backgroundTaskId: id,
          command: redactSensitiveText(task.command),
          cwd: redactSensitiveText(task.cwd)
        }
      }
    },
    {
      apiName: 'artifact_createTeachingArtifact',
      canonicalName: 'artifact.createTeachingArtifact',
      label: '创建教学产物',
      description: '提交结构化 TeachingArtifact JSON。只放棋局证据、候选点、关键手、知识点和训练建议；不要放 exportHtml、脚本、远程资源、base64 图片、本地路径或 API key。',
      parameters: schema({
        artifact: {
          type: 'object',
          description: '可选包装字段；也可以直接在顶层传 TeachingArtifact 字段。',
          additionalProperties: true
        },
        id: { type: 'string' },
        kind: { type: 'string', enum: ['current-move-review', 'move-range-review', 'game-review', 'training-plan', 'freeform'] },
        title: { type: 'string' },
        summary: { type: 'string' },
        boardSnapshot: { type: 'object', additionalProperties: true },
        candidates: { type: 'array', items: { type: 'object', additionalProperties: true } },
        variations: { type: 'array', items: { type: 'object', additionalProperties: true } },
        keyMoves: { type: 'array', items: { type: 'object', additionalProperties: true } },
        knowledgeMatches: { type: 'array', items: { type: 'object', additionalProperties: true } },
        trainingItems: { type: 'array', items: { type: 'object', additionalProperties: true } },
        evidence: { type: 'object', additionalProperties: true },
        sandboxHtml: {
          type: 'object',
          description: '未来 sandbox iframe 使用的独立 HTML 字段；默认禁用脚本，不能放进 exportHtml。',
          additionalProperties: true
        }
      }),
      execute: async (input) => {
        const fallbackTitle = defaultArtifactTitleForState(state)
        const validation = validateTeachingArtifact(input, {
          id: `${state.id}-agent-artifact`,
          title: fallbackTitle,
          kind: artifactKindForIntent(state.intent),
          source: 'agent-json',
          allowSandboxScripts: false,
          evidence: {
            katagoReady: Boolean(state.lastAnalysis),
            boardImageReady: Boolean(state.request.visionEvidence?.images.some((image) => image.valid)),
            knowledgeMatchCount: state.knowledgeMatches.length,
            recommendedProblemCount: state.recommendedProblems.length,
            sourceNote: 'Agent JSON artifact 已由 GoAgent 运行时验证、裁剪、脱敏，并重新生成安全静态 HTML。'
          }
        })
        if (!validation.ok || !validation.artifact) {
          return {
            accepted: false,
            skipped: true,
            reason: 'TeachingArtifact did not contain enough evidence-backed fields and was ignored.',
            errors: validation.errors,
            note: '老师正文会继续作为主要讲解；GoAgent 会在运行结束时从已验证证据自动生成内部结构化记录。'
          }
        }
        state.agentArtifact = validation.artifact
        return {
          accepted: true,
          id: validation.artifact.id,
          kind: validation.artifact.kind,
          title: validation.artifact.title,
          source: validation.artifact.source,
          candidates: validation.artifact.candidates.length,
          keyMoves: validation.artifact.keyMoves.length,
          knowledgeMatches: validation.artifact.knowledgeMatches.length,
          trainingItems: validation.artifact.trainingItems.length,
          sandboxHtml: validation.artifact.sandboxHtml
            ? {
                enabled: validation.artifact.sandboxHtml.enabled,
                scriptPolicy: validation.artifact.sandboxHtml.scriptPolicy,
                iframeSandbox: validation.artifact.sandboxHtml.iframeSandbox,
                warnings: validation.artifact.sandboxHtml.warnings
              }
            : undefined,
          warnings: validation.warnings,
          staticExport: {
            fileName: validation.artifact.exportFileName,
            bytes: validation.artifact.exportHtml.length
          }
        }
      }
    },
    {
      apiName: 'report_saveAnalysis',
      canonicalName: 'report.saveAnalysis',
      label: '保存报告',
      description: '保存老师生成的讲解或报告。',
      parameters: schema({
        title: { type: 'string' },
        markdown: { type: 'string' }
      }),
      execute: async (input) => {
        const title = stringInput(input, 'title', `${state.studentName} 老师讲解`)
        const markdown = stringInput(input, 'markdown', state.finalMarkdown)
        return { reportPath: saveReport(state.id, title, markdown, { savedBy: 'agent-tool' }) }
      }
    }
  ]
}

function toolLogDetailFromResult(result: unknown): string {
  const text = compactToolResult(result, 700)
  return text.replace(/\s+/g, ' ').slice(0, 700)
}

async function executeAgentToolCall(
  call: ChatToolCall,
  tools: Map<string, TeacherAgentToolDefinition>,
  state: TeacherAgentSessionState
): Promise<{ toolResult: string; followupMessages: ChatMessage[] }> {
  assertTeacherRunActive(state.context)
  const tool = tools.get(call.function.name)
  if (!tool) {
    return {
      toolResult: compactToolResult({ ok: false, error: `Unknown tool: ${call.function.name}` }),
      followupMessages: []
    }
  }
  const log = startTool(state.logs, tool.canonicalName, tool.label, `调用 ${tool.canonicalName}`)
  emitToolState(state.context, state.logs, `正在执行 ${tool.canonicalName}`)
  try {
    const result = await tool.execute(parseToolArguments(call), state)
    assertTeacherRunActive(state.context)
    finishTool(log, 'done', toolLogDetailFromResult(result))
    emitToolState(state.context, state.logs, `${tool.canonicalName} 已完成`)
    const followupMessages = state.pendingToolMessages.splice(0)
    return {
      toolResult: compactToolResult({ ok: true, tool: tool.canonicalName, result }),
      followupMessages
    }
  } catch (error) {
    if (isCancellationError(error)) {
      finishTool(log, 'skipped', '用户已停止本次分析。')
      emitToolState(state.context, state.logs, '用户已停止本次分析。')
      throw new TeacherRunCancelledError()
    }
    const detail = `工具失败: ${String(error)}`
    finishTool(log, 'error', detail)
    emitToolState(state.context, state.logs, detail)
    state.pendingToolMessages.splice(0)
    return {
      toolResult: compactToolResult({ ok: false, tool: tool.canonicalName, error: String(error) }),
      followupMessages: []
    }
  }
}

async function runTeacherAgentSession(
  request: TeacherRunRequest,
  logs: TeacherToolLog[],
  id: string,
  intent: TeacherIntent,
  context?: TeacherRunContext
): Promise<TeacherRunResult> {
  const visionEvidence = request.visionEvidence ?? buildVisionEvidenceReport(request, intent)
  const visionValidation = validateVisionEvidenceForIntent(visionEvidence, intent)
  if (!visionValidation.ok && !allowToolFirstVision(request)) {
    throw new Error(`棋盘图证据不完整：${visionValidation.blockingIssues.join('；')}`)
  }
  const indexedGame = request.gameId ? getGames().find((item) => item.id === request.gameId) : undefined
  const boundProfile = request.gameId ? readStudentForGame(request.gameId) : null
  const studentName = boundProfile?.displayName ?? detectStudentName(request, indexedGame)
  const profile = boundProfile ?? getStudentProfile(studentName)
  const state: TeacherAgentSessionState = {
    id,
    request: { ...request, visionEvidence },
    intent,
    logs,
    context,
    studentName,
    profile,
    batchIssues: [],
    pendingToolMessages: [],
    knowledge: [],
    knowledgeMatches: [],
    recommendedProblems: [],
    finalMarkdown: ''
  }
  if (
    request.prefetchedAnalysis &&
    (!request.gameId || request.prefetchedAnalysis.gameId === request.gameId) &&
    (typeof request.moveNumber !== 'number' || request.prefetchedAnalysis.moveNumber === request.moveNumber)
  ) {
    state.lastAnalysis = request.prefetchedAnalysis
    state.teachingPacing = buildTeachingPacingAdvice(request.prefetchedAnalysis)
  }

  const settings = providerSettingsFromApp()
  const toolDefinitions = createTeacherAgentTools(state)
  const toolMap = new Map(toolDefinitions.map((tool) => [tool.apiName, tool]))
  const tools = toolDefinitions.map(chatTool)
  const messages: ChatMessage[] = [
    { role: 'system', content: agentSystemPrompt(profile.userLevel) },
    initialAgentUserMessage(state)
  ]

  emitProgress(context, { stage: 'assistant-start', message: 'GoAgent agent 开始推理。', toolLogs: cloneToolLogs(logs) })
  let finalText = ''
  let emittedText = ''
  for (;;) {
    assertTeacherRunActive(context)
    let streamedThisTurn = ''
    const result = await streamOpenAICompatibleToolTurn(settings, messages, tools, 4096, (delta) => {
      streamedThisTurn += delta
      emittedText += delta
      emitAssistantDelta(context, delta)
    }, context?.signal)
    assertTeacherRunActive(context)
    if (result.toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: result.text,
        tool_calls: result.toolCalls
      })
      for (const call of result.toolCalls) {
        const { toolResult, followupMessages } = await executeAgentToolCall(call, toolMap, state)
        messages.push({
          role: 'tool',
          name: call.function.name,
          tool_call_id: call.id,
          content: toolResult
        })
        messages.push(...followupMessages)
      }
      continue
    }
    if (result.text.trim()) {
      finalText = result.text.trim()
      if (!streamedThisTurn && !emittedText.endsWith(finalText)) {
        emitAssistantDelta(context, finalText)
      }
      break
    }
    throw new Error('LLM 没有返回可展示文本，也没有返回工具调用。')
  }

  if (!finalText) {
    throw new Error('LLM 未生成最终回答。')
  }
  const finalVisionEvidence = state.request.visionEvidence ?? visionEvidence
  const visionIssues = verifyVisionEvidenceMarkdown(finalText, finalVisionEvidence)
  if (visionIssues.some((issue) => issue.severity === 'error')) {
    messages.push({ role: 'assistant', content: finalText })
    messages.push({ role: 'user', content: `${buildVisionEvidenceRepairNote(visionIssues)}\n\n${formatVisionEvidenceForPrompt(finalVisionEvidence)}` })
    const repair = await streamOpenAICompatibleToolTurn(settings, messages, tools, 2048, (delta) => {
      emitAssistantDelta(context, delta)
    }, context?.signal)
    if (repair.toolCalls.length > 0) {
      throw new Error('LLM 在棋盘图证据修正阶段继续请求工具，请重新发起本次分析。')
    }
    if (!repair.text.trim()) {
      throw new Error('LLM 在棋盘图证据修正阶段没有返回可展示文本。')
    }
    finalText = repair.text.trim()
    const repairedIssues = verifyVisionEvidenceMarkdown(finalText, finalVisionEvidence)
    if (repairedIssues.some((issue) => issue.severity === 'error')) {
      throw new Error(`棋盘图证据校验失败：${repairedIssues.map((issue) => issue.message).join('；')}`)
    }
  }
  finalText = redactSensitiveText(finalText)
  state.finalMarkdown = finalText
  const taskType = taskTypeForIntent(intent)
  const structured = structuredFromTeacherText(finalText, taskType, state.knowledge, state.knowledgeMatches, state.recommendedProblems)
  const title = defaultArtifactTitleForState(state)
  const runtimeArtifact = buildTeacherArtifact({
    id,
    title,
    intent,
    request,
    markdown: finalText,
    analysis: state.lastAnalysis,
    rangeAnalyses: state.rangeAnalyses,
    structured,
    knowledge: state.knowledge,
    knowledgeMatches: state.knowledgeMatches,
    recommendedProblems: state.recommendedProblems,
    teachingPacing: state.teachingPacing,
    visionEvidence: finalVisionEvidence,
    studentProfile: state.profile
  })
  const artifact = state.agentArtifact ?? runtimeArtifact
  const reportPath = saveReport(id, title, finalText, {
    agent: true,
    intent,
    analysis: state.lastAnalysis,
    rangeAnalyses: state.rangeAnalyses,
    knowledge: state.knowledge,
    knowledgeMatches: state.knowledgeMatches,
    recommendedProblems: state.recommendedProblems,
    teachingPacing: state.teachingPacing,
    visionEvidence: finalVisionEvidence,
    studentProfile: state.profile,
    structured,
    artifact
  })
  return {
    id,
    mode: intent === 'current-move' ? 'current-move' : intent === 'move-range' ? 'move-range' : 'freeform',
    title,
    markdown: finalText,
    toolLogs: logs,
    analysis: state.lastAnalysis,
    knowledge: state.knowledge,
    knowledgeMatches: state.knowledgeMatches,
    recommendedProblems: state.recommendedProblems,
    teachingPacing: state.teachingPacing,
    visionEvidence: finalVisionEvidence,
    studentProfile: state.profile,
    structured,
    structuredResult: structured,
    artifact,
    reportPath
  }
}

export async function runTeacherTask(request: TeacherRunRequest, onProgress?: TeacherProgressEmitter, options: RunTeacherTaskOptions = {}): Promise<TeacherRunResult> {
  const id = request.runId || randomUUID()
  const activeRun = {
    abortController: new AbortController(),
    cancelled: false
  }
  ACTIVE_TEACHER_RUNS.set(id, activeRun)
  const parsedRange = request.moveRange ?? parseMoveRangeFromPrompt(request.prompt ?? '') ?? undefined
  const appSettings = getSettings()
  const normalizedRequest: TeacherRunRequest = {
    ...request,
    toolPolicy: request.toolPolicy ?? 'auto',
    moveRange: parsedRange,
    coachLevel: normalizeCoachLevel(request.coachLevel ?? appSettings.defaultCoachLevel),
    studentAgeRange: normalizeStudentAgeRange(request.studentAgeRange ?? appSettings.defaultStudentAgeRange),
    teacherStyle: normalizeTeacherStyle(request.teacherStyle ?? appSettings.teacherStyle)
  }
  if (normalizedRequest.moveRange) {
    const validation = validateMoveRange(normalizedRequest.moveRange.start, normalizedRequest.moveRange.end, undefined, MOVE_RANGE_MAX_MOVES)
    if (!validation.ok) {
      throw new Error(`区间复盘范围无效：${validation.reason}`)
    }
    normalizedRequest.moveRange = validation.range
  }
  if (normalizedRequest.mode === 'move-range' && !normalizedRequest.gameId) {
    throw new Error('move-range 任务需要 gameId。')
  }
  const logs: TeacherToolLog[] = []
  const intentClassification = classifyTeacherIntent(normalizedRequest)
  const intent = intentClassification.intent
  const context: TeacherRunContext = {
    runId: id,
    emit: onProgress,
    signal: activeRun.abortController.signal,
    captureBoardImages: options.captureBoardImages
  }

  try {
    emitProgress(context, {
      stage: 'queued',
      message: intent === 'current-move'
        ? '收到当前手分析任务。'
      : intent === 'move-range'
        ? '收到区间复盘任务。'
      : intent === 'game-review'
        ? '收到整盘复盘任务。'
        : intent === 'batch-review'
          ? '收到最近对局分析任务。'
          : intent === 'training-plan'
            ? '收到训练计划任务。'
            : '收到开放式任务。',
      toolLogs: [{
        id: randomUUID(),
        name: 'teacher.classifyIntent',
        label: '任务识别',
        detail: `${intentClassification.intent} · ${intentClassification.confidence} · ${intentClassification.rationale}`,
        status: 'done',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString()
      }]
    })
    assertTeacherRunActive(context)
    const result = await runTeacherAgentSession(normalizedRequest, logs, id, intent, context)
    assertTeacherRunActive(context)
    emitProgress(context, {
      stage: 'done',
      markdown: result.markdown,
      toolLogs: cloneToolLogs(logs),
      result
    })
    return result
  } catch (error) {
    emitProgress(context, {
      stage: 'error',
      error: String(error),
      toolLogs: cloneToolLogs(logs)
    })
    throw error
  } finally {
    const current = ACTIVE_TEACHER_RUNS.get(id)
    if (current === activeRun) {
      ACTIVE_TEACHER_RUNS.delete(id)
    }
  }
}
