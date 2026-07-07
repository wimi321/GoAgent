import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ReleaseReadinessFlags, ReleaseReadinessItem, ReleaseReadinessResult, ReleaseReadinessStatus } from '../../lib/types'
import { inspectPackagedRuntime } from './packageRuntime'

type KataGoManifest = {
  modelPath?: unknown
  supportedPlatforms?: Record<string, { binaryPath?: unknown }>
}

type KataGoEdition = {
  binaryPath?: unknown
  modelPath?: unknown
  platform?: unknown
}

function item(id: string, label: string, status: ReleaseReadinessStatus, detail?: string): ReleaseReadinessItem {
  return { id, label, status, detail }
}

function aggregate(items: ReleaseReadinessItem[]): ReleaseReadinessStatus {
  if (items.some((entry) => entry.status === 'fail')) return 'fail'
  if (items.some((entry) => entry.status === 'warn')) return 'warn'
  if (items.some((entry) => entry.status === 'unknown')) return 'unknown'
  return 'pass'
}

function hasFile(root: string, relativePath: string): boolean {
  return Boolean(root && existsSync(join(root, relativePath)))
}

function hasAnyFile(root: string, relativePaths: string[]): boolean {
  return relativePaths.some((relativePath) => hasFile(root, relativePath))
}

function hasModelFile(katagoRoot: string): boolean {
  const modelDir = join(katagoRoot, 'models')
  if (!existsSync(modelDir)) return false
  try {
    return readdirSync(modelDir).some((name) => name.toLowerCase().endsWith('.bin.gz'))
  } catch {
    return false
  }
}

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return null
  }
}

function currentPlatformKey(): string {
  return `${process.platform}-${process.arch}`
}

function stringValue(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : ''
}

function katagoRuntimePaths(katagoRoot: string): { binaryPath: string; modelPath: string } {
  const key = currentPlatformKey()
  const manifest = readJsonFile<KataGoManifest>(join(katagoRoot, 'manifest.json'))
  const edition = readJsonFile<KataGoEdition>(join(katagoRoot, 'edition.json'))
  const editionBinaryPath = edition?.platform === key ? stringValue(edition.binaryPath) : ''
  const manifestBinaryPath = stringValue(manifest?.supportedPlatforms?.[key]?.binaryPath)
  const editionModelPath = stringValue(edition?.modelPath)
  const manifestModelPath = stringValue(manifest?.modelPath)
  return {
    binaryPath: editionBinaryPath || manifestBinaryPath,
    modelPath: editionModelPath || manifestModelPath
  }
}

function hasKataGoBinary(katagoRoot: string): boolean {
  const { binaryPath } = katagoRuntimePaths(katagoRoot)
  if (binaryPath) return hasFile(katagoRoot, binaryPath)
  return hasAnyFile(katagoRoot, [
    'bin/win32-x64/katago.exe',
    'bin/darwin-arm64/katago',
    'bin/darwin-x64/katago'
  ])
}

function hasKataGoModel(katagoRoot: string): boolean {
  const { modelPath } = katagoRuntimePaths(katagoRoot)
  return Boolean(modelPath && hasFile(katagoRoot, modelPath)) || hasModelFile(katagoRoot)
}

function hasEvidence(projectRoot: string, envName: string, fileName: string): boolean {
  return process.env[envName] === '1' || existsSync(join(projectRoot, 'release-evidence', fileName))
}

function sourceReadiness(projectRoot: string): ReleaseReadinessResult {
  const runtime = inspectPackagedRuntime(projectRoot)
  const requiredFiles = [
    'package.json',
    'data/knowledge/p0-cards.json',
    'data/katago/manifest.json',
    'scripts/check_katago_assets.mjs',
    'scripts/p0_beta_acceptance.mjs',
    'scripts/package_artifact_smoke.mjs',
    'scripts/smoke_windows_packaged_app.mjs',
    'src/main/services/diagnostics/index.ts',
    'src/main/services/llm/openaiCompatibleProvider.ts',
    'src/main/services/studentProfile.ts',
    'src/main/services/teacherAgent.ts',
    'src/renderer/src/features/board/GoBoardV2.tsx',
    'src/renderer/src/features/teacher/TeacherRunCardPro.tsx'
  ]

  const items: ReleaseReadinessItem[] = requiredFiles.map((relativePath) =>
    hasFile(projectRoot, relativePath)
      ? item(relativePath, relativePath, 'pass')
      : item(relativePath, relativePath, 'fail', '缺少发布必备文件')
  )
  const automationReady = items.every((entry) => entry.status === 'pass')

  const katagoBinaryCandidates = [
    'data/katago/bin/darwin-arm64/katago',
    'data/katago/bin/darwin-x64/katago',
    'data/katago/bin/win32-x64/katago.exe'
  ]
  const presentBinaryCount = katagoBinaryCandidates.filter((relativePath) => hasFile(projectRoot, relativePath)).length
  const allBinariesReady = presentBinaryCount === katagoBinaryCandidates.length
  items.push(
    allBinariesReady
      ? item('katago-binaries', 'KataGo 平台二进制', 'pass', `检测到 ${presentBinaryCount}/${katagoBinaryCandidates.length} 个候选二进制`)
      : item('katago-binaries', 'KataGo 平台二进制', 'warn', '源码仓库可不提交二进制，但 release job 必须通过 prepare assets 脚本注入')
  )

  const hasModel = hasModelFile(join(projectRoot, 'data', 'katago'))
  items.push(
    hasModel
      ? item('katago-model', 'KataGo 默认模型', 'pass')
      : item('katago-model', 'KataGo 默认模型', 'warn', '源码仓库可不提交模型，但完整 release job 必须准备默认模型')
  )

  const version = runtime.version
  const releaseRoot = join(projectRoot, 'release', version)
  const installerCandidates = [
    `GoAgent-${version}-mac-arm64.dmg`,
    `GoAgent-${version}-mac-x64.dmg`,
    `GoAgent-${version}-mac-arm64-lite.dmg`,
    `GoAgent-${version}-mac-x64-lite.dmg`,
    `GoAgent-${version}-win-x64.exe`,
    `GoAgent-${version}-win-x64-portable.zip`,
    `GoAgent-${version}-win-x64-lite.exe`,
    `GoAgent-${version}-win-x64-lite-portable.zip`,
    `GoAgent-${version}-win-x64-nvidia.exe`
  ]
  const missingInstallers = installerCandidates.filter((name) => !existsSync(join(releaseRoot, name)))
  const hasNvidiaPortable = existsSync(join(releaseRoot, `GoAgent-${version}-win-x64-nvidia-portable.7z.001`))
  const winArm64Installer = existsSync(join(releaseRoot, `GoAgent-${version}-win-arm64.exe`))
  const installersReady = missingInstallers.length === 0 && hasNvidiaPortable && !winArm64Installer
  items.push(
    installersReady
      ? item('installers-ready', '多平台安装包', 'pass', `release/${version} 已包含 macOS、Windows、Lite、NVIDIA 产物`)
      : item(
          'installers-ready',
          '多平台安装包',
          'warn',
          [
            missingInstallers.length > 0 ? `缺少: ${missingInstallers.join(', ')}` : '',
            hasNvidiaPortable ? '' : `缺少: GoAgent-${version}-win-x64-nvidia-portable.7z.001`,
            winArm64Installer ? '检测到不支持的 Windows ARM64 产物' : ''
          ].filter(Boolean).join('；')
        )
  )

  const signingReady = hasEvidence(projectRoot, 'GOAGENT_SIGNING_READY', 'signing-ready.json')
  const windowsSmokeReady = hasEvidence(projectRoot, 'GOAGENT_WINDOWS_SMOKE_READY', 'windows-smoke-ready.json')
  const visualQaReady = hasEvidence(projectRoot, 'GOAGENT_VISUAL_QA_READY', 'visual-qa-ready.json')
  pushManualEvidence(items, signingReady, windowsSmokeReady, visualQaReady)

  return buildResult(items, {
    automationReady,
    assetsReady: allBinariesReady && hasModel,
    installersReady,
    signingReady,
    windowsSmokeReady,
    visualQaReady,
    publicBetaReady: false
  })
}

function packagedReadiness(projectRoot: string): ReleaseReadinessResult {
  const runtime = inspectPackagedRuntime(projectRoot)
  const appRoot = runtime.appRoot
  const resourcesRoot = runtime.resourcesRoot
  const katagoRoot = runtime.katagoRoot
  const items: ReleaseReadinessItem[] = []

  const runtimeFiles = [
    ['packaged-main', '主进程代码', ['out/main/index.js']],
    ['packaged-preload', 'Preload 桥接', ['out/preload/index.mjs']],
    ['packaged-renderer', '渲染页面', ['out/renderer/index.html']],
    ['packaged-knowledge', '内置围棋知识库', ['data/knowledge/p0-cards.json']]
  ] as const
  for (const [id, label, paths] of runtimeFiles) {
    items.push(
      hasAnyFile(appRoot, [...paths])
        ? item(id, label, 'pass')
        : item(id, label, 'fail', `打包应用缺少 ${paths.join(' 或 ')}`)
    )
  }

  items.push(
    hasFile(resourcesRoot, 'app.asar')
      ? item('app-asar', 'app.asar', 'pass', basename(join(resourcesRoot, 'app.asar')))
      : item('app-asar', 'app.asar', 'fail', '打包应用缺少 resources/app.asar')
  )

  const manifestReady = hasFile(katagoRoot, 'manifest.json')
  items.push(
    manifestReady
      ? item('katago-manifest', 'KataGo manifest', 'pass')
      : item('katago-manifest', 'KataGo manifest', 'fail', '缺少 resources/data/katago/manifest.json')
  )

  const binaryReady = hasKataGoBinary(katagoRoot)
  const modelReady = hasKataGoModel(katagoRoot)
  const lite = runtime.flavor === 'lite'

  if (lite) {
    items.push(item('katago-runtime', 'KataGo 运行时', 'warn', 'Lite 安装包不内置 KataGo；用户需要在设置中安装或配置本机/远程引擎'))
    items.push(item('katago-model', 'KataGo 默认模型', 'warn', 'Lite 安装包不内置默认模型；设置页会提供安装入口'))
  } else {
    items.push(
      binaryReady
        ? item('katago-runtime', 'KataGo 运行时', 'pass', runtime.flavor === 'nvidia' ? 'NVIDIA runtime detected' : 'bundled runtime detected')
        : item('katago-runtime', 'KataGo 运行时', 'fail', '完整安装包必须内置当前平台 KataGo runtime')
    )
    items.push(
      modelReady
        ? item('katago-model', 'KataGo 默认模型', 'pass')
        : item('katago-model', 'KataGo 默认模型', 'fail', '完整安装包必须内置默认模型')
    )
  }

  const ttsReady = existsSync(join(resourcesRoot, 'data', 'tts')) || existsSync(join(appRoot, 'data', 'tts'))
  items.push(
    ttsReady
      ? item('tts-assets', '离线语音资源', 'pass')
      : item('tts-assets', '离线语音资源', 'warn', '未找到离线语音资源；云 TTS 仍可配置使用')
  )

  const automationReady = items.every((entry) => entry.status !== 'fail')
  const assetsReady = lite ? manifestReady : manifestReady && binaryReady && modelReady
  const flags: ReleaseReadinessFlags = {
    automationReady,
    assetsReady,
    installersReady: true,
    signingReady: true,
    windowsSmokeReady: true,
    visualQaReady: true,
    publicBetaReady: false
  }
  flags.publicBetaReady = automationReady && assetsReady
  items.unshift(
    flags.publicBetaReady
      ? item('runtime-ready', '当前安装包运行状态', 'pass', `${runtime.version} ${runtime.flavor} runtime ready`)
      : item('runtime-ready', '当前安装包运行状态', lite ? 'warn' : 'fail', `${runtime.version} ${runtime.flavor} runtime needs attention`)
  )
  return {
    status: aggregate(items),
    items,
    flags
  }
}

function pushManualEvidence(items: ReleaseReadinessItem[], signingReady: boolean, windowsSmokeReady: boolean, visualQaReady: boolean): void {
  items.push(
    signingReady
      ? item('signing-ready', '签名与公证', 'pass', '已检测到签名验收证据')
      : item('signing-ready', '签名与公证', 'warn', '发正式 release 前应确认 macOS 签名/公证与 Windows 签名证据')
  )
  items.push(
    windowsSmokeReady
      ? item('windows-smoke-ready', 'Windows 真机 smoke', 'pass', '已检测到 Windows 真机验收证据')
      : item('windows-smoke-ready', 'Windows 真机 smoke', 'warn', '发正式 release 前应完成 Windows 11 x64 下载、解压/安装、启动 smoke')
  )
  items.push(
    visualQaReady
      ? item('visual-qa-ready', '视觉 QA 证据', 'pass', '已检测到视觉 QA 证据')
      : item('visual-qa-ready', '视觉 QA 证据', 'warn', '发正式 release 前应完成关键页面视觉 QA')
  )
}

function buildResult(items: ReleaseReadinessItem[], flags: ReleaseReadinessFlags): ReleaseReadinessResult {
  flags.publicBetaReady = Object.entries(flags)
    .filter(([key]) => key !== 'publicBetaReady')
    .every(([, ready]) => ready)
  items.unshift(
    flags.publicBetaReady
      ? item('public-beta-ready', 'Public Beta 发布状态', 'pass', '所有自动化与人工 gate 均已通过')
      : item('public-beta-ready', 'Public Beta 发布状态', 'warn', '发布前仍有建议补齐的 release gate')
  )
  return {
    status: aggregate(items),
    items,
    flags
  }
}

export function inspectReleaseReadiness(projectRoot = process.cwd()): ReleaseReadinessResult {
  return inspectPackagedRuntime(projectRoot).packaged
    ? packagedReadiness(projectRoot)
    : sourceReadiness(projectRoot)
}
