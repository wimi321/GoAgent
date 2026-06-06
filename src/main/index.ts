import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell, type ContextMenuParams, type IpcMainEvent, type IpcMainInvokeEvent, type MenuItemConstructorOptions } from 'electron'
import { isAbsolute, relative, resolve, join } from 'node:path'
import { appHome, findGame, getGames, getIkatagoPassword, getSettings, getTtsCustomApiKey, getTtsVolcengineAccessToken, getTtsVolcengineApiKey, getZhiziToken, hasIkatagoPassword, hasLlmApiKey, hasTtsCustomApiKey, hasTtsVolcengineAccessToken, hasTtsVolcengineApiKey, hasZhiziToken, replaceSettings, setSettings, upsertGames } from './lib/store'
import { BRAND_NAME } from '@shared/brand'
import type { AnalyzeGameQuickRequest, AnalyzePositionRequest, AppSettings, DashboardData, FoxSyncRequest, KataGoAssetInstallRequest, KataGoBenchmarkRequest, KataGoCancelAnalysisRequest, LibraryDeleteRequest, LlmModelsListRequest, LlmSettingsTestRequest, ReviewRequest, TeacherBoardImageRenderImage, TeacherBoardImageRenderRequest, TeacherBoardImageRenderResponse, TeacherChatMessage, TeacherRunCancelRequest, TeacherRunRequest, ZhiziCloudConnectionTestResult, ZhiziCloudLoginCodeRequest, ZhiziCloudLoginRequest, ZhiziCloudLoginResult, ZhiziCloudSendCodeRequest, ZhiziCloudSendCodeResult } from './lib/types'
import { importSgfFile, readGameRecord } from './services/sgf'
import { ensureFoxGameDownloaded, syncFoxGames } from './services/fox'
import { runReview } from './services/review'
import { applyDetectedDefaults, detectSystemProfile } from './services/systemProfile'
import { cancelTeacherRun, runTeacherTask } from './services/teacherAgent'
import { listLlmModels, testLlmSettings } from './services/llm'
import { analyzeGameQuick, analyzePosition, analyzePositionWithProgress, cancelKataGoAnalysis } from './services/katago'
import { benchmarkKataGo } from './services/katagoBenchmark'
import { getKataGoEnginePoolStats } from './services/katagoEnginePool'
import { getAnalysisSchedulerStats, runScheduledAnalysis } from './services/analysis/scheduler'
import { analyzeGameQuickRuntime, analyzePositionRuntime, analyzePositionWithProgressRuntime } from './services/analysis/runtimeIntegration'
import { collectDiagnostics } from './services/diagnostics'
import { searchKnowledgeCards } from './services/knowledge/searchLocal'
import { inspectKataGoAssets, installOfficialKataGoModel } from './services/katago/katagoAssets'
import { bindFoxGamesToStudent, bindSgfGameToStudent, suggestStudentBindings } from './services/library/studentBinding'
import { deleteLibraryGame } from './services/library/deleteGame'
import { inspectReleaseReadiness } from './services/release/readiness'
import {
  attachGameToStudent,
  listStudents,
  readStudentForGame,
  resolveStudentByFoxNickname,
  resolveStudentByName,
  upsertStudentAlias
} from './services/studentProfile'
import { archiveTeacherSession, createTeacherSession, deleteTeacherSession, getActiveTeacherSession, listTeacherSessions, updateTeacherSessionMessages } from './services/teacherSession'
import { clearTtsCache, inspectTtsAssets, listTtsVoices, synthesizeTts, testTtsSettings } from './services/tts'
import { loginZhiziCloudByCode, loginZhiziCloudByPassword, sendZhiziCloudLoginCode } from './services/zhiziCloudAuth'
import { queryZhiziGtpAnalysisBatch } from './services/zhiziGtpEngine'

let mainWindow: BrowserWindow | null = null
type DesktopCommand =
  | 'open-command-palette'
  | 'open-settings'
  | 'import-sgf'
  | 'analyze-current'
  | 'analyze-game'
  | 'analyze-recent'
  | 'toggle-library'
  | 'open-ui-gallery'

const remoteDebuggingPort = process.env.GOAGENT_REMOTE_DEBUGGING_PORT
if (remoteDebuggingPort && /^\d+$/.test(remoteDebuggingPort)) {
  app.commandLine.appendSwitch('remote-debugging-port', remoteDebuggingPort)
}

function assetPath(fileName: string): string {
  return join(__dirname, '../../assets', fileName)
}

function assertManagedPath(filePath: string): string {
  const root = resolve(appHome)
  const target = resolve(filePath)
  const rel = relative(root, target)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('只能打开 GoAgent 管理目录中的文件')
  }
  return target
}

function safeSendToRenderer(event: IpcMainInvokeEvent, channel: string, payload: unknown): boolean {
  if (event.sender.isDestroyed()) {
    return false
  }
  try {
    event.sender.send(channel, payload)
    return true
  } catch (error) {
    if (!String(error).includes('Object has been destroyed')) {
      console.warn(`Failed to send renderer event "${channel}"`, error)
    }
    return false
  }
}

function requestTeacherBoardImages(event: IpcMainInvokeEvent, request: TeacherBoardImageRenderRequest): Promise<TeacherBoardImageRenderImage[]> {
  if (event.sender.isDestroyed()) {
    return Promise.reject(new Error('渲染窗口已关闭，无法生成棋盘截图。'))
  }
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      ipcMain.removeListener('teacher:board-image-render-response', listener)
      reject(new Error('棋盘截图生成超时。'))
    }, 30_000)
    const listener = (_responseEvent: IpcMainEvent, response: TeacherBoardImageRenderResponse): void => {
      if (!response || response.requestId !== request.requestId) {
        return
      }
      clearTimeout(timeout)
      ipcMain.removeListener('teacher:board-image-render-response', listener)
      if (!response.ok) {
        reject(new Error(response.error || '棋盘截图生成失败。'))
        return
      }
      resolvePromise(response.images ?? [])
    }
    ipcMain.on('teacher:board-image-render-response', listener)
    if (!safeSendToRenderer(event, 'teacher:board-image-render-request', request)) {
      clearTimeout(timeout)
      ipcMain.removeListener('teacher:board-image-render-response', listener)
      reject(new Error('无法向渲染窗口请求棋盘截图。'))
    }
  })
}

function humanizeZhiziConnectionError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  if (/not_enough_credit|余额不足|not enough credit|没有可用算力/i.test(text)) {
    return '智子云 token 有效，但远程 worker 分配失败：当前账号没有可用算力或额度不足。请在智子云确认套餐/余额后重试。'
  }
  if (/invalid_status|NoSuchKey|ssh\.json|colab/i.test(text)) {
    return '智子云远程平台没有找到当前账号的可用 worker 配置。请确认该账号已开通对应远程算力。'
  }
  if (/token 已失效|401|invalid.*token|auth/i.test(text)) {
    return '智子云 token 已失效，请退出后重新登录智子云。'
  }
  if (/websocket error|Socket 连接失败|Socket 已断开|transport error|xhr poll error|timeout|超时/i.test(text)) {
    return `智子云 Socket 连接失败：${text.slice(0, 260)}`
  }
  return `智子云连接检测失败：${text.slice(0, 320)}`
}

function attachTextEditingContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (_event, params: ContextMenuParams) => {
    const hasSelection = params.selectionText.trim().length > 0
    const isEditable = params.isEditable
    if (!isEditable && !hasSelection) {
      return
    }

    const template: MenuItemConstructorOptions[] = [
      ...(isEditable
        ? [
            { role: 'undo' as const },
            { role: 'redo' as const },
            { type: 'separator' as const },
            { role: 'cut' as const, enabled: hasSelection },
            { role: 'copy' as const, enabled: hasSelection },
            { role: 'paste' as const },
            { role: 'pasteAndMatchStyle' as const },
            { role: 'delete' as const, enabled: hasSelection },
            { type: 'separator' as const },
            { role: 'selectAll' as const }
          ]
        : [
            { role: 'copy' as const, enabled: hasSelection },
            { type: 'separator' as const },
            { role: 'selectAll' as const }
          ])
    ]
    Menu.buildFromTemplate(template).popup({ window })
  })
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: BRAND_NAME,
    icon: assetPath('icon.png'),
    backgroundColor: '#0f1115',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 18, y: 18 }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  attachTextEditingContextMenu(mainWindow)

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function sendDesktopCommand(command: DesktopCommand): void {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    return
  }
  mainWindow.webContents.send('desktop:command', command)
}

function buildApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { label: 'Preferences...', accelerator: 'Command+,', click: () => sendDesktopCommand('open-settings') },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        } satisfies MenuItemConstructorOptions]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'Import SGF Game Record...', accelerator: 'CommandOrControl+O', click: () => sendDesktopCommand('import-sgf') },
        { type: 'separator' },
        { label: 'Command Palette...', accelerator: 'CommandOrControl+K', click: () => sendDesktopCommand('open-command-palette') },
        { label: 'Settings...', accelerator: process.platform === 'darwin' ? 'Command+,' : 'Control+,', click: () => sendDesktopCommand('open-settings') },
        ...(process.platform === 'darwin' ? [] : [{ type: 'separator' as const }, { role: 'quit' as const }])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Analyze',
      submenu: [
        { label: 'Analyze Current Move', accelerator: 'CommandOrControl+1', click: () => sendDesktopCommand('analyze-current') },
        { label: 'Analyze Full Game', accelerator: 'CommandOrControl+2', click: () => sendDesktopCommand('analyze-game') },
        { label: 'Analyze Recent 10 Games', accelerator: 'CommandOrControl+3', click: () => sendDesktopCommand('analyze-recent') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Library', accelerator: 'CommandOrControl+B', click: () => sendDesktopCommand('toggle-library') },
        { label: 'Open UI Gallery', accelerator: 'CommandOrControl+Shift+G', click: () => sendDesktopCommand('open-ui-gallery') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [{ type: 'separator' as const }, { role: 'front' as const }] : [{ role: 'close' as const }])
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function dashboard(): Promise<DashboardData> {
  const hydratedSettings = await applyDetectedDefaults(getSettings())
  replaceSettings(hydratedSettings)
  const publicSettings = { ...hydratedSettings, llmApiKey: '', ttsCustomApiKey: '', ttsVolcengineApiKey: '', ttsVolcengineAccessToken: '', ikatagoPassword: '', zhiziToken: '' }
  const detectedProfile = await detectSystemProfile(hydratedSettings)
  return {
    settings: publicSettings,
    games: getGames(),
    systemProfile: {
      ...detectedProfile,
      proxyApiKey: '',
      hasLlmApiKey: hasLlmApiKey()
    },
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.setIcon(assetPath('icon.png'))
  }
  buildApplicationMenu()

  ipcMain.handle('dashboard:get', async () => dashboard())

  ipcMain.handle('settings:update', async (_event, payload: Partial<AppSettings>) => {
    setSettings(payload)
    return dashboard()
  })

  ipcMain.handle('settings:auto-detect', async () => {
    const next = await applyDetectedDefaults(getSettings())
    replaceSettings(next)
    return dashboard()
  })

  ipcMain.handle('library:import', async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined
    const dialogOptions: Electron.OpenDialogOptions = {
      title: '导入棋谱 SGF 文件',
      buttonLabel: '导入棋谱',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'SGF files', extensions: ['sgf'] }]
    }
    const picked = owner
      ? await dialog.showOpenDialog(owner, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)
    if (picked.canceled) {
      return { dashboard: await dashboard(), imported: [] }
    }
    const imported = picked.filePaths.map((filePath) => importSgfFile(filePath, 'upload', 'Local upload'))
    upsertGames(imported)
    const defaultPlayer = getSettings().defaultPlayerName.trim()
    if (defaultPlayer) {
      const student = resolveStudentByName(defaultPlayer, 'sgf')
      for (const game of imported) {
        attachGameToStudent(game.id, student.studentId)
      }
    }
    return { dashboard: await dashboard(), imported }
  })

  ipcMain.handle('library:record', async (_event, gameId: string) => {
    const game = findGame(gameId)
    if (!game) {
      throw new Error(`找不到棋谱: ${gameId}`)
    }
    const readyGame = await ensureFoxGameDownloaded(game)
    return readGameRecord(readyGame)
  })

  ipcMain.handle('library:delete', async (_event, payload: LibraryDeleteRequest) => {
    const result = deleteLibraryGame(payload.gameId)
    return { dashboard: await dashboard(), ...result }
  })

  ipcMain.handle('fox:sync', async (_event, payload: FoxSyncRequest) => {
    const result = await syncFoxGames(payload)
    upsertGames(result.saved)
    const student = await bindFoxGamesToStudent({
      foxNickname: result.nickname || payload.keyword,
      gameIds: result.saved.map((game) => game.id),
      aliases: [result.nickname, payload.keyword].filter(Boolean)
    })
    return { dashboard: await dashboard(), result, student }
  })

  ipcMain.handle('diagnostics:get', async () => collectDiagnostics())
  ipcMain.handle('katago-assets:inspect', async () => inspectKataGoAssets())
  ipcMain.handle('katago-assets:install-official-model', async (event, payload: KataGoAssetInstallRequest | undefined) =>
    installOfficialKataGoModel(payload ?? {}, (progress) => {
      safeSendToRenderer(event, 'katago-assets:install-progress', progress)
    })
  )
  ipcMain.handle('student:list', async () => listStudents())
  ipcMain.handle('student:suggest-bindings', async (_event, payload) => suggestStudentBindings(payload))
  ipcMain.handle('student:bind-sgf-game', async (_event, payload) => bindSgfGameToStudent(payload))
  ipcMain.handle('student:bind-fox-games', async (_event, payload) => bindFoxGamesToStudent(payload))
  ipcMain.handle('student:for-game', async (_event, gameId: string) => readStudentForGame(gameId))
  ipcMain.handle('students:list', async () => listStudents())
  ipcMain.handle('students:resolve-fox', async (_event, nickname: string) => resolveStudentByFoxNickname(nickname))
  ipcMain.handle('students:attach-game', async (_event, payload: { gameId: string; studentId: string }) => attachGameToStudent(payload.gameId, payload.studentId))
  ipcMain.handle('students:alias', async (_event, payload: { studentId: string; alias: string }) => upsertStudentAlias(payload.studentId, payload.alias))
  ipcMain.handle('knowledge:search', async (_event, payload) => searchKnowledgeCards(payload))
  ipcMain.handle('teacher-sessions:list', async () => listTeacherSessions(true))
  ipcMain.handle('teacher-sessions:active', async () => getActiveTeacherSession())
  ipcMain.handle('teacher-sessions:create', async (_event, payload) => createTeacherSession(payload ?? {}))
  ipcMain.handle('teacher-sessions:update-messages', async (_event, payload: { sessionId: string; messages: TeacherChatMessage[] }) => updateTeacherSessionMessages(payload.sessionId, payload.messages))
  ipcMain.handle('teacher-sessions:archive', async (_event, sessionId: string) => archiveTeacherSession(sessionId))
  ipcMain.handle('teacher-sessions:delete', async (_event, sessionId: string) => deleteTeacherSession(sessionId))
  ipcMain.handle('review:start', async (_event, payload: ReviewRequest) => runReview(payload))
  ipcMain.handle('katago:analyze-position', async (_event, payload: AnalyzePositionRequest) => {
    const group = payload.group ?? (payload.runId ? 'teacher' : 'single')
    return runScheduledAnalysis({
      runId: payload.runId,
      group,
      priority: group === 'live' || group === 'single' ? 'live' : group === 'quick' ? 'quick' : 'teacher',
      description: `Analyze position ${payload.gameId}#${payload.moveNumber}`,
      replaceGroup: group === 'live' || !payload.runId
    }, () => analyzePositionRuntime({ gameId: payload.gameId, moveNumber: payload.moveNumber, maxVisits: payload.maxVisits, runId: payload.runId, group }))
  })
  ipcMain.handle('katago:analyze-position-stream', async (event, payload: AnalyzePositionRequest) => {
    const group = payload.group ?? (payload.runId ? 'teacher' : 'live')
    try {
      return await runScheduledAnalysis({
        runId: payload.runId,
        group,
        priority: group === 'live' || group === 'single' ? 'live' : group === 'quick' ? 'quick' : 'teacher',
        description: `Stream position ${payload.gameId}#${payload.moveNumber}`,
        replaceGroup: group === 'live' || !payload.runId
      }, () => analyzePositionWithProgressRuntime({
        gameId: payload.gameId,
        moveNumber: payload.moveNumber,
        maxVisits: payload.maxVisits,
        runId: payload.runId,
        group,
        reportDuringSearchEvery: payload.reportDuringSearchEvery ?? 0.2,
        onProgress: (analysis, isFinal) => safeSendToRenderer(event, 'katago:analyze-position-progress', {
          runId: payload.runId,
          gameId: payload.gameId,
          moveNumber: payload.moveNumber,
          analysis,
          isFinal
        })
      }))
    } catch (error) {
      if (/已取消|cancel|replaced|替换|停止/i.test(String(error))) return null
      throw error
    }
  })
  ipcMain.handle('katago:analyze-game-quick', async (event, payload: AnalyzeGameQuickRequest) =>
    runScheduledAnalysis({
      runId: payload.runId,
      group: 'quick',
      priority: 'quick',
      description: `Quick game sweep ${payload.gameId}`,
      replaceGroup: true
    }, () => analyzeGameQuickRuntime({
      gameId: payload.gameId,
      maxVisits: payload.maxVisits,
      refineVisits: payload.refineVisits,
      refineTopN: payload.refineTopN,
      runId: payload.runId,
      onProgress: (progress) => {
        safeSendToRenderer(event, 'katago:analyze-game-quick-progress', {
          ...progress,
          runId: payload.runId,
          gameId: payload.gameId
        })
      }
    }))
  )
  ipcMain.handle('katago:cancel-analysis', async (_event, payload: KataGoCancelAnalysisRequest) =>
    cancelKataGoAnalysis(payload)
  )
  ipcMain.handle('analysis-scheduler:stats', async () => getAnalysisSchedulerStats())
  ipcMain.handle('katago:engine-pool-stats', async () => getKataGoEnginePoolStats())
  ipcMain.handle('katago:benchmark', async (_event, payload: KataGoBenchmarkRequest | undefined) => benchmarkKataGo(payload ?? {}))
  ipcMain.handle('teacher:run', async (event, payload: TeacherRunRequest) =>
    runTeacherTask(payload, (progress) => {
      safeSendToRenderer(event, 'teacher:run-progress', progress)
    }, {
      captureBoardImages: (request) => requestTeacherBoardImages(event, request)
    })
  )
  ipcMain.handle('teacher:cancel-run', async (_event, payload: TeacherRunCancelRequest | undefined) =>
    cancelTeacherRun(payload ?? {})
  )
  ipcMain.handle('llm:test', async (_event, payload: LlmSettingsTestRequest) => testLlmSettings(payload))
  ipcMain.handle('llm:list-models', async (_event, payload: LlmModelsListRequest) => listLlmModels(payload))
  ipcMain.handle('llm:get-saved-api-key', async () => {
    const settings = getSettings()
    return {
      hasKey: settings.llmApiKey.trim().length > 0,
      apiKey: settings.llmApiKey
    }
  })
  ipcMain.handle('ikatago:get-saved-password', async () => ({
    hasPassword: hasIkatagoPassword(),
    password: getIkatagoPassword()
  }))
  ipcMain.handle('zhizi:get-saved-token', async () => ({
    hasToken: hasZhiziToken(),
    token: getZhiziToken()
  }))
  ipcMain.handle('zhizi:login-password', async (_event, payload: ZhiziCloudLoginRequest): Promise<ZhiziCloudLoginResult> => {
    const result = await loginZhiziCloudByPassword(payload)
    setSettings({
      zhiziUsername: payload.phone.trim(),
      zhiziToken: result.token,
      katagoEngineMode: 'zhizi'
    })
    return {
      ok: true,
      message: `${result.message} GoAgent 可直接连接智子云。`,
      hasToken: true,
      dashboard: await dashboard()
    }
  })
  ipcMain.handle('zhizi:send-code', async (_event, payload: ZhiziCloudSendCodeRequest): Promise<ZhiziCloudSendCodeResult> => {
    const result = await sendZhiziCloudLoginCode(payload)
    return {
      ok: true,
      message: result.message
    }
  })
  ipcMain.handle('zhizi:login-code', async (_event, payload: ZhiziCloudLoginCodeRequest): Promise<ZhiziCloudLoginResult> => {
    const result = await loginZhiziCloudByCode(payload)
    setSettings({
      zhiziUsername: payload.phone.trim(),
      zhiziToken: result.token,
      katagoEngineMode: 'zhizi'
    })
    return {
      ok: true,
      message: `${result.message} GoAgent 可直接连接智子云。`,
      hasToken: true,
      dashboard: await dashboard()
    }
  })
  ipcMain.handle('zhizi:logout', async (): Promise<ZhiziCloudLoginResult> => {
    cancelKataGoAnalysis({})
    setSettings({
      zhiziToken: '',
      katagoEngineMode: 'auto',
      zhiziUseWhenLocalSlow: false
    })
    return {
      ok: true,
      message: '已退出智子云登录，已清除本地 token，并切回自动分析模式。重新登录后会自动连接智子云。',
      hasToken: false,
      dashboard: await dashboard()
    }
  })
  ipcMain.handle('zhizi:test-connection', async (): Promise<ZhiziCloudConnectionTestResult> => {
    const settings = getSettings()
    if (!settings.zhiziToken.trim()) {
      return {
        ok: false,
        message: '智子云未登录：请先用账号密码或短信验证码登录。'
      }
    }
    try {
      const results = await queryZhiziGtpAnalysisBatch({
        settings: {
          ...settings,
          katagoEngineMode: 'zhizi',
          zhiziClientBin: ''
        },
        runId: `zhizi-smoke-${Date.now()}`,
        group: 'quick',
        timeoutMs: 120_000,
        queries: [
          {
            id: 'zhizi-smoke',
            boardXSize: 19,
            boardYSize: 19,
            komi: 7.5,
            initialPlayer: 'B',
            moves: [
              ['B', 'D4'],
              ['W', 'Q16'],
              ['B', 'Q4']
            ],
            maxVisits: 48
          }
        ]
      })
      const result = results.get('zhizi-smoke')
      const best = result?.moveInfos?.[0]
      if (!best) {
        return {
          ok: false,
          message: '智子云已连接，但没有返回候选点。请稍后重试。'
        }
      }
      return {
        ok: true,
        message: '智子云连接成功，远程 KataGo 已返回候选点。',
        candidateCount: result?.moveInfos?.length ?? 0,
        topMove: typeof best.move === 'string' ? best.move : undefined,
        visits: typeof best.visits === 'number' ? best.visits : undefined,
        winrate: typeof best.winrate === 'number' ? best.winrate : undefined,
        scoreMean: typeof best.scoreMean === 'number' ? best.scoreMean : typeof best.scoreLead === 'number' ? best.scoreLead : undefined
      }
    } catch (error) {
      return {
        ok: false,
        message: humanizeZhiziConnectionError(error)
      }
    }
  })
  ipcMain.handle('tts:inspect-assets', async () => inspectTtsAssets())
  ipcMain.handle('tts:list-voices', async () => listTtsVoices())
  ipcMain.handle('tts:synthesize', async (_event, payload) => synthesizeTts(payload))
  ipcMain.handle('tts:clear-cache', async () => clearTtsCache())
  ipcMain.handle('tts:test', async (_event, payload) => testTtsSettings(payload))
  ipcMain.handle('tts:get-saved-api-key', async () => ({
    hasKey: hasTtsCustomApiKey(),
    apiKey: getTtsCustomApiKey()
  }))
  ipcMain.handle('tts:get-saved-volcengine-api-key', async () => ({
    hasKey: hasTtsVolcengineApiKey(),
    apiKey: getTtsVolcengineApiKey()
  }))
  ipcMain.handle('tts:get-saved-volcengine-access-token', async () => ({
    hasKey: hasTtsVolcengineAccessToken(),
    accessToken: getTtsVolcengineAccessToken()
  }))
  ipcMain.handle('release:readiness', async () => inspectReleaseReadiness())
  ipcMain.handle('path:open', async (_event, filePath: string) => shell.showItemInFolder(assertManagedPath(filePath)))
  ipcMain.handle('clipboard:write-text', async (_event, text: string) => {
    const value = String(text ?? '').slice(0, 1_000_000)
    clipboard.writeText(value)
    return { ok: true, length: value.length }
  })

  createWindow().catch((error) => {
    console.error(error)
    app.exit(1)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
