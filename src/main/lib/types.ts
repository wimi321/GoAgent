export type ReviewStatus = 'idle' | 'running' | 'done' | 'error'

export type TtsProviderId = 'kokoro-bundled' | 'volcengine-doubao' | 'custom-openai-compatible' | 'custom-http-json' | 'external-local-service'
export type TtsReadMode = 'summary' | 'full' | 'selection'
export type TtsAudioFormat = 'wav' | 'mp3' | 'pcm' | 'opus' | 'aac' | 'flac'
export type TtsRuntimeDevice = 'cpu' | 'wasm' | 'webgpu'
export type TtsKokoroDType = 'q8' | 'fp32' | 'fp16' | 'q4' | 'q4f16'
export type TtsVolcengineAuthMode = 'api-key' | 'legacy-token'

export interface TtsVoice {
  id: string
  label: string
  language: AppSettings['reviewLanguage']
  provider: TtsProviderId
  bundled?: boolean
}

export interface TtsAssetStatus {
  provider: TtsProviderId
  language: AppSettings['reviewLanguage']
  ready: boolean
  detail: string
  rootPath: string
  manifestFound: boolean
  modelPath: string
  modelFound: boolean
  modelSha256?: string
  voicesFound: number
  defaultVoiceId: string
  license: string
}

export interface TtsSynthesisRequest {
  text: string
  language?: AppSettings['reviewLanguage']
  voiceId?: string
  readMode?: TtsReadMode
  format?: TtsAudioFormat
}

export interface TtsSynthesisResult {
  id: string
  provider: TtsProviderId
  mimeType: string
  audioPath: string
  audioDataUrl: string
  cached: boolean
  textHash: string
  createdAt: string
}

export type VisionEvidenceImageRole = 'current-board' | 'range-key-move' | 'variation' | 'unknown'
export type VisionEvidenceDetail = 'high' | 'auto' | 'low'
export type VisionEvidenceSource = 'initial-attachment' | 'tool-capture'

export interface VisionEvidenceImage {
  id: string
  index: number
  role: VisionEvidenceImageRole
  source?: VisionEvidenceSource
  moveNumber?: number
  mimeType: 'image/png' | 'image/jpeg' | 'unknown'
  bytes: number
  width?: number
  height?: number
  detail: VisionEvidenceDetail
  caption: string
  valid: boolean
  warnings: string[]
}

export interface VisionEvidenceReport {
  required: boolean
  attached: boolean
  imageCount: number
  providerSupportsVision: boolean | 'unknown'
  source?: VisionEvidenceSource
  images: VisionEvidenceImage[]
  warnings: string[]
  blockingIssues: string[]
  createdAt: string
}

export interface AppSettings {
  katagoBin: string
  katagoConfig: string
  katagoModel: string
  katagoModelPreset: KataGoModelPresetId
  katagoAnalysisThreads: number
  katagoSearchThreadsPerAnalysisThread: number
  katagoMaxBatchSize: number
  katagoCacheSizePowerOfTwo: number
  katagoBenchmarkThreads: number
  katagoBenchmarkVisitsPerSecond: number
  katagoBenchmarkUpdatedAt: string
  katagoEngineMode: KataGoEngineMode
  katagoAnalysisSpeedMode: KataGoAnalysisSpeedMode
  pythonBin: string
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
  reviewLanguage: 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP' | 'ko-KR' | 'th-TH' | 'vi-VN'
  defaultPlayerName: string
  ttsEnabled: boolean
  ttsAutoPlay: boolean
  ttsProvider: TtsProviderId
  ttsLanguage: 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP' | 'ko-KR' | 'th-TH' | 'vi-VN'
  ttsVoiceId: string
  ttsRate: number
  ttsPitch: number
  ttsVolume: number
  ttsReadMode: TtsReadMode
  ttsCacheEnabled: boolean
  ttsKokoroDType: TtsKokoroDType
  ttsKokoroDevice: TtsRuntimeDevice
  ttsVolcengineEndpoint: string
  ttsVolcengineAuthMode: TtsVolcengineAuthMode
  ttsVolcengineApiKey: string
  ttsVolcengineAppId: string
  ttsVolcengineAccessToken: string
  ttsVolcengineResourceId: string
  ttsVolcengineSpeaker: string
  ttsVolcengineModel: string
  ttsVolcengineSampleRate: number
  ttsCustomBaseUrl: string
  ttsCustomApiKey: string
  ttsCustomModel: string
  ttsCustomVoice: string
  ttsCustomHeadersJson: string
  ttsCustomBodyTemplate: string
  ttsCustomResponseType: 'audio-bytes' | 'json-audio-url' | 'json-base64'
  ttsCustomAudioJsonPath: string
  defaultCoachLevel: CoachUserLevel
  defaultStudentRank: StudentRank
  defaultStudentAge: number
  defaultStudentAgeRange: StudentAgeRange
  teacherStyle: TeacherPersonaStyle
  teacherTerminologyDensity: TeacherTerminologyDensity
  teacherExplanationPace: TeacherExplanationPace
  teacherVariationDetail: TeacherVariationDetail
}

export type KataGoEngineMode = 'auto' | 'persistent' | 'spawn'
export type KataGoAnalysisSpeedMode = 'auto' | 'fast' | 'balanced' | 'deep'
export type KataGoModelPresetId = string

export interface KataGoModelPreset {
  id: KataGoModelPresetId
  label: string
  badge: string
  group: string
  blockSize: string
  speedTier: 'fast' | 'balanced' | 'strong' | 'maximum'
  sizeHint: string
  description: string
  networkName: string
  fileName: string
  sourceUrl: string
  downloadUrl?: string
  recommended: boolean
}

export interface SystemProfile {
  katagoBin: string
  katagoConfig: string
  katagoModel: string
  katagoReady: boolean
  katagoStatus: string
  katagoModelPreset: KataGoModelPresetId
  katagoModelPresets: KataGoModelPreset[]
  proxyBaseUrl: string
  proxyApiKey: string
  proxyModels: string[]
  hasLlmApiKey: boolean
  notes: string[]
}

export interface LibraryGame {
  id: string
  title: string
  event: string
  black: string
  white: string
  result: string
  date: string
  source: 'upload' | 'fox'
  sourceLabel: string
  filePath: string
  createdAt: string
  downloadStatus?: 'remote' | 'downloaded'
  remoteId?: string
  remoteUid?: string
  moveCount?: number
}

export interface LibraryDeleteRequest {
  gameId: string
}

export interface LibraryDeleteResult {
  dashboard: DashboardData
  deleted: LibraryGame
  removedFile: boolean
}

export type StoneColor = 'B' | 'W'

export interface KataGoScoreSummary {
  signConvention: 'black-positive'
  perspectiveColor?: StoneColor
  perspectiveScoreLead?: number
  blackScoreLead: number
  whiteScoreLead: number
  leader: StoneColor | 'even'
  leadPoints: number
  text: string
}

export interface GameMove {
  moveNumber: number
  color: StoneColor
  point: string
  row: number | null
  col: number | null
  gtp: string
  pass: boolean
}

export interface BoardSetupStone {
  color: StoneColor
  point: string
  row: number
  col: number
}

export interface GameRecord {
  game: LibraryGame
  boardSize: number
  rules?: string
  komi: string
  handicap: string
  moves: GameMove[]
  initialStones?: BoardSetupStone[]
}

export interface ReviewArtifact {
  markdown: string
  summary: Record<string, unknown>
  jsonPath: string
  markdownPath: string
}

export interface ReviewResult {
  game: LibraryGame
  status: ReviewStatus
  error?: string
  artifact?: ReviewArtifact
}

export interface FoxSyncRequest {
  keyword: string
  maxGames?: number
}

export interface FoxSyncResult {
  nickname: string
  uid: string
  saved: LibraryGame[]
}

export interface LibraryImportResult {
  dashboard: DashboardData
  imported: LibraryGame[]
}

export interface FoxSyncResponse {
  dashboard: DashboardData
  result: FoxSyncResult
  student?: StudentProfile
}

export interface KataGoAssetStatus {
  platformKey: string
  manifestFound: boolean
  binaryPath: string
  binaryFound: boolean
  binaryExecutable: boolean
  modelPath: string
  modelFound: boolean
  modelDisplayName: string
  ready: boolean
  detail: string
}

export interface KataGoBenchmarkRequest {
  visits?: number
  numPositions?: number
  secondsPerMove?: number
  threads?: number[]
}

export interface KataGoBenchmarkThreadResult {
  threads: number
  visitsPerSecond: number
}

export interface KataGoBenchmarkResult {
  recommendedThreads: number
  visitsPerSecond: number
  tested: KataGoBenchmarkThreadResult[]
  analysisThreads: number
  searchThreadsPerAnalysisThread: number
  maxBatchSize: number
  cacheSizePowerOfTwo: number
  command: string
  outputTail: string
  updatedAt: string
}

export interface KataGoAssetInstallRequest {
  presetId?: KataGoModelPresetId
}

export type KataGoAssetInstallStage = 'discovering' | 'downloading-binary' | 'downloading-model' | 'copying-binary' | 'writing-manifest' | 'done' | 'error'

export interface KataGoAssetInstallProgress {
  stage: KataGoAssetInstallStage
  message: string
  receivedBytes?: number
  totalBytes?: number
  percent?: number
}

export interface KataGoAssetInstallResult {
  ok: boolean
  presetId: KataGoModelPresetId
  modelPath: string
  binaryPath: string
  downloadedModel: boolean
  copiedBinary: boolean
  detail: string
}

export type ReleaseReadinessStatus = 'pass' | 'warn' | 'fail' | 'unknown'

export interface ReleaseReadinessItem {
  id: string
  label: string
  status: ReleaseReadinessStatus
  detail?: string
}

export interface ReleaseReadinessFlags {
  automationReady: boolean
  assetsReady: boolean
  installersReady: boolean
  signingReady: boolean
  windowsSmokeReady: boolean
  visualQaReady: boolean
  publicBetaReady: boolean
}

export interface ReleaseReadinessResult {
  status: ReleaseReadinessStatus
  items: ReleaseReadinessItem[]
  flags: ReleaseReadinessFlags
}

export interface ReviewRequest {
  gameId: string
  playerName: string
  maxVisits: number
  minWinrateDrop: number
  useLlm?: boolean
}

export type CoachUserLevel = 'beginner' | 'intermediate' | 'advanced' | 'dan'
export type StudentRank = 'sub1d' | '1d' | '2d' | '3d' | '4d' | '5d' | '6d' | '7d' | '8d' | '9d'
export type StudentAgeRange = 'unknown' | 'child' | 'teen' | 'adult' | 'senior'
export type TeacherPersonaStyle = 'balanced' | 'rigorous' | 'gentle' | 'strict' | 'humorous'
export type TeacherTerminologyDensity = 'low' | 'medium' | 'high'
export type TeacherExplanationPace = 'brief' | 'standard' | 'detailed'
export type TeacherVariationDetail = 'few' | 'moderate' | 'many'
export type TeacherRunMode = 'current-move' | 'freeform' | 'move-range'
export type TeacherToolPolicy = 'auto'
export type TeacherToolStatus = 'running' | 'done' | 'error' | 'skipped'

export type BoardImageCaptureSelection = 'current' | 'explicit-moves' | 'top-loss' | 'move-range-top-loss'

export interface AgentToolImageResult {
  imageId: string
  gameId: string
  moveNumber: number
  caption: string
  mimeType: 'image/png' | 'image/jpeg' | 'unknown'
  bytes: number
  width?: number
  height?: number
  hash?: string
  source: VisionEvidenceSource
}

export interface AgentToolEvidenceRef {
  id: string
  kind: 'katago' | 'knowledge' | 'board-image' | 'sgf' | 'student-profile'
  label: string
  moveNumber?: number
  confidence?: string
}

export interface TeacherBoardImageRenderRequest {
  requestId: string
  runId: string
  gameId: string
  moveNumbers: number[]
  captions?: Record<number, string>
  analyses?: KataGoMoveAnalysis[]
}

export interface TeacherBoardImageRenderImage extends AgentToolImageResult {
  dataUrl: string
}

export interface TeacherBoardImageRenderResponse {
  requestId: string
  ok: boolean
  images?: TeacherBoardImageRenderImage[]
  error?: string
}

export interface TeacherToolLog {
  id: string
  name: string
  label: string
  status: TeacherToolStatus
  detail: string
  startedAt: string
  endedAt?: string
}

export interface KnowledgePacket {
  id: string
  title: string
  category: string
  phase: string
  tags: string[]
  summary: string
  selectedBody: string
  score: number
}

export type KnowledgeMatchType = 'joseki' | 'life_death' | 'tesuji' | 'shape' | 'concept'
export type KnowledgeMatchConfidence = 'exact' | 'strong' | 'partial' | 'weak'
export type KnowledgeSourceKind = 'original' | 'common-pattern' | 'licensed-source'

export interface RecommendedProblem {
  id: string
  title: string
  problemType: 'life_death' | 'tesuji'
  difficulty: string
  objective: string
  firstHint: string
  answerSummary: string
  tags: string[]
}

export interface KnowledgeMatch {
  id: string
  matchType: KnowledgeMatchType
  title: string
  confidence: KnowledgeMatchConfidence
  score: number
  reason: string[]
  applicability: string
  teachingPayload: {
    summary: string
    recognition: string
    correctIdea: string
    keyVariations: string[]
    memoryCue: string
    commonMistakes: string[]
    drills: string[]
    boundary: string
    sourceKind: KnowledgeSourceKind
  }
  relatedProblems: RecommendedProblem[]
}

export type TeachingDensity = 'minimal' | 'branch' | 'detailed' | 'caution'
export type TeachingFocus = 'joseki-normal' | 'joseki-branch' | 'middlegame-fight' | 'life-death' | 'tesuji' | 'endgame' | 'general-shape'

export interface VariationTeachingHint {
  move: string
  purpose: string
  expectedReply?: string
  pv: string[]
  result: string
  confidence: 'high' | 'medium' | 'low'
}

export interface TeachingPacingAdvice {
  teachingDensity: TeachingDensity
  teachingFocus: TeachingFocus
  whyThisMuchExplanation: string
  variationTeachingHints: VariationTeachingHint[]
}

export interface KataGoCandidate {
  move: string
  winrate: number
  scoreLead: number
  visits: number
  order: number
  prior: number
  lcb?: number
  utility?: number
  scoreStdev?: number
  edgeVisits?: number
  pvVisits?: number[]
  ownership?: number[]
  ownershipStdev?: number[]
  humanPrior?: number
  humanPolicy?: number
  humanScoreMean?: number
  pv: string[]
}

export type KataGoTraceConfidence = 'high' | 'medium' | 'low'
export type KataGoTraceTeachingRole =
  | 'best'
  | 'actual'
  | 'natural-but-refuted'
  | 'low-policy-but-strong-search'
  | 'human-likely-mistake'
  | 'uncertain'

export interface KataGoTraceCandidate {
  move: string
  rank: number
  visits: number
  edgeVisits?: number
  prior?: number
  priorRank?: number
  searchRank: number
  winrate: number
  scoreLead: number
  blackScoreLead: number
  scoreLeadPerspective: 'black-positive'
  scoreSummary: KataGoScoreSummary
  scoreStdev?: number
  utility?: number
  lcb?: number
  humanPrior?: number
  humanPolicy?: number
  pv: string[]
  pvVisits?: number[]
  teachingRole: KataGoTraceTeachingRole
  interpretation: string
  warnings: string[]
}

export interface KataGoPolicySearchDelta {
  move: string
  prior?: number
  priorRank?: number
  searchRank: number
  visits: number
  interpretation:
    | 'policy-and-search-agree'
    | 'search-overturned-policy'
    | 'natural-move-refuted-by-search'
    | 'non-obvious-search-favorite'
    | 'insufficient-policy-evidence'
  note: string
}

export interface KataGoPvSupport {
  candidate: string
  pv: string[]
  pvVisits?: number[]
  support: 'strong' | 'medium' | 'weak'
  warning?: string
}

export interface KataGoOwnershipRegionSummary {
  region: string
  avgSwing: number
  points: string[]
  explanation: string
}

export interface KataGoHumanPolicySignals {
  actualHumanPrior?: number
  bestHumanPrior?: number
  actualHumanPolicy?: number
  bestHumanPolicy?: number
  levelAppropriateMistake: boolean
  interpretation: string
}

export interface KataGoTraceTreeNode {
  move: string
  depth: number
  visits?: number
  winrate?: number
  scoreLead?: number
  scoreLeadPerspective?: 'black-positive'
  scoreSummary?: KataGoScoreSummary
  prior?: number
  pvSupport?: KataGoPvSupport['support']
  children: KataGoTraceTreeNode[]
}

export interface KataGoTracePacket {
  position: {
    moveNumber: number
    phase: AnalysisQuality['phase']
    actualMove?: string
  }
  searchSummary: {
    bestMove?: string
    actualMove?: string
    winrateLoss: number
    scoreLoss: number
    confidence: KataGoTraceConfidence
    safeWording: string
    reason: string
  }
  candidateComparison: KataGoTraceCandidate[]
  scorePerspective: {
    scoreLeadFields: 'black-positive'
    note: string
  }
  policySearchDelta: KataGoPolicySearchDelta[]
  pvSupport: KataGoPvSupport[]
  ownershipSummary?: {
    mode: 'best-vs-actual' | 'best-ownership' | 'unavailable'
    note: string
    affectedRegions: KataGoOwnershipRegionSummary[]
  }
  humanPolicySignals?: KataGoHumanPolicySignals
  shallowSearchTree: KataGoTraceTreeNode
  teachingGuidance: {
    mainPoint: string
    safeWording: string
    forbiddenClaims: string[]
  }
}

export type AnalysisConfidence = 'high' | 'medium' | 'low'

export interface AnalysisQuality {
  phase: 'opening' | 'middle' | 'endgame'
  totalVisits: number
  bestVisits: number
  actualVisits: number
  candidateSpreadWinrate: number
  candidateSpreadScore: number
  pvStable: boolean
  confidence: AnalysisConfidence
  reason: string
  deepenRecommended: boolean
}

export type MoveClassificationSeverity = 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'unclear'

export interface MoveClassification {
  severity: MoveClassificationSeverity
  confidence: AnalysisConfidence
  phase: AnalysisQuality['phase']
  winrateLoss: number
  scoreLoss: number
  shouldTeach: boolean
  shouldDeepen: boolean
  reason: string
  evidenceWarnings: string[]
}

export type PvConfidenceLevel = 'strong' | 'medium' | 'weak' | 'unstable'

export interface PvConfidenceCandidate {
  move: string
  rank: number
  level: PvConfidenceLevel
  visits: number
  pvLength: number
  pvVisitsTotal?: number
  reason: string
}

export interface PvConfidenceReport {
  overall: PvConfidenceLevel
  stableMainLine: boolean
  shouldDeepen: boolean
  summary: string
  recommendedWording: string
  candidates: PvConfidenceCandidate[]
}

export type AnalysisRuntimeCacheStatus =
  | 'hit'
  | 'miss'
  | 'stale'
  | 'lower-quality'
  | 'schema-mismatch'
  | 'corrupt'
  | 'written'
  | 'disabled'

export interface AnalysisRuntimeProfileSummary {
  intent: string
  speedMode: KataGoAnalysisSpeedMode
  maxVisits: number
  sweepVisits: number
  refineVisits: number
  refineTopN: number
  cacheTier: string
  includeOwnership: boolean
  includePolicy: boolean
  reason: string[]
}

export interface AnalysisRuntimeEvidence {
  cacheStatus: AnalysisRuntimeCacheStatus
  cacheTier: string
  cacheKey?: string
  cacheReason: string
  adaptiveProfile: AnalysisRuntimeProfileSummary
  teachingReadiness?: {
    level: string
    canTeachNow: boolean
    canUseInFinalReport: boolean
    shouldDeepen: boolean
    safeWording: string
    warnings: string[]
    blockingIssues: string[]
  }
  evidenceBundleVersion?: number
  generatedAt: string
}

export interface HumanWinrateCalibration {
  aiWinrate?: number
  humanWinrateEstimate?: number
  scoreLead: number
  level: CoachUserLevel
  confidence: AnalysisConfidence
  explanation: string
}

export interface OwnershipDeltaSummary {
  biggestSwingRegions: Array<{
    region: string
    avgDelta: number
    points: string[]
    humanLabel: string
  }>
  note: string
}

export interface TacticalSignal {
  type: string
  confidence: AnalysisConfidence
  evidence: string[]
  relatedMoves: string[]
}

export interface KataGoMoveAnalysis {
  gameId: string
  moveNumber: number
  boardSize: number
  currentMove?: GameMove
  before: {
    winrate: number
    scoreLead: number
    topMoves: KataGoCandidate[]
  }
  after: {
    winrate: number
    scoreLead: number
    topMoves: KataGoCandidate[]
  }
  playedMove?: {
    move: string
    winrate: number
    scoreLead: number
    playerWinrate?: number
    playerScoreLead?: number
    visits?: number
    rank?: number
    source?: 'candidate' | 'forced' | 'after-root'
    winrateLoss: number
    scoreLoss: number
  }
  judgement: 'good_move' | 'inaccuracy' | 'mistake' | 'blunder' | 'unknown'
  analysisQuality?: AnalysisQuality
  moveClassification?: MoveClassification
  pvConfidence?: PvConfidenceReport
  runtimeEvidence?: AnalysisRuntimeEvidence
  humanCalibration?: HumanWinrateCalibration
  ownershipSummary?: OwnershipDeltaSummary
  tacticalSignals?: TacticalSignal[]
  tracePacket?: KataGoTracePacket
}

export interface StudentProfile {
  id: string
  studentId: string
  name: string
  displayName: string
  primaryFoxNickname?: string
  aliases: string[]
  createdFrom: 'fox' | 'sgf' | 'manual' | 'legacy'
  userLevel: CoachUserLevel
  ageRange?: StudentAgeRange
  gamesReviewed: number
  weaknessStats: Record<string, number>
  recentPatterns: string[]
  trainingFocus: string[]
  recentGameIds: string[]
  commonMistakes: Array<{ tag: string; count: number }>
  trainingThemes: string[]
  josekiWeaknesses?: string[]
  lifeDeathWeaknesses?: string[]
  tesujiWeaknesses?: string[]
  typicalMoves: Array<{
    gameId: string
    moveNumber: number
    label: string
    lossWinrate: number
    lossScore: number
  }>
  updatedAt: string
  createdAt: string
  lastAnalyzedAt?: string
}

export interface StudentBindingSuggestion {
  student: StudentProfile
  confidence: 'high' | 'medium' | 'low'
  reason: string
  color?: StoneColor
}

export interface TeacherChatMessage {
  id: string
  role: 'student' | 'teacher'
  content: string
  status?: 'running' | 'completed' | 'error'
  result?: TeacherRunResult
  toolLogs?: TeacherRunResult['toolLogs']
  createdAt: string
}

export interface TeacherSession {
  id: string
  title: string
  gameId?: string
  moveNumber?: number
  moveRange?: { start: number; end: number }
  studentId?: string
  archivedAt?: string
  createdAt: string
  updatedAt: string
  messages: TeacherChatMessage[]
}

export interface TeacherKeyMistake {
  moveNumber?: number
  color?: StoneColor
  played?: string
  recommended?: string
  errorType: string
  severity: 'inaccuracy' | 'mistake' | 'blunder'
  evidence: string
  explanation: string
}

export interface StructuredTeacherResult {
  taskType: 'current-move' | 'full-game' | 'recent-games' | 'freeform' | 'move-range'
  headline: string
  summary: string
  keyMistakes: TeacherKeyMistake[]
  correctThinking: string[]
  drills: string[]
  followupQuestions: string[]
  markdown: string
  knowledgeCardIds: string[]
  knowledgeMatches?: KnowledgeMatch[]
  recommendedProblems?: RecommendedProblem[]
  profileUpdates: {
    errorTypes: string[]
    patterns: string[]
    trainingFocus: string[]
  }
}

export type TeacherArtifactKind = 'current-move-review' | 'move-range-review' | 'game-review' | 'training-plan' | 'freeform'

export interface TeacherArtifactBoardSnapshot {
  boardSize: number
  moveNumber?: number
  currentColor?: StoneColor
  playedMove?: string
  bestMove?: string
  judgement?: KataGoMoveAnalysis['judgement']
  winrateBefore?: number
  winrateAfter?: number
  playerWinrateAfter?: number
  winrateLoss?: number
  scoreLeadBefore?: number
  scoreLeadAfter?: number
  playerScoreLeadAfter?: number
  scoreLoss?: number
}

export interface TeacherArtifactCandidate {
  rank: number
  move: string
  winrate?: number
  scoreLead?: number
  visits?: number
  pv: string[]
  note?: string
}

export interface TeacherArtifactVariation {
  label: string
  purpose: string
  pv: string[]
  result: string
  confidence?: VariationTeachingHint['confidence']
}

export interface TeacherArtifactKeyMove {
  moveNumber: number
  color?: StoneColor
  played?: string
  recommended?: string
  severity?: string
  errorType?: string
  summary: string
}

export interface TeacherArtifactTrainingItem {
  id: string
  title: string
  kind: 'life_death' | 'tesuji' | 'concept'
  difficulty?: string
  objective: string
  firstHint?: string
}

export interface TeacherArtifactEvidenceSummary {
  katagoReady: boolean
  boardImageReady: boolean
  knowledgeMatchCount: number
  recommendedProblemCount: number
  sourceNote: string
}

export type TeacherArtifactSource = 'agent-json' | 'runtime-derived'
export type TeacherArtifactSandboxScriptPolicy = 'disabled' | 'sandbox-iframe-only'

export interface TeacherArtifactSandboxHtml {
  html: string
  enabled: boolean
  scriptPolicy: TeacherArtifactSandboxScriptPolicy
  iframeSandbox: string
  warnings: string[]
}

export interface TeacherArtifact {
  id: string
  kind: TeacherArtifactKind
  source?: TeacherArtifactSource
  title: string
  createdAt: string
  summary: string
  boardSnapshot?: TeacherArtifactBoardSnapshot
  candidates: TeacherArtifactCandidate[]
  variations: TeacherArtifactVariation[]
  keyMoves: TeacherArtifactKeyMove[]
  knowledgeMatches: KnowledgeMatch[]
  trainingItems: TeacherArtifactTrainingItem[]
  evidence: TeacherArtifactEvidenceSummary
  sandboxHtml?: TeacherArtifactSandboxHtml
  exportHtml: string
  exportFileName: string
}

export interface MoveRangeKeyMoveSummary {
  moveNumber: number
  playedMove?: string
  bestMove?: string
  winrateLoss: number
  scoreLoss: number
  judgement?: string
  evidenceRefs: string[]
}

export interface MoveRangeReviewSummary {
  start: number
  end: number
  totalMoves: number
  keyMoves: MoveRangeKeyMoveSummary[]
  omittedMoves: number
  analysisMethod: string
}

export interface TeacherRunRequest {
  runId?: string
  mode?: TeacherRunMode
  toolPolicy?: TeacherToolPolicy
  prompt: string
  gameId?: string
  moveNumber?: number
  playerName?: string
  coachLevel?: CoachUserLevel
  studentAgeRange?: StudentAgeRange
  teacherStyle?: TeacherPersonaStyle
  teacherSessionId?: string
  boardImageDataUrl?: string
  boardImageDataUrls?: string[]
  visionEvidence?: VisionEvidenceReport
  moveRange?: { start: number; end: number }
  moveRangeSummary?: MoveRangeReviewSummary
  prefetchedAnalysis?: KataGoMoveAnalysis
}

export interface TeacherRunCancelRequest {
  runId?: string
}

export interface TeacherRunCancelResult {
  cancelled: number
}

export type TeacherRunProgressStage = 'queued' | 'tool' | 'assistant-start' | 'assistant-delta' | 'done' | 'error'

export interface TeacherRunProgress {
  runId: string
  stage: TeacherRunProgressStage
  message?: string
  markdownDelta?: string
  markdown?: string
  toolLogs?: TeacherToolLog[]
  result?: TeacherRunResult
  error?: string
}

export interface AnalyzePositionRequest {
  gameId: string
  moveNumber: number
  maxVisits?: number
  runId?: string
  reportDuringSearchEvery?: number
}

export interface AnalyzePositionProgress {
  runId?: string
  gameId: string
  moveNumber: number
  analysis: KataGoMoveAnalysis
  isFinal: boolean
}

export interface AnalyzeGameQuickRequest {
  gameId: string
  maxVisits?: number
  refineVisits?: number
  refineTopN?: number
  runId?: string
}

export interface AnalyzeGameQuickProgress {
  runId?: string
  gameId: string
  evaluation: KataGoMoveAnalysis
  analyzedPositions: number
  totalPositions: number
}

export type KataGoAnalysisGroup = 'quick' | 'live' | 'single' | 'batch' | 'teacher'

export interface KataGoCancelAnalysisRequest {
  runId?: string
  group?: KataGoAnalysisGroup
}

export interface KataGoCancelAnalysisResult {
  cancelled: number
}

export interface TeacherRunResult {
  id: string
  mode: TeacherRunMode
  title: string
  markdown: string
  toolLogs: TeacherToolLog[]
  analysis?: KataGoMoveAnalysis
  teachingEvidence?: unknown
  teachingPacing?: TeachingPacingAdvice
  verification?: unknown
  visionEvidence?: VisionEvidenceReport
  knowledge: KnowledgePacket[]
  knowledgeMatches?: KnowledgeMatch[]
  recommendedProblems?: RecommendedProblem[]
  studentProfile?: StudentProfile
  structured?: StructuredTeacherResult
  structuredResult?: StructuredTeacherResult
  artifact?: TeacherArtifact
  reportPath?: string
}

export interface LlmSettingsTestRequest {
  llmBaseUrl: string
  llmApiKey: string
  llmModel: string
}

export interface LlmSettingsTestResult {
  ok: boolean
  message: string
}

export interface LlmModelsListRequest {
  llmBaseUrl: string
  llmApiKey: string
}

export interface LlmModelsListResult {
  ok: boolean
  models: string[]
  message: string
}

export interface LlmSavedApiKeyResult {
  hasKey: boolean
  apiKey: string
}

export interface TtsSavedApiKeyResult {
  hasKey: boolean
  apiKey: string
}

export interface DashboardData {
  settings: AppSettings
  games: LibraryGame[]
  systemProfile: SystemProfile
}
