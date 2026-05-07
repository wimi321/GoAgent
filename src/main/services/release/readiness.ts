import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ReleaseReadinessFlags, ReleaseReadinessItem, ReleaseReadinessResult, ReleaseReadinessStatus } from '../../lib/types'

function item(id: string, label: string, status: ReleaseReadinessStatus, detail?: string): ReleaseReadinessItem {
  return { id, label, status, detail }
}

function aggregate(items: ReleaseReadinessItem[]): ReleaseReadinessStatus {
  if (items.some((entry) => entry.status === 'fail')) return 'fail'
  if (items.some((entry) => entry.status === 'warn')) return 'warn'
  if (items.some((entry) => entry.status === 'unknown')) return 'unknown'
  return 'pass'
}

export function inspectReleaseReadiness(projectRoot = process.cwd()): ReleaseReadinessResult {
  const requiredFiles = [
    'package.json',
    'data/knowledge/p0-cards.json',
    'data/katago/manifest.json',
    'scripts/check_katago_assets.mjs',
    'scripts/p0_beta_acceptance.mjs',
    'src/main/services/diagnostics/index.ts',
    'src/main/services/llm/openaiCompatibleProvider.ts',
    'src/main/services/studentProfile.ts',
    'src/main/services/teacherAgent.ts',
    'src/renderer/src/features/board/GoBoardV2.tsx',
    'src/renderer/src/features/teacher/TeacherRunCardPro.tsx'
  ]

  const items: ReleaseReadinessItem[] = requiredFiles.map((relativePath) => {
    const fullPath = join(projectRoot, relativePath)
    return existsSync(fullPath)
      ? item(relativePath, relativePath, 'pass')
      : item(relativePath, relativePath, 'fail', '缺少 P0 必备文件')
  })
  const automationReady = items.every((entry) => entry.status === 'pass')

  const katagoBinaryCandidates = [
    'data/katago/bin/darwin-arm64/katago',
    'data/katago/bin/darwin-x64/katago',
    'data/katago/bin/win32-x64/katago.exe'
  ]
  const presentBinaryCount = katagoBinaryCandidates.filter((relativePath) => existsSync(join(projectRoot, relativePath))).length
  const allBinariesReady = presentBinaryCount === katagoBinaryCandidates.length
  items.push(
    allBinariesReady
      ? item('katago-binaries', 'KataGo 平台二进制', 'pass', `检测到 ${presentBinaryCount}/${katagoBinaryCandidates.length} 个候选二进制`)
      : item('katago-binaries', 'KataGo 平台二进制', 'warn', '源码仓库可不提交二进制，但 release 前必须通过 prepare assets 脚本准备')
  )

  const modelCandidates = [
    'data/katago/models/default.bin.gz',
    'data/katago/models/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz'
  ]
  const hasModel = modelCandidates.some((relativePath) => existsSync(join(projectRoot, relativePath)))
  items.push(
    hasModel
      ? item('katago-model', 'KataGo 默认模型', 'pass')
      : item('katago-model', 'KataGo 默认模型', 'warn', '源码仓库可不提交模型，但 release 前必须准备默认模型')
  )

  const assetsReady = allBinariesReady && hasModel
  const version = '0.2.0-beta.1'
  const releaseRoot = join(projectRoot, 'release', version)
  const installerCandidates = [
    `release/${version}/GoAgent-${version}-mac-arm64.dmg`,
    `release/${version}/GoAgent-${version}-mac-x64.dmg`,
    `release/${version}/GoAgent-${version}-win-x64.exe`
  ]
  const missingInstallers = installerCandidates.filter((relativePath) => !existsSync(join(projectRoot, relativePath)))
  const winArm64Installer = existsSync(join(releaseRoot, `GoAgent-${version}-win-arm64.exe`))
  const installersReady = missingInstallers.length === 0 && !winArm64Installer
  items.push(
    installersReady
      ? item('installers-ready', 'P0 beta 安装包', 'pass', 'macOS arm64/x64 与 Windows x64 安装包已存在')
      : item(
          'installers-ready',
          'P0 beta 安装包',
          'fail',
          [
            missingInstallers.length > 0 ? `缺少: ${missingInstallers.join(', ')}` : '',
            winArm64Installer ? '检测到不支持的 Windows ARM64 产物' : ''
          ].filter(Boolean).join('；')
        )
  )

  const signingReady =
    process.env.GOAGENT_SIGNING_READY === '1' ||
    existsSync(join(projectRoot, 'release-evidence', 'signing-ready.json'))
  const windowsSmokeReady =
    process.env.GOAGENT_WINDOWS_SMOKE_READY === '1' ||
    existsSync(join(projectRoot, 'release-evidence', 'windows-smoke-ready.json'))
  const visualQaReady =
    process.env.GOAGENT_VISUAL_QA_READY === '1' ||
    existsSync(join(projectRoot, 'release-evidence', 'visual-qa-ready.json'))

  items.push(
    signingReady
      ? item('signing-ready', '签名与公证', 'pass', '已检测到签名验收证据')
      : item('signing-ready', '签名与公证', 'fail', '公开 beta 前需要 macOS 签名/公证与 Windows 签名证据')
  )
  items.push(
    windowsSmokeReady
      ? item('windows-smoke-ready', 'Windows 真机 smoke', 'pass', '已检测到 Windows 真机验收证据')
      : item('windows-smoke-ready', 'Windows 真机 smoke', 'fail', '公开 beta/tag 前必须完成 Windows 11 x64 真机 smoke')
  )
  items.push(
    visualQaReady
      ? item('visual-qa-ready', '视觉 QA 证据', 'pass', '已检测到视觉 QA 证据')
      : item('visual-qa-ready', '视觉 QA 证据', 'fail', '公开 beta 前必须完成截图验收')
  )

  const flags: ReleaseReadinessFlags = {
    automationReady,
    assetsReady,
    installersReady,
    signingReady,
    windowsSmokeReady,
    visualQaReady,
    publicBetaReady: false
  }
  flags.publicBetaReady = Object.entries(flags)
    .filter(([key]) => key !== 'publicBetaReady')
    .every(([, ready]) => ready)

  items.unshift(
    flags.publicBetaReady
      ? item('public-beta-ready', 'Public Beta 发布状态', 'pass', '所有自动化与人工 gate 均已通过')
      : item(
          'public-beta-ready',
          'Public Beta 发布状态',
          'fail',
          'publicBetaReady=false：签名/公证、Windows 真机 smoke、视觉 QA 任一缺失都不能 tag'
        )
  )

  return {
    status: aggregate(items),
    items,
    flags
  }
}
