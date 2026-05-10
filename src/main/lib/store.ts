import Store from 'electron-store'
import { app, safeStorage } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
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

function encryptSecret(value: string): SecretValue {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      mode: 'safeStorage',
      value: safeStorage.encryptString(value).toString('base64')
    }
  }
  return { mode: 'plain', value }
}

function decryptSecret(secret?: SecretValue): string {
  if (!secret) {
    return ''
  }
  try {
    if (secret.mode === 'safeStorage') {
      return safeStorage.decryptString(Buffer.from(secret.value, 'base64'))
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

function migratePlaintextApiKey(settings: AppSettings): AppSettings {
  if (settings.llmApiKey.trim()) {
    saveLlmApiKey(settings.llmApiKey)
    settingsStore.set('llmApiKey', '')
    return { ...settings, llmApiKey: '' }
  }
  return settings
}

export function getSettings(): AppSettings {
  const persisted = migratePlaintextApiKey({ ...defaults, ...settingsStore.store })
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
