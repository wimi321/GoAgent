import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, chmod, copyFile, cp, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Transform, Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { basename, dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { getKataGoModelPreset } from '../katagoRuntime'
import { appHome, legacyElectronUserData } from '@main/lib/store'
import type { KataGoAssetInstallProgress, KataGoAssetInstallRequest, KataGoAssetInstallResult } from '@main/lib/types'

export interface KataGoPlatformAsset {
  binaryPath: string
  sha256?: string
}

export interface KataGoBundledModel {
  presetId?: string
  fileName: string
  sha256?: string
}

export interface KataGoAssetManifest {
  version: number
  defaultModelId: string
  defaultModelFileName: string
  defaultModelDisplayName: string
  modelPath: string
  modelSha256?: string
  supportedPlatforms: Record<string, KataGoPlatformAsset>
  bundledModels?: KataGoBundledModel[]
  notes?: string[]
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

interface KataGoEditionMetadata {
  modelPath?: string
  binaryPath?: string
  flavor?: string
  platform?: string
}

const execFileAsync = promisify(execFile)
const WINDOWS_OPENCL_RUNTIME_URL = 'https://github.com/wimi321/lizzieyzy-next/releases/download/1.0.0-next-2026-05-02.3/2026-05-02-windows64.opencl.portable.zip'
let activeInstallController: AbortController | null = null

class KataGoAssetInstallPausedError extends Error {
  constructor() {
    super('KataGo 资源下载已暂停。再次点击下载即可继续。')
    this.name = 'KataGoAssetInstallPausedError'
  }
}

function platformKey(): string {
  return `${process.platform}-${process.arch}`
}

function editionBinaryPathForPlatform(edition: KataGoEditionMetadata | null, key: string): string {
  if (!edition?.binaryPath) {
    return ''
  }
  return edition.platform === key ? edition.binaryPath : ''
}

function userKatagoRoot(): string {
  return join(appHome, 'katago')
}

function candidateRoots(): string[] {
  const roots: string[] = []
  const userRoot = userKatagoRoot()
  if (userRoot) {
    roots.push(userRoot)
  }
  if (legacyElectronUserData) {
    roots.push(join(legacyElectronUserData, 'katago'))
  }
  if (process.resourcesPath) {
    roots.push(join(process.resourcesPath, 'data', 'katago'))
  }
  roots.push(join(process.cwd(), 'data', 'katago'))
  return [...new Set(roots)]
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function executable(path: string): Promise<boolean> {
  if (process.platform === 'win32') return exists(path)
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

async function sha256(path: string): Promise<string> {
  const bytes = await readFile(path)
  return createHash('sha256').update(bytes).digest('hex')
}

async function readEditionMetadata(root: string): Promise<KataGoEditionMetadata | null> {
  const path = join(root, 'edition.json')
  if (!(await exists(path))) {
    return null
  }
  try {
    return JSON.parse(await readFile(path, 'utf8')) as KataGoEditionMetadata
  } catch {
    return null
  }
}

function absoluteUrl(value: string): string {
  if (value.startsWith('//')) {
    return `https:${value}`
  }
  if (/^https?:\/\//i.test(value)) {
    return value
  }
  return new URL(value, 'https://katagotraining.org').toString()
}

async function discoverModelDownloadUrl(presetId?: string, signal?: AbortSignal): Promise<string> {
  const preset = getKataGoModelPreset(presetId)
  if (preset.downloadUrl) {
    return preset.downloadUrl
  }
  if (/\.bin\.gz($|\?)/i.test(preset.sourceUrl)) {
    return preset.sourceUrl
  }
  const fallback = `https://media.katagotraining.org/uploaded/networks/models/kata1/${preset.fileName}`
  try {
    const response = await fetch(preset.sourceUrl, {
      headers: { 'User-Agent': 'GoAgent KataGo asset installer' },
      signal
    })
    if (!response.ok) {
      return fallback
    }
    const html = await response.text()
    const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => absoluteUrl(match[1]))
    const exact = links.find((link) => link.includes(preset.fileName))
    if (exact) {
      return exact
    }
    const byNetworkName = links.find((link) => link.includes(preset.networkName) && /\.bin\.gz($|\?)/i.test(link))
    return byNetworkName ?? fallback
  } catch {
    return fallback
  }
}

async function firstExisting(paths: string[]): Promise<string> {
  for (const path of paths) {
    if (await exists(path)) {
      return path
    }
  }
  return ''
}

function progressPercent(receivedBytes: number, totalBytes?: number): number | undefined {
  if (!totalBytes || totalBytes <= 0) {
    return undefined
  }
  return Math.max(0, Math.min(100, Math.round((receivedBytes / totalBytes) * 1000) / 10))
}

async function downloadFile(
  url: string,
  target: string,
  onProgress?: (progress: KataGoAssetInstallProgress) => void,
  stage: KataGoAssetInstallProgress['stage'] = 'downloading-model',
  messages: { exists: string; active: string; done: string } = {
    exists: '官方权重已存在，跳过下载。',
    active: '正在下载 KataGo 官方权重。',
    done: '官方权重下载完成。'
  },
  signal?: AbortSignal
): Promise<boolean> {
  const targetExists = await exists(target)
  if (targetExists) {
    onProgress?.({ stage, message: messages.exists, percent: 100 })
    return false
  }
  const tmp = `${target}.download`
  await mkdir(dirname(target), { recursive: true })
  let existingBytes = await stat(tmp).then((value) => value.size).catch(() => 0)
  const request = async (resumeAt: number): Promise<Response> => fetch(url, {
    headers: {
      'User-Agent': 'GoAgent KataGo asset installer',
      ...(resumeAt > 0 ? { Range: `bytes=${resumeAt}-` } : {})
    },
    signal
  })
  let response = await request(existingBytes)
  if (response.status === 416 && existingBytes > 0) {
    await unlink(tmp).catch(() => undefined)
    existingBytes = 0
    response = await request(0)
  }
  if (!response.ok || !response.body) {
    throw new Error(`官方权重下载失败: HTTP ${response.status}`)
  }
  const resumed = existingBytes > 0 && response.status === 206
  const contentRangeTotal = Number(/\/(\d+)$/.exec(response.headers.get('content-range') ?? '')?.[1] ?? 0) || undefined
  const responseBytes = Number(response.headers.get('content-length') ?? 0) || undefined
  const totalBytes = contentRangeTotal ?? (responseBytes ? (resumed ? existingBytes + responseBytes : responseBytes) : undefined)
  let receivedBytes = resumed ? existingBytes : 0
  onProgress?.({
    stage,
    message: resumed ? `${messages.active} 已从 ${Math.round(existingBytes / 1024 / 1024)} MB 处继续。` : messages.active,
    receivedBytes,
    totalBytes,
    percent: progressPercent(receivedBytes, totalBytes)
  })
  const progressStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      receivedBytes += chunk.length
      onProgress?.({
        stage,
        message: messages.active,
        receivedBytes,
        totalBytes,
        percent: progressPercent(receivedBytes, totalBytes)
      })
      callback(null, chunk)
    }
  })
  try {
    await pipeline(
      Readable.fromWeb(response.body as never),
      progressStream,
      createWriteStream(tmp, { flags: resumed ? 'a' : 'w' }),
      { signal }
    )
  } catch (error) {
    if (signal?.aborted) {
      throw new KataGoAssetInstallPausedError()
    }
    throw error
  }
  await rename(tmp, target)
  onProgress?.({ stage, message: messages.done, receivedBytes, totalBytes, percent: 100 })
  return true
}

async function runPowerShell(command: string): Promise<void> {
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true, maxBuffer: 1024 * 1024 })
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

async function findFileByName(root: string, fileName: string): Promise<string> {
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    for (const entry of await readdir(current, { withFileTypes: true }).catch(() => [])) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
        return full
      }
    }
  }
  return ''
}

async function downloadPlatformRuntimeIfAvailable(
  root: string,
  manifest: KataGoAssetManifest,
  key: string,
  onProgress?: (progress: KataGoAssetInstallProgress) => void,
  signal?: AbortSignal
): Promise<{ path: string; copied: boolean }> {
  const platform = manifest.supportedPlatforms[key]
  if (!platform) {
    return { path: '', copied: false }
  }

  const target = join(root, platform.binaryPath)
  if (await exists(target)) {
    return { path: target, copied: false }
  }
  if (key !== 'win32-x64') {
    return { path: target, copied: false }
  }

  const archivePath = join(root, 'downloads', 'katago-win32-x64-opencl.zip')
  await downloadFile(WINDOWS_OPENCL_RUNTIME_URL, archivePath, onProgress, 'downloading-binary', {
    exists: 'KataGo Windows OpenCL 运行库已下载，跳过下载。',
    active: '正在下载 KataGo Windows OpenCL 运行库。',
    done: 'KataGo Windows OpenCL 运行库下载完成。'
  }, signal)

  const extractionDir = join(root, 'runtime-downloads', 'win32-x64-opencl')
  await rm(extractionDir, { recursive: true, force: true })
  await mkdir(extractionDir, { recursive: true })
  onProgress?.({ stage: 'copying-binary', message: '正在解压 KataGo Windows OpenCL 运行库。' })
  await runPowerShell(`Expand-Archive -LiteralPath ${psQuote(archivePath)} -DestinationPath ${psQuote(extractionDir)} -Force`)

  const sourceBinary = await findFileByName(extractionDir, 'katago.exe')
  if (!sourceBinary) {
    throw new Error('KataGo Windows OpenCL 运行库下载完成，但没有找到 katago.exe。')
  }
  const sourceDir = dirname(sourceBinary)
  const targetDir = dirname(target)
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(dirname(targetDir), { recursive: true })
  await cp(sourceDir, targetDir, { recursive: true, force: true })
  onProgress?.({ stage: 'copying-binary', message: 'KataGo Windows OpenCL 引擎已安装。', percent: 100 })
  return { path: target, copied: true }
}

async function copyPlatformBinaryIfAvailable(
  root: string,
  manifest: KataGoAssetManifest,
  key: string,
  onProgress?: (progress: KataGoAssetInstallProgress) => void,
  signal?: AbortSignal
): Promise<{ path: string; copied: boolean }> {
  const platform = manifest.supportedPlatforms[key]
  if (!platform) {
    return { path: '', copied: false }
  }
  const target = join(root, platform.binaryPath)
  if (await exists(target)) {
    if (process.platform !== 'win32') {
      await chmod(target, 0o755).catch(() => undefined)
    }
    return { path: target, copied: false }
  }
  const source = await firstExisting(candidateRoots()
    .filter((candidateRoot) => candidateRoot !== root)
    .map((candidateRoot) => join(candidateRoot, platform.binaryPath)))
  if (!source) {
    return downloadPlatformRuntimeIfAvailable(root, manifest, key, onProgress, signal)
  }
  await mkdir(dirname(target), { recursive: true })
  await copyFile(source, target)
  if (process.platform !== 'win32') {
    await chmod(target, 0o755).catch(() => undefined)
  }
  return { path: target, copied: true }
}

export async function readKataGoAssetManifest(): Promise<{ manifest: KataGoAssetManifest | null; root: string }> {
  for (const root of candidateRoots()) {
    const manifestPath = join(root, 'manifest.json')
    if (await exists(manifestPath)) {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as KataGoAssetManifest
      return { manifest, root }
    }
  }
  return { manifest: null, root: candidateRoots()[0] }
}

export async function inspectKataGoAssets(): Promise<KataGoAssetStatus> {
  const key = platformKey()
  const { manifest, root } = await readKataGoAssetManifest()
  if (!manifest) {
    return {
      platformKey: key,
      manifestFound: false,
      binaryPath: '',
      binaryFound: false,
      binaryExecutable: false,
      modelPath: '',
      modelFound: false,
      modelDisplayName: '',
      ready: false,
      detail: '未找到 data/katago/manifest.json。'
    }
  }

  const platform = manifest.supportedPlatforms[key]
  if (!platform) {
    return {
      platformKey: key,
      manifestFound: true,
      binaryPath: '',
      binaryFound: false,
      binaryExecutable: false,
      modelPath: join(root, manifest.modelPath),
      modelFound: await exists(join(root, manifest.modelPath)),
      modelDisplayName: manifest.defaultModelDisplayName,
      ready: false,
      detail: `当前平台 ${key} 不在 manifest 支持列表中。`
    }
  }

  const edition = await readEditionMetadata(root)
  const editionBinaryPath = editionBinaryPathForPlatform(edition, key)
  const displayBinaryPath = editionBinaryPath || platform.binaryPath
  const binaryPath = join(root, displayBinaryPath)
  const manifestModelPath = join(root, manifest.modelPath)
  const editionModelPath = edition?.modelPath ? join(root, edition.modelPath) : ''
  const editionModelFound = editionModelPath ? await exists(editionModelPath) : false
  const modelPath = editionModelFound ? editionModelPath : manifestModelPath
  const binaryFound = await exists(binaryPath)
  const binaryExecutable = binaryFound ? await executable(binaryPath) : false
  const modelFound = await exists(modelPath)
  let checksumDetail = ''

  try {
    if (binaryFound && platform.sha256) {
      const actual = await sha256(binaryPath)
      if (actual !== platform.sha256) checksumDetail += `KataGo checksum 不匹配；`
    }
    if (modelFound && manifest.modelSha256) {
      const actual = await sha256(modelPath)
      if (actual !== manifest.modelSha256) checksumDetail += `模型 checksum 不匹配；`
    }
  } catch (error) {
    checksumDetail += `checksum 校验失败: ${String(error)}；`
  }

  const ready = binaryFound && binaryExecutable && modelFound && !checksumDetail
  const detail = ready
    ? `已找到 ${basename(binaryPath)} 和 ${edition?.flavor === 'nvidia' ? 'NVIDIA bundled model' : manifest.defaultModelDisplayName}。`
    : [
        binaryFound ? '' : `缺少引擎: ${displayBinaryPath}`,
        binaryFound && !binaryExecutable ? `引擎不可执行: ${displayBinaryPath}` : '',
        modelFound ? '' : `缺少模型: ${edition?.modelPath || manifest.modelPath}`,
        checksumDetail
      ].filter(Boolean).join('；')

  return {
    platformKey: key,
    manifestFound: true,
    binaryPath,
    binaryFound,
    binaryExecutable,
    modelPath,
    modelFound,
    modelDisplayName: edition?.flavor === 'nvidia' ? 'KataGo NVIDIA bundled model' : manifest.defaultModelDisplayName,
    ready,
    detail
  }
}

async function findBundledModelPath(preset: { id: string; fileName: string; networkName: string }): Promise<string> {
  for (const root of candidateRoots()) {
    const direct = join(root, 'models', preset.fileName)
    if (await exists(direct)) {
      return direct
    }
  }
  return ''
}

async function installOfficialKataGoModelInternal(
  request: KataGoAssetInstallRequest = {},
  onProgress?: (progress: KataGoAssetInstallProgress) => void,
  signal?: AbortSignal
): Promise<KataGoAssetInstallResult> {
  const key = platformKey()
  const userRoot = userKatagoRoot()
  if (!userRoot) {
    throw new Error('应用用户目录尚不可用，无法安装 KataGo 官方权重。')
  }
  const preset = getKataGoModelPreset(request.presetId)
  const { manifest: baseManifest } = await readKataGoAssetManifest()
  if (!baseManifest) {
    throw new Error('缺少 data/katago/manifest.json，无法创建本机资源配置。')
  }

  // If this preset is already bundled with the app or previously installed into the app home, reuse it.
  const bundledMatch = await findBundledModelPath(preset)
  if (bundledMatch) {
    onProgress?.({ stage: 'discovering', message: `${preset.label} 已随安装包提供，无需下载。`, percent: 100 })
    const manifest: KataGoAssetManifest = {
      ...baseManifest,
      defaultModelId: preset.id,
      defaultModelFileName: preset.fileName,
      defaultModelDisplayName: `KataGo ${preset.label}`,
      modelPath: `models/${preset.fileName}`,
      modelSha256: await sha256(bundledMatch).catch(() => '')
    }
    const binary = await copyPlatformBinaryIfAvailable(userRoot, manifest, key, onProgress, signal)
    onProgress?.({ stage: 'writing-manifest', message: '正在写入本机 KataGo 资源配置。' })
    await mkdir(userRoot, { recursive: true })
    await writeFile(join(userRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    const finalStatus = await inspectKataGoAssets()
    const detail = finalStatus.ready
      ? `${preset.label} 已就绪（来自内置权重），可用于胜率图和实时分析。`
      : `权重已就绪；${finalStatus.detail || '仍需准备当前平台 KataGo 引擎。'}`
    onProgress?.({ stage: finalStatus.ready ? 'done' : 'error', message: detail, percent: 100 })
    return {
      ok: finalStatus.ready,
      presetId: preset.id,
      modelPath: bundledMatch,
      binaryPath: binary.path,
      downloadedModel: false,
      copiedBinary: binary.copied,
      detail
    }
  }

  onProgress?.({ stage: 'discovering', message: `准备安装 ${preset.label}。` })
  const downloadUrl = await discoverModelDownloadUrl(preset.id, signal)
  const modelPath = join(userRoot, 'models', preset.fileName)
  const downloadedModel = await downloadFile(downloadUrl, modelPath, onProgress, 'downloading-model', undefined, signal)

  onProgress?.({ stage: 'copying-binary', message: '正在检查当前平台 KataGo 引擎。' })
  const manifest: KataGoAssetManifest = {
    ...baseManifest,
    defaultModelId: preset.id,
    defaultModelFileName: preset.fileName,
    defaultModelDisplayName: `KataGo ${preset.label}`,
    modelPath: `models/${preset.fileName}`,
    modelSha256: await sha256(modelPath).catch(() => '')
  }
  const binary = await copyPlatformBinaryIfAvailable(userRoot, manifest, key, onProgress, signal)
  onProgress?.({ stage: 'writing-manifest', message: '正在写入本机 KataGo 资源配置。' })
  await mkdir(userRoot, { recursive: true })
  await writeFile(join(userRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const finalStatus = await inspectKataGoAssets()
  const detail = finalStatus.ready
    ? `${preset.label} 已安装，可用于胜率图和实时分析。`
    : `权重已安装；${finalStatus.detail || '仍需准备当前平台 KataGo 引擎。'}`
  onProgress?.({ stage: finalStatus.ready ? 'done' : 'error', message: detail, percent: finalStatus.modelFound ? 100 : undefined })
  return {
    ok: finalStatus.ready,
    presetId: preset.id,
    modelPath,
    binaryPath: binary.path,
    downloadedModel,
    copiedBinary: binary.copied,
    detail
  }
}

export function cancelKataGoAssetInstall(): boolean {
  if (!activeInstallController || activeInstallController.signal.aborted) {
    return false
  }
  activeInstallController.abort()
  return true
}

export async function installOfficialKataGoModel(
  request: KataGoAssetInstallRequest = {},
  onProgress?: (progress: KataGoAssetInstallProgress) => void
): Promise<KataGoAssetInstallResult> {
  if (activeInstallController && !activeInstallController.signal.aborted) {
    throw new Error('已有 KataGo 资源下载正在进行。')
  }
  const controller = new AbortController()
  activeInstallController = controller
  try {
    return await installOfficialKataGoModelInternal(request, onProgress, controller.signal)
  } catch (error) {
    if (controller.signal.aborted || error instanceof KataGoAssetInstallPausedError) {
      const paused = new KataGoAssetInstallPausedError()
      onProgress?.({ stage: 'paused', message: paused.message })
      throw paused
    }
    throw error
  } finally {
    if (activeInstallController === controller) {
      activeInstallController = null
    }
  }
}
