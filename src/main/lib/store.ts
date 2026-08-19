import Store from 'electron-store'
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { BRAND_DATA_DIR } from '@shared/brand'
import type { AppSettings, LibraryGame, LlmConnectionProfile } from './types'

export const legacyElectronUserData = app.getPath('userData')
export const appHome = process.env.GOAGENT_APP_HOME || join(app.getPath('home'), BRAND_DATA_DIR)
export const electronUserData = process.env.GOAGENT_ELECTRON_USER_DATA || join(appHome, 'electron-user-data')
export const libraryDir = join(appHome, 'library')
export const reviewsDir = join(appHome, 'reviews')
export const cacheDir = join(appHome, 'cache')
export const reportsDir = join(appHome, 'teacher-reports')

export const LEGACY_LLM_CONNECTION_ID = 'openai-compatible-default'
export const CHATGPT_LLM_CONNECTION_ID = 'chatgpt-codex'
export const DEFAULT_OPENAI_MODEL = 'gpt-5.6-sol'

function defaultLlmConnections(): LlmConnectionProfile[] {
  return [
    {
      id: LEGACY_LLM_CONNECTION_ID,
      name: 'OpenAI-compatible API',
      provider: 'openai-compatible',
      authMode: 'api-key',
      endpoint: 'https://api.openai.com/v1',
      model: DEFAULT_OPENAI_MODEL,
      enabled: true
    },
    {
      id: CHATGPT_LLM_CONNECTION_ID,
      name: 'ChatGPT 登录',
      provider: 'codex-app-server',
      authMode: 'managed-login',
      model: '',
      enabled: true
    }
  ]
}

for (const dir of [appHome, electronUserData, libraryDir, reviewsDir, cacheDir, reportsDir]) {
  mkdirSync(dir, { recursive: true })
}
// Keep Chromium cache/profile files isolated from legacy AppData profiles that can be locked or corrupted on Windows.
app.setPath('userData', electronUserData)

function defaultPythonBin(): string {
  return process.platform === 'win32' ? 'python' : 'python3'
}

function defaultReviewLanguage(): AppSettings['reviewLanguage'] {
  let systemLocale = ''
  try {
    systemLocale = app.getLocale()
  } catch {
    // Electron may not expose app locale before ready on every platform.
  }
  const locale = (systemLocale || Intl.DateTimeFormat().resolvedOptions().locale).replaceAll('_', '-').toLowerCase()
  const traditionalChinese =
    (locale.startsWith('zh') || locale.startsWith('yue')) &&
    (locale.startsWith('yue') || locale.includes('hant') || /-(tw|hk|mo)(?:-|\.|$)/.test(locale))
  if (traditionalChinese) return 'zh-TW'
  if (locale.startsWith('zh')) return 'zh-CN'
  if (locale.startsWith('ja')) return 'ja-JP'
  if (locale.startsWith('ko')) return 'ko-KR'
  if (locale.startsWith('th')) return 'th-TH'
  if (locale.startsWith('vi')) return 'vi-VN'
  return 'en-US'
}

const defaults: AppSettings = {
  katagoBin: '',
  katagoConfig: '',
  katagoModel: '',
  katagoModelPreset: 'official-transformer-balanced',
  katagoAnalysisThreads: 0,
  katagoSearchThreadsPerAnalysisThread: 1,
  katagoMaxBatchSize: 32,
  katagoCacheSizePowerOfTwo: 20,
  katagoBenchmarkThreads: 0,
  katagoBenchmarkVisitsPerSecond: 0,
  katagoBenchmarkUpdatedAt: '',
  katagoBenchmarkEngineFingerprint: '',
  katagoBenchmarkLastCompletedAt: '',
  katagoAutoBenchmarkEnabled: true,
  katagoEngineMode: 'auto',
  katagoAnalysisSpeedMode: 'auto',
  localAnalysisDefaultApplied: false,
  ikatagoClientBin: '',
  ikatagoPlatform: 'all',
  ikatagoUsername: '',
  ikatagoPassword: '',
  ikatagoWorldUrl: '',
  ikatagoExtraArgs: '',
  ikatagoUseWhenLocalSlow: false,
  ikatagoSlowThresholdVisitsPerSecond: 120,
  zhiziUsername: '',
  zhiziToken: '',
  zhiziGpuType: 'vip-share',
  zhiziKataName: 'katago-TENSORRT',
  zhiziKataWeight: '28bnbt',
  pythonBin: defaultPythonBin(),
  llmBaseUrl: 'https://api.openai.com/v1',
  llmApiKey: '',
  llmModel: DEFAULT_OPENAI_MODEL,
  activeLlmConnectionId: LEGACY_LLM_CONNECTION_ID,
  llmConnections: defaultLlmConnections(),
  llmConnectionSchemaVersion: 0,
  onboardingVersion: 0,
  llmSetupStatus: 'unconfigured',
  llmLastVerifiedAt: '',
  reviewLanguage: defaultReviewLanguage(),
  defaultPlayerName: '',
  ttsEnabled: true,
  ttsAutoPlay: false,
  ttsProvider: 'kokoro-bundled',
  ttsLanguage: 'zh-CN',
  ttsVoiceId: 'zf_001',
  ttsRate: 1,
  ttsPitch: 1,
  ttsVolume: 1,
  ttsReadMode: 'full',
  ttsCacheEnabled: true,
  ttsKokoroDType: 'q8',
  ttsKokoroDevice: 'cpu',
  ttsVolcengineEndpoint: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional',
  ttsVolcengineAuthMode: 'api-key',
  ttsVolcengineApiKey: '',
  ttsVolcengineAppId: '',
  ttsVolcengineAccessToken: '',
  ttsVolcengineResourceId: 'seed-tts-2.0',
  ttsVolcengineSpeaker: 'zh_female_xiaohe_uranus_bigtts',
  ttsVolcengineModel: 'seed-tts-2.0-standard',
  ttsVolcengineSampleRate: 24000,
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
}

export const settingsStore = new Store<AppSettings>({
  name: 'settings',
  cwd: appHome,
  defaults
})

type SecretValue =
  | { mode: 'safeStorage'; value: string }
  | { mode: 'local-v1'; value: string; iv: string; tag: string }
  | { mode: 'plain'; value: string }

export const secretStore = new Store<{ llmApiKey?: SecretValue; llmApiKeys?: Record<string, SecretValue>; ttsCustomApiKey?: SecretValue; ttsVolcengineApiKey?: SecretValue; ttsVolcengineAccessToken?: SecretValue; ikatagoPassword?: SecretValue; zhiziToken?: SecretValue }>({
  name: 'secrets',
  cwd: appHome,
  defaults: {}
})

export const libraryStore = new Store<{ games: LibraryGame[] }>({
  name: 'library',
  cwd: appHome,
  defaults: { games: [] }
})

export const profileStore = new Store<Record<string, unknown>>({
  name: 'student-profiles',
  cwd: appHome,
  defaults: {}
})

const localSecretKeyPath = join(appHome, 'secrets.key')

function localSecretKey(): Buffer {
  if (!existsSync(localSecretKeyPath)) {
    writeFileSync(localSecretKeyPath, randomBytes(32).toString('base64'), { mode: 0o600 })
  }
  const seed = readFileSync(localSecretKeyPath, 'utf8').trim()
  return scryptSync(seed, 'goagent-local-secret-store-v1', 32)
}

function encryptSecret(value: string): SecretValue {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', localSecretKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return {
    mode: 'local-v1',
    value: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  }
}

function decryptSecret(secret?: SecretValue): string {
  if (!secret) {
    return ''
  }
  try {
    if (secret.mode === 'local-v1') {
      const decipher = createDecipheriv('aes-256-gcm', localSecretKey(), Buffer.from(secret.iv, 'base64'))
      decipher.setAuthTag(Buffer.from(secret.tag, 'base64'))
      return Buffer.concat([
        decipher.update(Buffer.from(secret.value, 'base64')),
        decipher.final()
      ]).toString('utf8')
    }
    if (secret.mode === 'safeStorage') {
      // Old GoAgent builds used Electron safeStorage, which can trigger macOS
      // Keychain prompts. Do not decrypt it here; users can paste the key once
      // to rewrite it into the app-local store without OS authorization popups.
      return ''
    }
    return secret.value
  } catch {
    return ''
  }
}

export function hasLlmApiKey(): boolean {
  return getLlmApiKey(LEGACY_LLM_CONNECTION_ID).trim().length > 0
}

export function hasTtsCustomApiKey(): boolean {
  return decryptSecret(secretStore.get('ttsCustomApiKey')).trim().length > 0
}

export function hasTtsVolcengineApiKey(): boolean {
  return decryptSecret(secretStore.get('ttsVolcengineApiKey')).trim().length > 0
}

export function hasTtsVolcengineAccessToken(): boolean {
  return decryptSecret(secretStore.get('ttsVolcengineAccessToken')).trim().length > 0
}

export function hasIkatagoPassword(): boolean {
  return decryptSecret(secretStore.get('ikatagoPassword')).trim().length > 0
}

export function hasZhiziToken(): boolean {
  return decryptSecret(secretStore.get('zhiziToken')).trim().length > 0
}

function saveLlmApiKey(value: string): void {
  saveLlmApiKeyForConnection(LEGACY_LLM_CONNECTION_ID, value)
}

export function saveLlmApiKeyForConnection(connectionId: string, value: string): void {
  const trimmed = value.trim()
  if (trimmed) {
    if (connectionId === LEGACY_LLM_CONNECTION_ID) {
      secretStore.set('llmApiKey', encryptSecret(trimmed))
    }
    const byConnection = secretStore.get('llmApiKeys', {})
    secretStore.set('llmApiKeys', { ...byConnection, [connectionId]: encryptSecret(trimmed) })
  }
}

export function getLlmApiKey(connectionId: string): string {
  const scoped = secretStore.get('llmApiKeys', {})[connectionId]
  return decryptSecret(scoped ?? (connectionId === LEGACY_LLM_CONNECTION_ID ? secretStore.get('llmApiKey') : undefined))
}

function saveTtsCustomApiKey(value: string): void {
  const trimmed = value.trim()
  if (trimmed) {
    secretStore.set('ttsCustomApiKey', encryptSecret(trimmed))
  }
}

function saveTtsVolcengineApiKey(value: string): void {
  const trimmed = value.trim()
  if (trimmed) {
    secretStore.set('ttsVolcengineApiKey', encryptSecret(trimmed))
  }
}

function saveTtsVolcengineAccessToken(value: string): void {
  const trimmed = value.trim()
  if (trimmed) {
    secretStore.set('ttsVolcengineAccessToken', encryptSecret(trimmed))
  }
}

function saveIkatagoPassword(value: string): void {
  const trimmed = value.trim()
  if (trimmed) {
    secretStore.set('ikatagoPassword', encryptSecret(trimmed))
  }
}

function saveZhiziToken(value: string): void {
  const trimmed = value.trim()
  if (trimmed) {
    secretStore.set('zhiziToken', encryptSecret(trimmed))
    return
  }
  secretStore.delete('zhiziToken')
}

function migratePlaintextSecrets(settings: AppSettings): AppSettings {
  const sanitized: AppSettings = { ...settings }
  let changed = false
  if (sanitized.llmApiKey.trim()) {
    saveLlmApiKey(settings.llmApiKey)
    sanitized.llmApiKey = ''
    changed = true
  }
  if (sanitized.ttsCustomApiKey.trim()) {
    saveTtsCustomApiKey(sanitized.ttsCustomApiKey)
    sanitized.ttsCustomApiKey = ''
    changed = true
  }
  if (sanitized.ttsVolcengineApiKey.trim()) {
    saveTtsVolcengineApiKey(sanitized.ttsVolcengineApiKey)
    sanitized.ttsVolcengineApiKey = ''
    changed = true
  }
  if (sanitized.ttsVolcengineAccessToken.trim()) {
    saveTtsVolcengineAccessToken(sanitized.ttsVolcengineAccessToken)
    sanitized.ttsVolcengineAccessToken = ''
    changed = true
  }
  if (sanitized.ikatagoPassword.trim()) {
    saveIkatagoPassword(sanitized.ikatagoPassword)
    sanitized.ikatagoPassword = ''
    changed = true
  }
  if (sanitized.zhiziToken.trim()) {
    saveZhiziToken(sanitized.zhiziToken)
    sanitized.zhiziToken = ''
    changed = true
  }
  if (changed) {
    settingsStore.store = sanitized
  }
  return sanitized
}

function migrateLocalAnalysisDefault(settings: AppSettings): AppSettings {
  if (settings.localAnalysisDefaultApplied) {
    return settings
  }
  const migrated: AppSettings = {
    ...settings,
    katagoEngineMode: settings.katagoEngineMode === 'zhizi' || settings.katagoEngineMode === 'ikatago' ? 'auto' : settings.katagoEngineMode,
    ikatagoUseWhenLocalSlow: false,
    localAnalysisDefaultApplied: true
  }
  settingsStore.set({
    katagoEngineMode: migrated.katagoEngineMode,
    ikatagoUseWhenLocalSlow: false,
    localAnalysisDefaultApplied: true
  })
  return migrated
}

function migrateZhiziLoginIdentifier(settings: AppSettings): AppSettings {
  if (!/^zz[-_]/i.test(settings.zhiziUsername.trim())) {
    return settings
  }
  settingsStore.set('zhiziUsername', '')
  return { ...settings, zhiziUsername: '' }
}

function migrateZhiziOfficialSettings(settings: AppSettings): AppSettings {
  const gpuTypes = new Set(['vip-share', '1x', '3x', '6x', '12x', '24x'])
  const kataNames = new Set(['katago-TENSORRT', 'katago-CUDA'])
  const kataWeights = new Set(['18bnbt', 'fdx', '28bnbt'])
  const {
    zhiziClientBin: legacyClientBin,
    zhiziExtraArgs: legacyExtraArgs,
    zhiziUseWhenLocalSlow: legacyAutoRemote,
    ...currentSettings
  } = settings
  const migrated: AppSettings = {
    ...currentSettings,
    zhiziGpuType: gpuTypes.has(settings.zhiziGpuType) ? settings.zhiziGpuType : 'vip-share',
    zhiziKataName: kataNames.has(settings.zhiziKataName) ? settings.zhiziKataName : 'katago-TENSORRT',
    zhiziKataWeight: kataWeights.has(settings.zhiziKataWeight) ? settings.zhiziKataWeight : '28bnbt'
  }
  if (
    legacyClientBin !== undefined ||
    legacyExtraArgs !== undefined ||
    legacyAutoRemote !== undefined ||
    migrated.zhiziGpuType !== settings.zhiziGpuType ||
    migrated.zhiziKataName !== settings.zhiziKataName ||
    migrated.zhiziKataWeight !== settings.zhiziKataWeight
  ) {
    settingsStore.delete('zhiziClientBin')
    settingsStore.delete('zhiziExtraArgs')
    settingsStore.delete('zhiziUseWhenLocalSlow')
    settingsStore.set({
      zhiziGpuType: migrated.zhiziGpuType,
      zhiziKataName: migrated.zhiziKataName,
      zhiziKataWeight: migrated.zhiziKataWeight
    })
  }
  return migrated
}

function normalizeLlmConnections(settings: AppSettings): AppSettings {
  const migratingLegacySettings = settings.llmConnectionSchemaVersion < 1
  const migratingProviderDefaults = settings.llmConnectionSchemaVersion < 2
  const configured = !migratingLegacySettings && Array.isArray(settings.llmConnections) ? settings.llmConnections : []
  const byId = new Map(configured.filter((item) => item && typeof item.id === 'string').map((item) => [item.id, item]))
  const legacy = byId.get(LEGACY_LLM_CONNECTION_ID)
  const legacyModel = legacy?.model || settings.llmModel || defaults.llmModel
  byId.set(LEGACY_LLM_CONNECTION_ID, {
    id: LEGACY_LLM_CONNECTION_ID,
    name: legacy?.name || 'OpenAI-compatible API',
    provider: 'openai-compatible',
    authMode: 'api-key',
    endpoint: legacy?.endpoint || settings.llmBaseUrl || defaults.llmBaseUrl,
    model: migratingProviderDefaults && legacyModel === 'gpt-5-mini' && settings.llmSetupStatus !== 'verified'
      ? DEFAULT_OPENAI_MODEL
      : legacyModel,
    enabled: legacy?.enabled !== false
  })
  const chatgpt = byId.get(CHATGPT_LLM_CONNECTION_ID)
  byId.set(CHATGPT_LLM_CONNECTION_ID, {
    id: CHATGPT_LLM_CONNECTION_ID,
    name: chatgpt?.name || 'ChatGPT 登录',
    provider: 'codex-app-server',
    authMode: 'managed-login',
    model: migratingProviderDefaults && chatgpt?.model === 'gpt-5-mini' ? '' : chatgpt?.model || '',
    executablePath: chatgpt?.executablePath,
    enabled: chatgpt?.enabled !== false
  })
  const llmConnections = [...byId.values()]
  const activeLlmConnectionId = byId.has(settings.activeLlmConnectionId)
    ? settings.activeLlmConnectionId
    : LEGACY_LLM_CONNECTION_ID
  const migrated = { ...settings, activeLlmConnectionId, llmConnections, llmConnectionSchemaVersion: 2 }
  if (migratingProviderDefaults || JSON.stringify(settings.llmConnections) !== JSON.stringify(llmConnections)) {
    settingsStore.set({ activeLlmConnectionId, llmConnections, llmConnectionSchemaVersion: 2 })
  }
  return migrated
}

export function getSettings(): AppSettings {
  const persisted = normalizeLlmConnections(
    migrateZhiziOfficialSettings(
      migrateZhiziLoginIdentifier(
        migrateLocalAnalysisDefault(migratePlaintextSecrets({ ...defaults, ...settingsStore.store }))
      )
    )
  )
  const active = persisted.llmConnections.find((item) => item.id === persisted.activeLlmConnectionId)
  const activeApiKey = active?.provider === 'openai-compatible' ? getLlmApiKey(active.id) : ''
  return {
    ...persisted,
    llmBaseUrl: active?.provider === 'openai-compatible' ? active.endpoint || persisted.llmBaseUrl : persisted.llmBaseUrl,
    llmModel: active?.model ?? persisted.llmModel,
    llmApiKey: activeApiKey,
    ttsCustomApiKey: decryptSecret(secretStore.get('ttsCustomApiKey')),
    ttsVolcengineApiKey: decryptSecret(secretStore.get('ttsVolcengineApiKey')),
    ttsVolcengineAccessToken: decryptSecret(secretStore.get('ttsVolcengineAccessToken')),
    ikatagoPassword: decryptSecret(secretStore.get('ikatagoPassword')),
    zhiziToken: decryptSecret(secretStore.get('zhiziToken'))
  }
}

export function setSettings(next: Partial<AppSettings>): AppSettings {
  if (typeof next.llmApiKey === 'string') {
    const current = getSettings()
    const targetId = next.activeLlmConnectionId || current.activeLlmConnectionId
    saveLlmApiKeyForConnection(targetId, next.llmApiKey)
  }
  if (typeof next.ttsCustomApiKey === 'string') {
    saveTtsCustomApiKey(next.ttsCustomApiKey)
  }
  if (typeof next.ttsVolcengineApiKey === 'string') {
    saveTtsVolcengineApiKey(next.ttsVolcengineApiKey)
  }
  if (typeof next.ttsVolcengineAccessToken === 'string') {
    saveTtsVolcengineAccessToken(next.ttsVolcengineAccessToken)
  }
  if (typeof next.ikatagoPassword === 'string') {
    saveIkatagoPassword(next.ikatagoPassword)
  }
  if (typeof next.zhiziToken === 'string') {
    saveZhiziToken(next.zhiziToken)
  }
  const {
    llmApiKey: _llmApiKey,
    ttsCustomApiKey: _ttsCustomApiKey,
    ttsVolcengineApiKey: _ttsVolcengineApiKey,
    ttsVolcengineAccessToken: _ttsVolcengineAccessToken,
    ikatagoPassword: _ikatagoPassword,
    zhiziToken: _zhiziToken,
    ...safeNext
  } = next
  const currentBeforeWrite = getSettings()
  const legacyFieldsChanged =
    Object.prototype.hasOwnProperty.call(next, 'llmBaseUrl') ||
    Object.prototype.hasOwnProperty.call(next, 'llmModel')
  if (!safeNext.llmConnections && legacyFieldsChanged) {
    safeNext.llmConnections = currentBeforeWrite.llmConnections.map((connection) =>
      connection.id === LEGACY_LLM_CONNECTION_ID
        ? {
            ...connection,
            endpoint: typeof next.llmBaseUrl === 'string' ? next.llmBaseUrl : connection.endpoint,
            model: typeof next.llmModel === 'string' ? next.llmModel : connection.model
          }
        : connection
    )
  }
  if (safeNext.llmConnections) {
    const legacy = safeNext.llmConnections.find((connection) => connection.id === LEGACY_LLM_CONNECTION_ID)
    if (legacy) {
      safeNext.llmBaseUrl = legacy.endpoint || currentBeforeWrite.llmBaseUrl
      safeNext.llmModel = legacy.model || currentBeforeWrite.llmModel
    }
  }
  delete safeNext.zhiziClientBin
  delete safeNext.zhiziExtraArgs
  delete safeNext.zhiziUseWhenLocalSlow
  const shouldMarkLocalDefaultApplied =
    Object.prototype.hasOwnProperty.call(safeNext, 'katagoEngineMode') ||
    Object.prototype.hasOwnProperty.call(safeNext, 'ikatagoUseWhenLocalSlow')
  settingsStore.set(shouldMarkLocalDefaultApplied ? { ...safeNext, localAnalysisDefaultApplied: true } : safeNext)
  const llmConfigChanged =
    Object.prototype.hasOwnProperty.call(next, 'llmBaseUrl') ||
    Object.prototype.hasOwnProperty.call(next, 'llmApiKey') ||
    Object.prototype.hasOwnProperty.call(next, 'llmModel') ||
    Object.prototype.hasOwnProperty.call(next, 'activeLlmConnectionId') ||
    Object.prototype.hasOwnProperty.call(next, 'llmConnections')
  if (llmConfigChanged && !Object.prototype.hasOwnProperty.call(next, 'llmSetupStatus')) {
    const current = getSettings()
    const active = current.llmConnections.find((connection) => connection.id === current.activeLlmConnectionId)
    const configured = active?.provider === 'codex-app-server'
      ? false
      : Boolean(current.llmBaseUrl.trim() && current.llmApiKey.trim() && current.llmModel.trim())
    settingsStore.set({
      llmSetupStatus: configured ? 'needs-attention' : 'unconfigured',
      llmLastVerifiedAt: ''
    })
  }
  return getSettings()
}

export function replaceSettings(next: AppSettings): AppSettings {
  if (next.llmApiKey.trim()) {
    saveLlmApiKeyForConnection(next.activeLlmConnectionId || LEGACY_LLM_CONNECTION_ID, next.llmApiKey)
  }
  if (next.ttsCustomApiKey.trim()) {
    saveTtsCustomApiKey(next.ttsCustomApiKey)
  }
  if (next.ttsVolcengineApiKey.trim()) {
    saveTtsVolcengineApiKey(next.ttsVolcengineApiKey)
  }
  if (next.ttsVolcengineAccessToken.trim()) {
    saveTtsVolcengineAccessToken(next.ttsVolcengineAccessToken)
  }
  if (next.ikatagoPassword.trim()) {
    saveIkatagoPassword(next.ikatagoPassword)
  }
  if (next.zhiziToken.trim()) {
    saveZhiziToken(next.zhiziToken)
  }
  const {
    zhiziClientBin: _zhiziClientBin,
    zhiziExtraArgs: _zhiziExtraArgs,
    zhiziUseWhenLocalSlow: _zhiziUseWhenLocalSlow,
    ...currentSettings
  } = next
  settingsStore.store = { ...currentSettings, localAnalysisDefaultApplied: true, llmApiKey: '', ttsCustomApiKey: '', ttsVolcengineApiKey: '', ttsVolcengineAccessToken: '', ikatagoPassword: '', zhiziToken: '' }
  return getSettings()
}

export function getTtsCustomApiKey(): string {
  return decryptSecret(secretStore.get('ttsCustomApiKey'))
}

export function getTtsVolcengineApiKey(): string {
  return decryptSecret(secretStore.get('ttsVolcengineApiKey'))
}

export function getTtsVolcengineAccessToken(): string {
  return decryptSecret(secretStore.get('ttsVolcengineAccessToken'))
}

export function getIkatagoPassword(): string {
  return decryptSecret(secretStore.get('ikatagoPassword'))
}

export function getZhiziToken(): string {
  return decryptSecret(secretStore.get('zhiziToken'))
}

export function getActiveLlmConnection(settings: AppSettings = getSettings()): LlmConnectionProfile {
  return settings.llmConnections.find((connection) => connection.id === settings.activeLlmConnectionId)
    ?? settings.llmConnections.find((connection) => connection.id === LEGACY_LLM_CONNECTION_ID)
    ?? defaultLlmConnections()[0]
}

export function getGames(): LibraryGame[] {
  return [...libraryStore.get('games', [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function upsertGames(games: LibraryGame[]): LibraryGame[] {
  const byId = new Map(getGames().map((game) => [game.id, game]))
  for (const game of games) {
    byId.set(game.id, game)
  }
  const merged = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  libraryStore.set('games', merged)
  return merged
}

export function findGame(gameId: string): LibraryGame | undefined {
  return getGames().find((game) => game.id === gameId)
}

export function removeGame(gameId: string): LibraryGame | null {
  const games = getGames()
  const deleted = games.find((game) => game.id === gameId)
  if (!deleted) {
    return null
  }
  libraryStore.set('games', games.filter((game) => game.id !== gameId))
  return deleted
}
