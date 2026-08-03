import type {
  AppSettings,
  AnalyzeGameQuickRequest,
  AnalyzeGameQuickProgress,
  AnalyzePositionRequest,
  AnalyzePositionProgress,
  AnalyzePositionSearchProgress,
  AnalyzeTrialPositionRequest,
  DashboardData,
  FoxSyncResponse,
  FoxSyncRequest,
  GameRecord,
  KataGoAssetInstallProgress,
  KataGoAssetInstallRequest,
  KataGoAssetInstallResult,
  KataGoAssetStatus,
  KataGoBenchmarkRequest,
  KataGoBenchmarkResult,
  KataGoBenchmarkStartRequest,
  KataGoBenchmarkStartResult,
  KataGoBenchmarkCancelRequest,
  KataGoBenchmarkCancelResult,
  KataGoBenchmarkProgress,
  KataGoCancelAnalysisRequest,
  KataGoCancelAnalysisResult,
  LibraryDeleteRequest,
  LibraryDeleteResult,
  LibraryImportResult,
  LlmModelsListRequest,
  LlmModelsListResult,
  LlmSettingsTestRequest,
  LlmSettingsTestResult,
  KataGoMoveAnalysis,
  ReviewRequest,
  ReviewResult,
  StudentBindingSuggestion,
  StudentProfile,
  ReleaseReadinessResult,
  TeacherBoardImageRenderRequest,
  TeacherBoardImageRenderResponse,
  TeacherChatMessage,
  TeacherSession,
  TeacherRunCancelRequest,
  TeacherRunCancelResult,
  TeacherRunRequest,
  TeacherRunProgress,
  TeacherRunResult,
  TtsAssetStatus,
  TtsSynthesisRequest,
  TtsSynthesisResult,
  TtsVoice,
  ZhiziAccountData,
  ZhiziCloudConnectionTestResult,
  ZhiziCloudLoginCodeRequest,
  ZhiziCloudLoginRequest,
  ZhiziCloudLoginResult,
  ZhiziCloudResetPasswordRequest,
  ZhiziCloudSendCodeRequest,
  ZhiziCloudSendCodeResult,
  ZhiziCreditPage,
  ZhiziEngineProfile,
  ZhiziPaymentCreateRequest,
  ZhiziPaymentSession,
  ZhiziUsagePage
} from '@main/lib/types'
import type { DiagnosticsReport } from '@main/services/diagnostics/types'
import type { AnalysisSchedulerStats } from '@main/services/analysis/scheduler'
import type { KnowledgeSearchQuery, KnowledgeSearchResult } from '@main/services/knowledge/schema'

type DesktopCommand =
  | 'open-command-palette'
  | 'open-settings'
  | 'import-sgf'
  | 'analyze-current'
  | 'analyze-game'
  | 'analyze-recent'
  | 'toggle-library'
  | 'open-ui-gallery'

declare global {
  interface Window {
    goagent: {
      getDashboard: () => Promise<DashboardData>
      getGameRecord: (gameId: string) => Promise<GameRecord>
      importLibrary: () => Promise<LibraryImportResult>
      deleteLibraryGame: (payload: LibraryDeleteRequest) => Promise<LibraryDeleteResult>
      updateSettings: (payload: Partial<AppSettings>) => Promise<DashboardData>
      autoDetectSettings: () => Promise<DashboardData>
      syncFox: (payload: FoxSyncRequest) => Promise<FoxSyncResponse>
      startReview: (payload: ReviewRequest) => Promise<ReviewResult>
      analyzePosition: (payload: AnalyzePositionRequest) => Promise<KataGoMoveAnalysis>
      analyzePositionStream: (payload: AnalyzePositionRequest) => Promise<KataGoMoveAnalysis>
      analyzeTrialPositionStream: (payload: AnalyzeTrialPositionRequest) => Promise<KataGoMoveAnalysis | null>
      analyzeGameQuick: (payload: AnalyzeGameQuickRequest) => Promise<KataGoMoveAnalysis[]>
      cancelKataGoAnalysis: (payload: KataGoCancelAnalysisRequest) => Promise<KataGoCancelAnalysisResult>
      getAnalysisSchedulerStats: () => Promise<AnalysisSchedulerStats>
      benchmarkKataGo: (payload?: KataGoBenchmarkRequest) => Promise<KataGoBenchmarkResult>
      startKataGoBenchmark: (payload?: KataGoBenchmarkStartRequest) => Promise<KataGoBenchmarkStartResult>
      cancelKataGoBenchmark: (payload?: KataGoBenchmarkCancelRequest) => Promise<KataGoBenchmarkCancelResult>
      onKataGoBenchmarkProgress: (handler: (payload: KataGoBenchmarkProgress) => void) => () => void
      onAnalyzePositionProgress: (handler: (payload: AnalyzePositionProgress) => void) => () => void
      onAnalyzePositionSearchProgress: (handler: (payload: AnalyzePositionSearchProgress) => void) => () => void
      onAnalyzeGameQuickProgress: (handler: (payload: AnalyzeGameQuickProgress) => void) => () => void
      getDiagnostics: () => Promise<DiagnosticsReport>
      inspectKataGoAssets: () => Promise<KataGoAssetStatus>
      installKataGoOfficialModel: (payload: KataGoAssetInstallRequest) => Promise<KataGoAssetInstallResult>
      cancelKataGoAssetInstall: () => Promise<{ cancelled: boolean }>
      onKataGoAssetInstallProgress: (handler: (payload: KataGoAssetInstallProgress) => void) => () => void
      listStudentProfiles: () => Promise<StudentProfile[]>
      suggestStudentBindings: (payload: { blackName?: string; whiteName?: string; source?: string; foxNickname?: string }) => Promise<StudentBindingSuggestion[]>
      bindSgfGameToStudent: (payload: { gameId: string; studentId?: string; createDisplayName?: string; aliasFromPlayerName?: string }) => Promise<StudentProfile | null>
      bindFoxGamesToStudent: (payload: { foxNickname: string; gameIds: string[]; aliases?: string[] }) => Promise<StudentProfile>
      getStudentForGame: (gameId: string) => Promise<StudentProfile | null>
      listStudents: () => Promise<StudentProfile[]>
      resolveStudentByFoxNickname: (nickname: string) => Promise<StudentProfile>
      attachGameToStudent: (payload: { gameId: string; studentId: string }) => Promise<StudentProfile>
      addStudentAlias: (payload: { studentId: string; alias: string }) => Promise<StudentProfile>
      searchKnowledge: (payload: KnowledgeSearchQuery) => Promise<KnowledgeSearchResult[]>
      listTeacherSessions: () => Promise<TeacherSession[]>
      getActiveTeacherSession: () => Promise<TeacherSession>
      createTeacherSession: (payload?: Partial<TeacherSession>) => Promise<TeacherSession>
      updateTeacherSessionMessages: (payload: { sessionId: string; messages: TeacherChatMessage[] }) => Promise<TeacherSession>
      archiveTeacherSession: (sessionId: string) => Promise<TeacherSession | null>
      deleteTeacherSession: (sessionId: string) => Promise<boolean>
      runTeacherTask: (payload: TeacherRunRequest) => Promise<TeacherRunResult>
      cancelTeacherRun: (payload?: TeacherRunCancelRequest) => Promise<TeacherRunCancelResult>
      onTeacherRunProgress: (handler: (payload: TeacherRunProgress) => void) => () => void
      onTeacherBoardImageRequest: (handler: (payload: TeacherBoardImageRenderRequest) => Promise<TeacherBoardImageRenderResponse> | TeacherBoardImageRenderResponse) => () => void
      testLlmSettings: (payload: LlmSettingsTestRequest) => Promise<LlmSettingsTestResult>
      listLlmModels: (payload: LlmModelsListRequest) => Promise<LlmModelsListResult>
      getSavedLlmApiKey: () => Promise<{ hasKey: boolean; apiKey: string }>
      getSavedIkatagoPassword: () => Promise<{ hasPassword: boolean; password: string }>
      loginZhiziCloudPassword: (payload: ZhiziCloudLoginRequest) => Promise<ZhiziCloudLoginResult>
      sendZhiziCloudLoginCode: (payload: ZhiziCloudSendCodeRequest) => Promise<ZhiziCloudSendCodeResult>
      loginZhiziCloudCode: (payload: ZhiziCloudLoginCodeRequest) => Promise<ZhiziCloudLoginResult>
      resetZhiziCloudPassword: (payload: ZhiziCloudResetPasswordRequest) => Promise<ZhiziCloudLoginResult>
      getZhiziAccountData: () => Promise<ZhiziAccountData>
      getZhiziUsages: (page?: number, pageSize?: number) => Promise<ZhiziUsagePage>
      getZhiziCredits: (page?: number, pageSize?: number) => Promise<ZhiziCreditPage>
      createZhiziPayment: (payload: ZhiziPaymentCreateRequest) => Promise<ZhiziPaymentSession>
      refreshZhiziPayment: (orderId: string) => Promise<ZhiziPaymentSession>
      cancelZhiziPayment: (orderId: string) => Promise<ZhiziPaymentSession | null>
      logoutZhiziCloud: () => Promise<ZhiziCloudLoginResult>
      testZhiziCloudConnection: () => Promise<ZhiziCloudConnectionTestResult>
      enableZhiziCloud: (profile: ZhiziEngineProfile) => Promise<ZhiziCloudConnectionTestResult>
      disableZhiziCloud: () => Promise<ZhiziCloudLoginResult>
      openZhiziOfficialApp: () => Promise<{ ok: boolean; url: string }>
      inspectTtsAssets: () => Promise<TtsAssetStatus>
      listTtsVoices: () => Promise<TtsVoice[]>
      synthesizeTts: (payload: TtsSynthesisRequest) => Promise<TtsSynthesisResult>
      clearTtsCache: () => Promise<{ deleted: number }>
      testTtsSettings: (payload: Partial<AppSettings>) => Promise<TtsSynthesisResult>
      getSavedTtsApiKey: () => Promise<{ hasKey: boolean; apiKey: string }>
      getSavedVolcengineTtsApiKey: () => Promise<{ hasKey: boolean; apiKey: string }>
      getSavedVolcengineTtsAccessToken: () => Promise<{ hasKey: boolean; accessToken: string }>
      getReleaseReadiness: () => Promise<ReleaseReadinessResult>
      writeClipboardText: (text: string) => Promise<{ ok: boolean; length: number }>
      openPath: (filePath: string) => Promise<void>
      onDesktopCommand?: (handler: (command: DesktopCommand) => void) => () => void
    }
  }
}

export {}
