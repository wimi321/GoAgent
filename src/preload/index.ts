import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  AnalyzeGameQuickRequest,
  AnalyzeGameQuickProgress,
  AnalyzePositionRequest,
  AnalyzePositionProgress,
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
  ZhiziCloudAccountStatusResult,
  ZhiziCloudConnectionTestResult,
  ZhiziCloudLoginCodeRequest,
  ZhiziCloudLoginRequest,
  ZhiziCloudLoginResult,
  ZhiziCloudSendCodeRequest,
  ZhiziCloudSendCodeResult
} from '@main/lib/types'
import type { DiagnosticsReport } from '@main/services/diagnostics/types'
import type { AnalysisSchedulerStats } from '@main/services/analysis/scheduler'
import type { KnowledgeSearchQuery, KnowledgeSearchResult } from '@main/services/knowledge/schema'

export type DesktopCommand =
  | 'open-command-palette'
  | 'open-settings'
  | 'import-sgf'
  | 'analyze-current'
  | 'analyze-game'
  | 'analyze-recent'
  | 'toggle-library'
  | 'open-ui-gallery'

const api = {
  getDashboard: (): Promise<DashboardData> => ipcRenderer.invoke('dashboard:get'),
  getGameRecord: (gameId: string): Promise<GameRecord> => ipcRenderer.invoke('library:record', gameId),
  importLibrary: (): Promise<LibraryImportResult> => ipcRenderer.invoke('library:import'),
  deleteLibraryGame: (payload: LibraryDeleteRequest): Promise<LibraryDeleteResult> => ipcRenderer.invoke('library:delete', payload),
  updateSettings: (payload: Partial<AppSettings>): Promise<DashboardData> => ipcRenderer.invoke('settings:update', payload),
  autoDetectSettings: (): Promise<DashboardData> => ipcRenderer.invoke('settings:auto-detect'),
  syncFox: (payload: FoxSyncRequest): Promise<FoxSyncResponse> => ipcRenderer.invoke('fox:sync', payload),
  startReview: (payload: ReviewRequest): Promise<ReviewResult> => ipcRenderer.invoke('review:start', payload),
  analyzePosition: (payload: AnalyzePositionRequest): Promise<KataGoMoveAnalysis> => ipcRenderer.invoke('katago:analyze-position', payload),
  analyzePositionStream: (payload: AnalyzePositionRequest): Promise<KataGoMoveAnalysis> => ipcRenderer.invoke('katago:analyze-position-stream', payload),
  analyzeTrialPositionStream: (payload: AnalyzeTrialPositionRequest): Promise<KataGoMoveAnalysis | null> => ipcRenderer.invoke('katago:analyze-trial-position-stream', payload),
  analyzeGameQuick: (payload: AnalyzeGameQuickRequest): Promise<KataGoMoveAnalysis[]> => ipcRenderer.invoke('katago:analyze-game-quick', payload),
  cancelKataGoAnalysis: (payload: KataGoCancelAnalysisRequest): Promise<KataGoCancelAnalysisResult> => ipcRenderer.invoke('katago:cancel-analysis', payload),
  getAnalysisSchedulerStats: (): Promise<AnalysisSchedulerStats> => ipcRenderer.invoke('analysis-scheduler:stats'),
  benchmarkKataGo: (payload?: KataGoBenchmarkRequest): Promise<KataGoBenchmarkResult> => ipcRenderer.invoke('katago:benchmark', payload ?? {}),
  onAnalyzePositionProgress: (handler: (payload: AnalyzePositionProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: AnalyzePositionProgress): void => handler(payload)
    ipcRenderer.on('katago:analyze-position-progress', listener)
    return () => ipcRenderer.removeListener('katago:analyze-position-progress', listener)
  },
  onAnalyzeGameQuickProgress: (handler: (payload: AnalyzeGameQuickProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: AnalyzeGameQuickProgress): void => handler(payload)
    ipcRenderer.on('katago:analyze-game-quick-progress', listener)
    return () => ipcRenderer.removeListener('katago:analyze-game-quick-progress', listener)
  },
  getDiagnostics: (): Promise<DiagnosticsReport> => ipcRenderer.invoke('diagnostics:get'),
  inspectKataGoAssets: (): Promise<KataGoAssetStatus> => ipcRenderer.invoke('katago-assets:inspect'),
  installKataGoOfficialModel: (payload: KataGoAssetInstallRequest): Promise<KataGoAssetInstallResult> => ipcRenderer.invoke('katago-assets:install-official-model', payload),
  onKataGoAssetInstallProgress: (handler: (payload: KataGoAssetInstallProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: KataGoAssetInstallProgress): void => handler(payload)
    ipcRenderer.on('katago-assets:install-progress', listener)
    return () => ipcRenderer.removeListener('katago-assets:install-progress', listener)
  },
  listStudentProfiles: (): Promise<StudentProfile[]> => ipcRenderer.invoke('student:list'),
  suggestStudentBindings: (payload: { blackName?: string; whiteName?: string; source?: string; foxNickname?: string }): Promise<StudentBindingSuggestion[]> => ipcRenderer.invoke('student:suggest-bindings', payload),
  bindSgfGameToStudent: (payload: { gameId: string; studentId?: string; createDisplayName?: string; aliasFromPlayerName?: string }): Promise<StudentProfile | null> => ipcRenderer.invoke('student:bind-sgf-game', payload),
  bindFoxGamesToStudent: (payload: { foxNickname: string; gameIds: string[]; aliases?: string[] }): Promise<StudentProfile> => ipcRenderer.invoke('student:bind-fox-games', payload),
  getStudentForGame: (gameId: string): Promise<StudentProfile | null> => ipcRenderer.invoke('student:for-game', gameId),
  listStudents: (): Promise<StudentProfile[]> => ipcRenderer.invoke('students:list'),
  resolveStudentByFoxNickname: (nickname: string): Promise<StudentProfile> => ipcRenderer.invoke('students:resolve-fox', nickname),
  attachGameToStudent: (payload: { gameId: string; studentId: string }): Promise<StudentProfile> => ipcRenderer.invoke('students:attach-game', payload),
  addStudentAlias: (payload: { studentId: string; alias: string }): Promise<StudentProfile> => ipcRenderer.invoke('students:alias', payload),
  searchKnowledge: (payload: KnowledgeSearchQuery): Promise<KnowledgeSearchResult[]> => ipcRenderer.invoke('knowledge:search', payload),
  listTeacherSessions: (): Promise<TeacherSession[]> => ipcRenderer.invoke('teacher-sessions:list'),
  getActiveTeacherSession: (): Promise<TeacherSession> => ipcRenderer.invoke('teacher-sessions:active'),
  createTeacherSession: (payload?: Partial<TeacherSession>): Promise<TeacherSession> => ipcRenderer.invoke('teacher-sessions:create', payload ?? {}),
  updateTeacherSessionMessages: (payload: { sessionId: string; messages: TeacherChatMessage[] }): Promise<TeacherSession> => ipcRenderer.invoke('teacher-sessions:update-messages', payload),
  archiveTeacherSession: (sessionId: string): Promise<TeacherSession | null> => ipcRenderer.invoke('teacher-sessions:archive', sessionId),
  deleteTeacherSession: (sessionId: string): Promise<boolean> => ipcRenderer.invoke('teacher-sessions:delete', sessionId),
  runTeacherTask: (payload: TeacherRunRequest): Promise<TeacherRunResult> => ipcRenderer.invoke('teacher:run', payload),
  cancelTeacherRun: (payload?: TeacherRunCancelRequest): Promise<TeacherRunCancelResult> => ipcRenderer.invoke('teacher:cancel-run', payload ?? {}),
  onTeacherRunProgress: (handler: (payload: TeacherRunProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TeacherRunProgress): void => handler(payload)
    ipcRenderer.on('teacher:run-progress', listener)
    return () => ipcRenderer.removeListener('teacher:run-progress', listener)
  },
  onTeacherBoardImageRequest: (handler: (payload: TeacherBoardImageRenderRequest) => Promise<TeacherBoardImageRenderResponse> | TeacherBoardImageRenderResponse): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TeacherBoardImageRenderRequest): void => {
      Promise.resolve(handler(payload))
        .then((response) => ipcRenderer.send('teacher:board-image-render-response', response))
        .catch((error) => {
          ipcRenderer.send('teacher:board-image-render-response', {
            requestId: payload.requestId,
            ok: false,
            error: String(error)
          } satisfies TeacherBoardImageRenderResponse)
        })
    }
    ipcRenderer.on('teacher:board-image-render-request', listener)
    return () => ipcRenderer.removeListener('teacher:board-image-render-request', listener)
  },
  testLlmSettings: (payload: LlmSettingsTestRequest): Promise<LlmSettingsTestResult> => ipcRenderer.invoke('llm:test', payload),
  listLlmModels: (payload: LlmModelsListRequest): Promise<LlmModelsListResult> => ipcRenderer.invoke('llm:list-models', payload),
  getSavedLlmApiKey: (): Promise<{ hasKey: boolean; apiKey: string }> => ipcRenderer.invoke('llm:get-saved-api-key'),
  getSavedIkatagoPassword: (): Promise<{ hasPassword: boolean; password: string }> => ipcRenderer.invoke('ikatago:get-saved-password'),
  getSavedZhiziToken: (): Promise<{ hasToken: boolean; token: string }> => ipcRenderer.invoke('zhizi:get-saved-token'),
  loginZhiziCloudPassword: (payload: ZhiziCloudLoginRequest): Promise<ZhiziCloudLoginResult> => ipcRenderer.invoke('zhizi:login-password', payload),
  sendZhiziCloudLoginCode: (payload: ZhiziCloudSendCodeRequest): Promise<ZhiziCloudSendCodeResult> => ipcRenderer.invoke('zhizi:send-code', payload),
  loginZhiziCloudCode: (payload: ZhiziCloudLoginCodeRequest): Promise<ZhiziCloudLoginResult> => ipcRenderer.invoke('zhizi:login-code', payload),
  logoutZhiziCloud: (): Promise<ZhiziCloudLoginResult> => ipcRenderer.invoke('zhizi:logout'),
  inspectZhiziCloudAccount: (): Promise<ZhiziCloudAccountStatusResult> => ipcRenderer.invoke('zhizi:me'),
  testZhiziCloudConnection: (): Promise<ZhiziCloudConnectionTestResult> => ipcRenderer.invoke('zhizi:test-connection'),
  refreshZhiziCloudSession: (): Promise<ZhiziCloudConnectionTestResult> => ipcRenderer.invoke('zhizi:refresh-session'),
  openZhiziOfficialAppDownload: (): Promise<{ ok: boolean; url: string }> => ipcRenderer.invoke('zhizi:open-official-app-download'),
  inspectTtsAssets: (): Promise<TtsAssetStatus> => ipcRenderer.invoke('tts:inspect-assets'),
  listTtsVoices: (): Promise<TtsVoice[]> => ipcRenderer.invoke('tts:list-voices'),
  synthesizeTts: (payload: TtsSynthesisRequest): Promise<TtsSynthesisResult> => ipcRenderer.invoke('tts:synthesize', payload),
  clearTtsCache: (): Promise<{ deleted: number }> => ipcRenderer.invoke('tts:clear-cache'),
  testTtsSettings: (payload: Partial<AppSettings>): Promise<TtsSynthesisResult> => ipcRenderer.invoke('tts:test', payload),
  getSavedTtsApiKey: (): Promise<{ hasKey: boolean; apiKey: string }> => ipcRenderer.invoke('tts:get-saved-api-key'),
  getSavedVolcengineTtsApiKey: (): Promise<{ hasKey: boolean; apiKey: string }> => ipcRenderer.invoke('tts:get-saved-volcengine-api-key'),
  getSavedVolcengineTtsAccessToken: (): Promise<{ hasKey: boolean; accessToken: string }> => ipcRenderer.invoke('tts:get-saved-volcengine-access-token'),
  getReleaseReadiness: (): Promise<ReleaseReadinessResult> => ipcRenderer.invoke('release:readiness'),
  writeClipboardText: (text: string): Promise<{ ok: boolean; length: number }> => ipcRenderer.invoke('clipboard:write-text', text),
  openPath: (filePath: string): Promise<void> => ipcRenderer.invoke('path:open', filePath),
  onDesktopCommand: (handler: (command: DesktopCommand) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: DesktopCommand): void => handler(command)
    ipcRenderer.on('desktop:command', listener)
    return () => ipcRenderer.removeListener('desktop:command', listener)
  }
}

contextBridge.exposeInMainWorld('goagent', api)

declare global {
  interface Window {
    goagent: typeof api
  }
}
