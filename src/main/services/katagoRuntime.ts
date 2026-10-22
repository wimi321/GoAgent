import { execFile, execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { basename, join } from 'node:path'
import { appHome } from '@main/lib/store'
import type { AppSettings, KataGoModelPreset, KataGoModelPresetId } from '@main/lib/types'
import {
  KATAGO_NON_TENSORRT_RELEASE,
  kataGoVersionSatisfies,
  parseKataGoVersion
} from '@main/services/katago/version'

export const DEFAULT_KATAGO_MODEL_PRESET: KataGoModelPresetId = 'official-transformer-balanced'

const OFFICIAL_NETWORKS_URL = 'https://katagotraining.org/networks/'
const OFFICIAL_NETWORK_CDN = 'https://media.katagotraining.org/uploaded/networks/models/kata1/'
const OFFICIAL_KATAGO_1171_RELEASE = `https://github.com/lightvector/KataGo/releases/download/v${KATAGO_NON_TENSORRT_RELEASE}/`

function officialNetworkUrl(fileName: string): string {
  return `${OFFICIAL_NETWORK_CDN}${fileName}`
}

export const KATAGO_MODEL_PRESETS: KataGoModelPreset[] = [
  {
    id: 'official-transformer-light',
    label: 'Transformer 10B 轻量版',
    badge: '快速推荐',
    group: '官方 Transformer 模型',
    blockSize: '10B',
    speedTier: 'fast',
    sizeHint: '约 38 MB',
    description: '官方轻量 Transformer。每次访问强于传统 b18，通常同样快或更快，适合快速胜率图和普通电脑。',
    networkName: 'b10c384h6nbttflrs',
    fileName: 'b10c384h6nbttflrs.bin.gz',
    sourceUrl: `${OFFICIAL_KATAGO_1171_RELEASE}b10c384h6nbttflrs.bin.gz`,
    downloadUrl: `${OFFICIAL_KATAGO_1171_RELEASE}b10c384h6nbttflrs.bin.gz`,
    sha256: '0ba27eced5180b3e3d0b898b280c541112989765e789d1eb6cd0d31b2b2c1229',
    sizeBytes: 38245488,
    minimumEngineVersion: '1.17.0',
    recommended: false
  },
  {
    id: 'official-transformer-balanced',
    label: 'Transformer 10B 均衡版',
    badge: '首选',
    group: '官方 Transformer 模型',
    blockSize: '10B',
    speedTier: 'balanced',
    sizeHint: '约 94 MB',
    description: 'GoAgent 默认推荐。官方中型 Transformer 每次访问强于传统 b28，通常同样快或更快，兼顾快速胜率图和精读。',
    networkName: 'b10c512h8nbt3tflrs-fson-silu-rsnh',
    fileName: 'b10c512h8nbt3tflrs-fson-silu-rsnh.bin.gz',
    sourceUrl: `${OFFICIAL_KATAGO_1171_RELEASE}b10c512h8nbt3tflrs-fson-silu-rsnh.bin.gz`,
    downloadUrl: `${OFFICIAL_KATAGO_1171_RELEASE}b10c512h8nbt3tflrs-fson-silu-rsnh.bin.gz`,
    sha256: 'c04db4a503721d948bb720324f3cbdac6088cc9eb243632f020e4b6846f58995',
    sizeBytes: 94281753,
    minimumEngineVersion: '1.17.0',
    recommended: true
  },
  {
    id: 'official-transformer-strong',
    label: 'Transformer 11B 旗舰版',
    badge: '最强',
    group: '官方 Transformer 模型',
    blockSize: '11B',
    speedTier: 'maximum',
    sizeHint: '约 212 MB',
    description: '官方最大 Transformer，每次访问强于传统 zhizi b40，适合高配机器进行关键局面深度精读。',
    networkName: 'b11c768h12nbt3tflrs-fson-silu',
    fileName: 'b11c768h12nbt3tflrs-fson-silu.bin.gz',
    sourceUrl: `${OFFICIAL_KATAGO_1171_RELEASE}b11c768h12nbt3tflrs-fson-silu.bin.gz`,
    downloadUrl: `${OFFICIAL_KATAGO_1171_RELEASE}b11c768h12nbt3tflrs-fson-silu.bin.gz`,
    sha256: '1881600caab9e9d85a3dd6a019e9b8e7d2c237b5f984e13ed49a8645be3077c6',
    sizeBytes: 211660960,
    minimumEngineVersion: '1.17.0',
    recommended: false
  },
  {
    id: 'official-b18-recommended',
    label: 'b18 README 日常推荐',
    badge: '日常推荐',
    group: '18b 官方推荐 / 日常教学',
    blockSize: 'b18',
    speedTier: 'balanced',
    sizeHint: '通用',
    description: 'KataGo README 推荐的一般首选：强、准、机器压力适中，适合日常教学和自动胜率图。',
    networkName: 'kata1-b18c384nbt-s9996604416-d4316597426',
    fileName: 'kata1-b18c384nbt-s9996604416-d4316597426.bin.gz',
    sourceUrl: OFFICIAL_NETWORKS_URL,
    downloadUrl: officialNetworkUrl('kata1-b18c384nbt-s9996604416-d4316597426.bin.gz'),
    recommended: false
  },
  {
    id: 'official-b18-stable',
    label: 'b18 稳定备选',
    badge: '轻快',
    group: '18b 官方推荐 / 日常教学',
    blockSize: 'b18',
    speedTier: 'fast',
    sizeHint: '通用',
    description: '同为 b18c384nbt 的高分备选权重，适合希望保持轻快分析速度的机器。',
    networkName: 'kata1-b18c384nbt-s9967423488-d4308703317',
    fileName: 'kata1-b18c384nbt-s9967423488-d4308703317.bin.gz',
    sourceUrl: OFFICIAL_NETWORKS_URL,
    downloadUrl: officialNetworkUrl('kata1-b18c384nbt-s9967423488-d4308703317.bin.gz'),
    recommended: false
  },
  {
    id: 'official-b20-strong',
    label: 'b20 强力轻量',
    badge: '20b 强',
    group: '20b 快速分析 / 旧机友好',
    blockSize: 'b20',
    speedTier: 'balanced',
    sizeHint: '较快',
    description: 'b20c256x2 中较高评分的一档，适合 CPU 或入门 GPU 做快速胜率图和日常复盘。',
    networkName: 'kata1-b20c256x2-s5303129600-d1228401921',
    fileName: 'kata1-b20c256x2-s5303129600-d1228401921.bin.gz',
    sourceUrl: OFFICIAL_NETWORKS_URL,
    downloadUrl: officialNetworkUrl('kata1-b20c256x2-s5303129600-d1228401921.bin.gz'),
    recommended: false
  },
  {
    id: 'official-b20-balanced',
    label: 'b20 平衡备选',
    badge: '20b 快',
    group: '20b 快速分析 / 旧机友好',
    blockSize: 'b20',
    speedTier: 'fast',
    sizeHint: '较快',
    description: 'b20c256x2 的轻量备选，更偏速度和兼容性，适合先把整盘胜率曲线快速跑出来。',
    networkName: 'kata1-b20c256x2-s5055114240-d1149032340',
    fileName: 'kata1-b20c256x2-s5055114240-d1149032340.bin.gz',
    sourceUrl: OFFICIAL_NETWORKS_URL,
    downloadUrl: officialNetworkUrl('kata1-b20c256x2-s5055114240-d1149032340.bin.gz'),
    recommended: false
  },
  {
    id: 'official-b28-strong',
    label: 'zhizi b28 经典强力',
    badge: '经典模型',
    group: '经典卷积模型',
    blockSize: 'b28',
    speedTier: 'strong',
    sizeHint: '较慢',
    description: '曾长期作为官方强力选择的经典 b28 模型。保留给希望复现旧分析结果的用户。',
    networkName: 'kata1-zhizi-b28c512nbt-muonfd2',
    fileName: 'kata1-zhizi-b28c512nbt-muonfd2.bin.gz',
    sourceUrl: OFFICIAL_NETWORKS_URL,
    downloadUrl: officialNetworkUrl('kata1-zhizi-b28c512nbt-muonfd2.bin.gz'),
    recommended: false
  },
  {
    id: 'official-b28-latest',
    label: 'b28 最新训练线',
    badge: '28b 新',
    group: '28b 高强度精读',
    blockSize: 'b28',
    speedTier: 'strong',
    sizeHint: '较慢',
    description: '官方网络列表中较新的 b28c512nbt 训练线，适合高配置机器做更深的局面判断。',
    networkName: 'kata1-b28c512nbt-s12763923712-d5805955894',
    fileName: 'kata1-b28c512nbt-s12763923712-d5805955894.bin.gz',
    sourceUrl: OFFICIAL_NETWORKS_URL,
    downloadUrl: officialNetworkUrl('kata1-b28c512nbt-s12763923712-d5805955894.bin.gz'),
    recommended: false
  },
  {
    id: 'official-b40-latest',
    label: 'zhizi b40 经典旗舰',
    badge: '经典旗舰',
    group: '经典卷积模型',
    blockSize: 'b40',
    speedTier: 'maximum',
    sizeHint: '很慢',
    description: '传统 zhizi b40 旗舰模型，保留用于旧分析复现和模型对照。新用户优先选择 Transformer。',
    networkName: 'kata1-zhizi-b40c768nbt-fdx6c',
    fileName: 'kata1-zhizi-b40c768nbt-fdx6c.bin.gz',
    sourceUrl: OFFICIAL_NETWORKS_URL,
    downloadUrl: officialNetworkUrl('kata1-zhizi-b40c768nbt-fdx6c.bin.gz'),
    recommended: false
  },
  {
    id: 'official-b40-classic',
    label: 'b40 经典 c256',
    badge: '40b 稳',
    group: '40b 旗舰 / 高配机器',
    blockSize: 'b40',
    speedTier: 'maximum',
    sizeHint: '很慢',
    description: '经典 b40c256 高强度权重，适合需要 40b 级别判断但希望资源压力低于最新旗舰的场景。',
    networkName: 'kata1-b40c256-s12860905472-d3197353276',
    fileName: 'kata1-b40c256-s12860905472-d3197353276.bin.gz',
    sourceUrl: OFFICIAL_NETWORKS_URL,
    downloadUrl: officialNetworkUrl('kata1-b40c256-s12860905472-d3197353276.bin.gz'),
    recommended: false
  }
]

export interface KataGoRuntime {
  katagoBin: string
  katagoConfig: string
  katagoModel: string
  modelPreset: KataGoModelPreset
  ready: boolean
  status: string
  notes: string[]
}

interface BundledAssetMetadata {
  modelPath?: string
  binaryPath?: string
  binaryPlatform?: string
}

function platformBinaryName(): string {
  return process.platform === 'win32' ? 'katago.exe' : 'katago'
}

function platformKey(): string {
  return `${process.platform}-${process.arch}`
}

function unique(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))]
}

function firstExisting(paths: string[]): string {
  return unique(paths).find((path) => existsSync(path)) ?? ''
}

type BinaryProbe = { ok: boolean; note: string; version: string }

const binaryProbeCache = new Map<string, BinaryProbe>()
// Probes that timed out keep running in the background: the first launch of a freshly
// downloaded engine can wait on the OS malware scan (Gatekeeper/XProtect, Defender) for
// far longer than the synchronous probe may block the main process.
const pendingBinaryProbes = new Set<string>()
const BINARY_PROBE_TIMEOUT_MS = 5000
const BACKGROUND_BINARY_PROBE_TIMEOUT_MS = 180_000
const WINDOWS_LOADER_FAILURES: Record<number, string> = {
  0xc0000135: '缺少 DLL 依赖',
  0xc000007b: 'DLL 与程序架构不匹配',
  0xc0000139: 'DLL 入口点缺失，可能是版本不匹配',
  0xc0000142: 'DLL 初始化失败'
}
let lastBinaryRejectionNotes: string[] = []
let lastBinaryVersion = ''

function platformCompatibleBinaryPath(path: string): boolean {
  if (!path) {
    return false
  }
  const normalized = path.replace(/\\/g, '/')
  const expectedKey = platformKey()
  if (/\/(darwin|win32|linux)-[^/]+\//.test(normalized) && !normalized.includes(`/${expectedKey}/`)) {
    return false
  }
  if (process.platform !== 'win32' && (/\/win32-[^/]+\//.test(normalized) || /\.exe$/i.test(normalized))) {
    return false
  }
  if (process.platform === 'win32') {
    return !/\/(darwin|linux)-[^/]+\//.test(normalized)
  }
  if (process.platform === 'darwin') {
    return !/\/linux-[^/]+\//.test(normalized)
  }
  if (process.platform === 'linux') {
    return !/\/darwin-[^/]+\//.test(normalized)
  }
  return true
}

function firstExistingBinary(paths: string[], minimumVersion = ''): string {
  lastBinaryRejectionNotes = []
  lastBinaryVersion = ''
  for (const path of unique(paths)) {
    const probe = probeKataGoBinary(path, minimumVersion)
    if (probe.ok) {
      lastBinaryVersion = probe.version
      return path
    }
    if (probe.note) lastBinaryRejectionNotes.push(probe.note)
  }
  return ''
}

function binaryProbeCacheKey(path: string): string {
  try {
    const stat = statSync(path)
    return `${path}:${stat.size}:${stat.mtimeMs}`
  } catch {
    return path
  }
}

function exitStatusHint(status: unknown): string {
  if (typeof status !== 'number' || status === 0) return ''
  const unsigned = status >>> 0
  if (unsigned <= 0xffff) return `退出码 ${status}`
  const known = WINDOWS_LOADER_FAILURES[unsigned]
  return `退出码 0x${unsigned.toString(16).toUpperCase().padStart(8, '0')}${known ? `（${known}）` : ''}`
}

function shortProbeError(error: unknown): string {
  const detail = error as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string; code?: string; status?: number | null }
  const text = String(detail.stderr || detail.stdout || detail.message || detail.code || error)
  // The exit status goes first: a Windows loader failure prints nothing and would
  // otherwise surface only as a generic "Command failed".
  return [exitStatusHint(detail.status), ...text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 2)]
    .filter(Boolean)
    .join('；')
    .slice(0, 220)
}

function versionBinaryProbe(path: string, output: string): BinaryProbe {
  const version = parseKataGoVersion(output)
  return version
    ? { ok: true, note: '', version }
    : { ok: false, note: `跳过无法识别版本的 KataGo: ${path}`, version: '' }
}

function failedBinaryProbe(path: string, error: unknown): BinaryProbe {
  return {
    ok: false,
    note: `跳过无法启动的 KataGo: ${path}（${shortProbeError(error)}）`,
    version: ''
  }
}

function pendingBinaryProbe(path: string): BinaryProbe {
  return {
    ok: false,
    note: `KataGo 首次启动校验中，系统安全扫描可能需要一两分钟: ${path}`,
    version: ''
  }
}

function verifyKataGoBinaryInBackground(path: string, cacheKey: string): void {
  if (pendingBinaryProbes.has(cacheKey)) return
  pendingBinaryProbes.add(cacheKey)
  execFile(path, ['version'], { encoding: 'utf8', timeout: BACKGROUND_BINARY_PROBE_TIMEOUT_MS, windowsHide: true }, (error, stdout) => {
    pendingBinaryProbes.delete(cacheKey)
    binaryProbeCache.set(cacheKey, error ? failedBinaryProbe(path, error) : versionBinaryProbe(path, String(stdout)))
  })
}

function probeKataGoBinary(path: string, minimumVersion = ''): BinaryProbe {
  if (!path || !existsSync(path)) return { ok: false, note: '', version: '' }
  if (isAsarPath(path)) return { ok: false, note: `跳过 app.asar 内的 KataGo: ${path}`, version: '' }
  if (!platformCompatibleBinaryPath(path)) return { ok: false, note: `跳过不匹配当前系统的 KataGo: ${path}`, version: '' }

  try {
    chmodSync(path, 0o755)
  } catch {
    // Keep probing. Some system-managed binaries cannot be chmodded but are
    // already executable.
  }

  const cacheKey = binaryProbeCacheKey(path)
  const cached = binaryProbeCache.get(cacheKey)
  if (cached) {
    if (cached.ok && minimumVersion && !kataGoVersionSatisfies(cached.version, minimumVersion)) {
      return { ok: false, note: `跳过版本过旧的 KataGo ${cached.version || '未知版本'}（需要 ${minimumVersion}+）: ${path}`, version: cached.version }
    }
    return cached
  }
  if (pendingBinaryProbes.has(cacheKey)) {
    return pendingBinaryProbe(path)
  }

  try {
    const output = execFileSync(path, ['version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: BINARY_PROBE_TIMEOUT_MS,
      windowsHide: true
    })
    const result = versionBinaryProbe(path, String(output))
    binaryProbeCache.set(cacheKey, result)
    if (result.ok && minimumVersion && !kataGoVersionSatisfies(result.version, minimumVersion)) {
      return { ok: false, note: `跳过版本过旧的 KataGo ${result.version}（需要 ${minimumVersion}+）: ${path}`, version: result.version }
    }
    return result
  } catch (error) {
    if ((error as { code?: string }).code === 'ETIMEDOUT') {
      // A timeout is not a verdict. Caching it would report "KataGo missing" for the
      // whole session even though the engine works once the OS scan finishes.
      verifyKataGoBinaryInBackground(path, cacheKey)
      return pendingBinaryProbe(path)
    }
    const result = failedBinaryProbe(path, error)
    binaryProbeCache.set(cacheKey, result)
    return result
  }
}

function globModelFiles(directory: string, pattern: RegExp): string[] {
  if (!existsSync(directory)) {
    return []
  }
  try {
    return readdirSync(directory)
      .filter((file) => pattern.test(file))
      .sort()
      .reverse()
      .map((file) => join(directory, file))
  } catch {
    return []
  }
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function isAsarPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  return normalized.includes('/app.asar/') || normalized.endsWith('/app.asar')
}

function bundledMetadata(root: string): BundledAssetMetadata {
  const manifest = readJson(join(root, 'manifest.json'))
  const edition = readJson(join(root, 'edition.json'))
  const manifestModel = typeof manifest?.modelPath === 'string' ? manifest.modelPath : ''
  const editionModel = typeof edition?.modelPath === 'string' ? edition.modelPath : ''
  const editionBinary = typeof edition?.binaryPath === 'string' ? edition.binaryPath : ''
  const editionPlatform = typeof edition?.platform === 'string' ? edition.platform : ''
  return {
    modelPath: editionModel || manifestModel || '',
    binaryPath: editionPlatform === platformKey() ? editionBinary : '',
    binaryPlatform: editionPlatform || undefined
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getKataGoModelPreset(id?: string): KataGoModelPreset {
  return (
    KATAGO_MODEL_PRESETS.find((preset) => preset.id === id) ??
    KATAGO_MODEL_PRESETS.find((preset) => preset.id === DEFAULT_KATAGO_MODEL_PRESET) ??
    KATAGO_MODEL_PRESETS[0]
  )
}

function packagedResourceRoots(): string[] {
  const roots: string[] = []
  if (process.resourcesPath) {
    roots.push(
      join(process.resourcesPath, 'data', 'katago'),
      join(process.resourcesPath, 'app.asar.unpacked', 'data', 'katago'),
      join(process.resourcesPath, 'katago')
    )
  }
  roots.push(
    join(process.cwd(), 'data', 'katago'),
    join(__dirname, '../../data/katago')
  )
  return unique(roots).filter((root) => !isAsarPath(root))
}

function resourceRoots(): string[] {
  return unique([...packagedResourceRoots(), join(appHome, 'katago')])
}

function modelResourceRoots(): string[] {
  return unique([join(appHome, 'katago'), ...packagedResourceRoots()])
}

// Runtime resolution happens on every analysis batch; PATH rarely changes, so avoid a
// synchronous `which` spawn each time.
let pathKatagoLookup: { value: string; checkedAt: number; searchPath: string } | null = null

function pathKatago(): string {
  const searchPath = process.env.PATH ?? ''
  if (pathKatagoLookup && pathKatagoLookup.searchPath === searchPath && Date.now() - pathKatagoLookup.checkedAt < 60_000) {
    return pathKatagoLookup.value
  }
  let value = ''
  try {
    if (process.platform === 'win32') {
      // Avoid Unix-only `which` and Windows console code pages: scan the PATH
      // directly so a KataGo installation under a Chinese username still works.
      value = searchPath.split(';')
        .map((directory) => directory.trim().replace(/^"|"$/g, ''))
        .filter(Boolean)
        .map((directory) => join(directory, 'katago.exe'))
        .find((candidate) => {
          try { return statSync(candidate).isFile() } catch { return false }
        }) ?? ''
    } else {
      value = execFileSync('/usr/bin/which', ['katago'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    }
  } catch {
    value = ''
  }
  pathKatagoLookup = { value, checkedAt: Date.now(), searchPath }
  return value
}

function binaryCandidates(): string[] {
  const file = platformBinaryName()
  const roots = resourceRoots()
  return [
    process.env.GOAGENT_KATAGO_BIN ?? '',
    ...roots.map((root) => {
      const metadata = bundledMetadata(root)
      return metadata.binaryPath ? join(root, metadata.binaryPath) : ''
    }),
    ...roots.flatMap((root) => [
      join(root, 'bin', platformKey(), file),
      join(root, 'bin', process.platform, file),
      join(root, 'bin', file),
      join(root, file)
    ]),
    '/opt/homebrew/bin/katago',
    '/usr/local/bin/katago',
    '/opt/local/bin/katago',
    '/usr/bin/katago',
    pathKatago()
  ]
}

function modelDirectories(): string[] {
  return [
    ...modelResourceRoots().map((root) => join(root, 'models')),
    join(os.homedir(), '.katago', 'models')
  ]
}

function modelCandidates(preset: KataGoModelPreset, settings?: AppSettings): string[] {
  const directories = modelDirectories()
  const bundledModels = modelResourceRoots().map((root) => {
    const metadata = bundledMetadata(root)
    return metadata.modelPath ? join(root, metadata.modelPath) : ''
  })
  const blockToken = preset.blockSize || preset.networkName.match(/b\d+/)?.[0] || ''
  const presetPatterns = [
    new RegExp(`^${escapeRegExp(preset.networkName)}\\.bin\\.gz$`),
    blockToken ? new RegExp(`^kata1-.*${escapeRegExp(blockToken)}.*\\.bin\\.gz$`) : null
  ].filter((pattern): pattern is RegExp => Boolean(pattern))
  const selectedPresetFiles = directories.map((directory) => join(directory, preset.fileName))
  const matchingPresetFiles = directories.flatMap((directory) => presetPatterns.flatMap((pattern) => globModelFiles(directory, pattern)))
  const compatibilityFiles = [
    settings?.katagoModel ?? '',
    ...bundledModels,
    ...directories.map((directory) => join(directory, 'latest-kata1.bin.gz')),
    ...directories.map((directory) => join(directory, 'default.bin.gz')),
    ...directories.flatMap((directory) => globModelFiles(directory, /^kata1-.*b40.*\.bin\.gz$/)),
    ...directories.flatMap((directory) => globModelFiles(directory, /^kata1-.*b28.*\.bin\.gz$/)),
    ...directories.flatMap((directory) => globModelFiles(directory, /^kata1-.*b20.*\.bin\.gz$/)),
    ...directories.flatMap((directory) => globModelFiles(directory, /^kata1-b18c384nbt.*\.bin\.gz$/)),
    ...directories.flatMap((directory) => globModelFiles(directory, /^.*\.bin\.gz$/))
  ]
  return [...selectedPresetFiles, ...matchingPresetFiles, ...compatibilityFiles]
}

function saneInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !value) {
    return fallback
  }
  return Math.max(min, Math.min(max, Math.round(value)))
}

function defaultAnalysisThreads(): number {
  return Math.max(1, Math.min(4, os.cpus().length - 2))
}

function ensureAnalysisConfig(settings?: AppSettings): string {
  const configDir = join(appHome, 'katago', 'configs')
  mkdirSync(configDir, { recursive: true })
  const logDir = join(appHome, 'katago', 'logs')
  mkdirSync(logDir, { recursive: true })
  const configPath = join(configDir, 'analysis_builtin.cfg')
  const analysisThreads = saneInteger(settings?.katagoAnalysisThreads, defaultAnalysisThreads(), 1, 16)
  const searchThreadsPerAnalysisThread = saneInteger(settings?.katagoSearchThreadsPerAnalysisThread, 1, 1, 16)
  const maxBatchSize = saneInteger(settings?.katagoMaxBatchSize, 32, 1, 256)
  const cacheSizePowerOfTwo = saneInteger(settings?.katagoCacheSizePowerOfTwo, 20, 16, 28)
  const configContent = [
    `logDir = ${logDir}`,
    'logAllRequests = false',
    'logSearchInfo = false',
    'analysisPVLen = 12',
    'reportAnalysisWinratesAs = SIDETOMOVE',
    `numAnalysisThreads = ${analysisThreads}`,
    `numSearchThreadsPerAnalysisThread = ${searchThreadsPerAnalysisThread}`,
    `nnMaxBatchSize = ${maxBatchSize}`,
    `nnCacheSizePowerOfTwo = ${cacheSizePowerOfTwo}`,
    ''
  ].join('\n')
  const existingContent = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
  if (existingContent !== configContent) {
    writeFileSync(configPath, configContent, 'utf8')
  }
  return configPath
}

export const CUSTOM_KATAGO_MODEL_STATUS = '自定义模型'

export function resolveKataGoRuntime(settings?: AppSettings): KataGoRuntime {
  const modelPreset = getKataGoModelPreset(settings?.katagoModelPreset)
  const notes: string[] = []

  // User-chosen files come first. When one is unusable, analysis falls back to the
  // automatic choice and the note explains why instead of failing outright.
  const customModelPath = settings?.katagoCustomModel?.trim() ?? ''
  const customModel = customModelPath && existsSync(customModelPath) ? customModelPath : ''
  if (customModelPath && !customModel) {
    notes.push(`自定义模型不存在，已改用自动选择的模型: ${customModelPath}`)
  }
  // A user-chosen network may be older than the preset's minimum engine version.
  const minimumVersion = customModel ? '' : modelPreset.minimumEngineVersion

  const customBinPath = settings?.katagoCustomBin?.trim() ?? ''
  let katagoBin = ''
  let engineVersion = ''
  let binaryRejections: string[] = []
  if (customBinPath) {
    const probe = probeKataGoBinary(customBinPath, minimumVersion)
    if (probe.ok) {
      katagoBin = customBinPath
      engineVersion = probe.version
    } else {
      notes.push(`自定义 KataGo 不可用，已改用自动检测的引擎: ${probe.note || `文件不存在: ${customBinPath}`}`)
    }
  }
  if (!katagoBin) {
    katagoBin = firstExistingBinary([...binaryCandidates(), settings?.katagoBin ?? ''], minimumVersion)
    engineVersion = lastBinaryVersion
    binaryRejections = lastBinaryRejectionNotes.slice(0, 3)
  }

  const customConfigPath = settings?.katagoCustomConfig?.trim() ?? ''
  const generatedConfig = ensureAnalysisConfig(settings)
  const katagoConfig = customConfigPath && existsSync(customConfigPath) ? customConfigPath : generatedConfig
  if (customConfigPath && katagoConfig !== customConfigPath) {
    notes.push(`自定义配置不存在，已改用内置分析配置: ${customConfigPath}`)
  }

  const katagoModel = customModel || firstExisting(modelCandidates(modelPreset, settings))

  if (katagoBin) {
    notes.push(`KataGo 引擎: ${basename(katagoBin)}${engineVersion ? ` v${engineVersion}` : ''}${katagoBin === customBinPath ? '（自定义）' : ''}`)
  } else {
    notes.push('未找到内置 KataGo 引擎。')
  }
  notes.push(...binaryRejections)

  const exactPreset = !customModel && katagoModel ? basename(katagoModel) === modelPreset.fileName : false
  if (customModel) {
    notes.push(`模型: ${basename(customModel)}（自定义）`)
  } else if (katagoModel) {
    notes.push(exactPreset ? `模型: ${modelPreset.label}` : `模型: ${basename(katagoModel)}`)
  } else {
    notes.push(`缺少模型文件: ${modelPreset.fileName}`)
  }
  if (katagoConfig === customConfigPath) {
    notes.push(`分析配置: ${basename(katagoConfig)}（自定义）`)
  }

  const ready = Boolean(katagoBin && katagoConfig && katagoModel)
  const modelStatus = customModel ? CUSTOM_KATAGO_MODEL_STATUS : exactPreset ? modelPreset.label : '本机兼容模型'
  return {
    katagoBin,
    katagoConfig,
    katagoModel,
    modelPreset,
    ready,
    status: ready ? `${modelStatus} Ready` : 'KataGo Missing',
    notes
  }
}

export function hydrateKataGoSettings(settings: AppSettings): AppSettings {
  const runtime = resolveKataGoRuntime(settings)
  return {
    ...settings,
    katagoModelPreset: runtime.modelPreset.id,
    katagoBin: runtime.katagoBin,
    katagoConfig: runtime.katagoConfig,
    katagoModel: runtime.katagoModel
  }
}
