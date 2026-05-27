import Store from 'electron-store'
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { BRAND_DATA_DIR } from '@shared/brand'
import type { AppSettings, LibraryGame } from './types'

export const appHome = process.env.GOAGENT_APP_HOME || join(app.getPath('home'), BRAND_DATA_DIR)
export const libraryDir = join(appHome, 'library')
export const reviewsDir = join(appHome, 'reviews')
export const cacheDir = join(appHome, 'cache')
export const reportsDir = join(appHome, 'teacher-reports')

for (const dir of [appHome, libraryDir, reviewsDir, cacheDir, reportsDir]) {
  mkdirSync(dir, { recursive: true })
}

function defaultPythonBin(): string {
  return process.platform === 'win32' ? 'python' : 'python3'
}

const defaults: AppSettings = {
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
  katagoEngineMode: 'auto',
  katagoAnalysisSpeedMode: 'auto',
  pythonBin: defaultPythonBin(),
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

export const secretStore = new Store<{ llmApiKey?: SecretValue; ttsCustomApiKey?: SecretValue; ttsVolcengineApiKey?: SecretValue; ttsVolcengineAccessToken?: SecretValue }>({
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
  return decryptSecret(secretStore.get('llmApiKey')).trim().length > 0
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

function saveLlmApiKey(value: string): void {
  const trimmed = value.trim()
  if (trimmed) {
    secretStore.set('llmApiKey', encryptSecret(trimmed))
  }
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
  if (changed) {
    settingsStore.store = sanitized
  }
  return sanitized
}

export function getSettings(): AppSettings {
  const persisted = migratePlaintextSecrets({ ...defaults, ...settingsStore.store })
  return {
    ...persisted,
    llmApiKey: decryptSecret(secretStore.get('llmApiKey')),
    ttsCustomApiKey: decryptSecret(secretStore.get('ttsCustomApiKey')),
    ttsVolcengineApiKey: decryptSecret(secretStore.get('ttsVolcengineApiKey')),
    ttsVolcengineAccessToken: decryptSecret(secretStore.get('ttsVolcengineAccessToken'))
  }
}

export function setSettings(next: Partial<AppSettings>): AppSettings {
  if (typeof next.llmApiKey === 'string') {
    saveLlmApiKey(next.llmApiKey)
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
  const {
    llmApiKey: _llmApiKey,
    ttsCustomApiKey: _ttsCustomApiKey,
    ttsVolcengineApiKey: _ttsVolcengineApiKey,
    ttsVolcengineAccessToken: _ttsVolcengineAccessToken,
    ...safeNext
  } = next
  settingsStore.set(safeNext)
  return getSettings()
}

export function replaceSettings(next: AppSettings): AppSettings {
  if (next.llmApiKey.trim()) {
    saveLlmApiKey(next.llmApiKey)
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
  settingsStore.store = { ...next, llmApiKey: '', ttsCustomApiKey: '', ttsVolcengineApiKey: '', ttsVolcengineAccessToken: '' }
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
