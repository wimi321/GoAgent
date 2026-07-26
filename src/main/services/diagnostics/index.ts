import { constants } from 'node:fs'
import { access, mkdir, unlink, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { appHome, getSettings, hasLlmApiKey } from '@main/lib/store'
import { resolveKataGoRuntime } from '../katagoRuntime'
import { ikatagoClientConfigured, shouldPreferIKataGoEngine } from '../ikatagoClientEngine'
import { shouldPreferZhiziGtpEngine, zhiziGtpConfigured } from '../zhiziGtpEngine'
import { inspectKataGoAssets } from '../katago/katagoAssets'
import { isLitePackagedRuntime } from '../release/packageRuntime'
import type { DiagnosticCheck, DiagnosticsReport, DiagnosticsOverall } from './types'

function isReleaseRuntime(): boolean {
  return !process.env.ELECTRON_RENDERER_URL
}

async function checkWritableHome(): Promise<DiagnosticCheck> {
  try {
    await mkdir(appHome, { recursive: true })
    const probePath = join(appHome, '.goagent-write-test')
    await writeFile(probePath, 'ok', 'utf8')
    await unlink(probePath)
    return {
      id: 'app-home-writable',
      title: '用户数据目录',
      status: 'pass',
      required: true,
      detail: `可写: ${appHome}`
    }
  } catch (error) {
    return {
      id: 'app-home-writable',
      title: '用户数据目录',
      status: 'fail',
      required: true,
      detail: '应用无法写入用户数据目录，棋谱、画像和报告无法保存。',
      action: '请检查目录权限，或把应用安装到有权限的位置。',
      technicalDetail: String(error)
    }
  }
}

async function checkKatagoBinary(): Promise<DiagnosticCheck> {
  const settings = getSettings()
  const runtime = resolveKataGoRuntime(settings)
  if (settings.katagoEngineMode === 'zhizi' && !zhiziGtpConfigured(settings)) {
    return {
      id: 'katago-binary',
      title: 'KataGo 引擎',
      status: 'fail',
      required: true,
      detail: '已选择智子云远程算力，但还没有登录智子云。',
      action: '在设置的“智子云远程算力”中输入账号密码登录，或把引擎模式改回自动。'
    }
  }
  if (shouldPreferZhiziGtpEngine(settings, runtime.ready) && zhiziGtpConfigured(settings)) {
    return {
      id: 'katago-binary',
      title: 'KataGo 引擎',
      status: 'pass',
      required: false,
      detail: '使用智子云远程算力：GoAgent 直连 Socket.IO'
    }
  }
  if (shouldPreferIKataGoEngine(settings, runtime.ready) && ikatagoClientConfigured(settings)) {
    return {
      id: 'katago-binary',
      title: 'KataGo 引擎',
      status: 'pass',
      required: false,
      detail: `使用 iKataGo 远程算力: ${basename(settings.ikatagoClientBin)}`
    }
  }
  const liteRuntime = isLitePackagedRuntime()
  const required = isReleaseRuntime() && !liteRuntime
  if (!runtime.katagoBin) {
    return {
      id: 'katago-binary',
      title: 'KataGo 引擎',
      status: required ? 'fail' : 'warn',
      required,
      detail: liteRuntime ? 'Lite 安装包不内置 KataGo 引擎。' : '未找到内置或本机 KataGo 引擎。',
      action: required
        ? '请确认安装包包含 data/katago/bin/<platform>-<arch>/katago。'
        : liteRuntime
          ? '可在设置中安装官方 KataGo 模型/运行时，或配置本机 KataGo、智子云远程算力。'
          : '开发环境可稍后运行 scripts/prepare_katago_assets.mjs 或使用系统 KataGo。'
    }
  }
  try {
    await access(runtime.katagoBin, constants.X_OK)
  } catch (error) {
    // Windows does not use POSIX executable bits; existence is enough there.
    if (process.platform !== 'win32') {
      return {
        id: 'katago-binary',
        title: 'KataGo 引擎',
        status: required ? 'fail' : 'warn',
        required,
        detail: `找到 ${basename(runtime.katagoBin)}，但没有执行权限。`,
        action: 'macOS/Linux 下请确保内置 katago 文件有可执行权限。',
        technicalDetail: String(error)
      }
    }
  }
  return {
    id: 'katago-binary',
    title: 'KataGo 引擎',
    status: 'pass',
    required,
    detail: `已找到: ${basename(runtime.katagoBin)}`
  }
}

async function checkKatagoModel(): Promise<DiagnosticCheck> {
  const settings = getSettings()
  const runtime = resolveKataGoRuntime(settings)
  if (settings.katagoEngineMode === 'zhizi' && !zhiziGtpConfigured(settings)) {
    return {
      id: 'katago-model',
      title: 'KataGo 默认模型',
      status: 'warn',
      required: false,
      detail: '智子云尚未登录，暂时无法确认远程模型。'
    }
  }
  if (shouldPreferZhiziGtpEngine(settings, runtime.ready) && zhiziGtpConfigured(settings)) {
    return {
      id: 'katago-model',
      title: 'KataGo 默认模型',
      status: 'pass',
      required: false,
      detail: '智子云远程 KataGo 负责模型和配置，GoAgent 不要求本机模型。'
    }
  }
  if (shouldPreferIKataGoEngine(settings, runtime.ready) && ikatagoClientConfigured(settings)) {
    return {
      id: 'katago-model',
      title: 'KataGo 默认模型',
      status: 'pass',
      required: false,
      detail: 'iKataGo 远程服务负责模型和配置，GoAgent 不要求本机模型。'
    }
  }
  const liteRuntime = isLitePackagedRuntime()
  const required = isReleaseRuntime() && !liteRuntime
  if (!runtime.katagoModel) {
    return {
      id: 'katago-model',
      title: 'KataGo 默认模型',
      status: required ? 'fail' : 'warn',
      required,
      detail: liteRuntime ? 'Lite 安装包不内置默认 KataGo 模型。' : '未找到默认 KataGo 模型。',
      action: required
        ? '安装包应该内置默认 KataGo 模型；请确认 data/katago/models 中存在默认模型文件。'
        : liteRuntime
          ? '可在设置中下载官方模型；下载完成后基础分析即可使用。'
          : '开发环境可先保留 manifest，通过资源准备脚本或 CI release artifact 注入模型。'
    }
  }
  return {
    id: 'katago-model',
    title: 'KataGo 默认模型',
    status: 'pass',
    required,
    detail: `已找到: ${basename(runtime.katagoModel)}`
  }
}

async function checkBundledKataGoAssets(): Promise<DiagnosticCheck> {
  const settings = getSettings()
  const runtime = resolveKataGoRuntime(settings)
  if (settings.katagoEngineMode === 'zhizi' && !zhiziGtpConfigured(settings)) {
    return {
      id: 'katago-assets',
      title: '内置 KataGo 资源',
      status: 'warn',
      required: false,
      detail: '已选择智子云模式，本机内置资源不是首要问题；请先登录智子云。'
    }
  }
  if (shouldPreferZhiziGtpEngine(settings, runtime.ready) && zhiziGtpConfigured(settings)) {
    return {
      id: 'katago-assets',
      title: '内置 KataGo 资源',
      status: 'pass',
      required: false,
      detail: '当前使用智子云远程算力，本机内置资源不是必需项。'
    }
  }
  if (shouldPreferIKataGoEngine(settings, runtime.ready) && ikatagoClientConfigured(settings)) {
    return {
      id: 'katago-assets',
      title: '内置 KataGo 资源',
      status: 'pass',
      required: false,
      detail: '当前使用 iKataGo 远程算力，本机内置资源不是必需项。'
    }
  }
  const status = await inspectKataGoAssets()
  const liteRuntime = isLitePackagedRuntime()
  const required = isReleaseRuntime() && !liteRuntime
  if (status.ready) {
    return {
      id: 'katago-assets',
      title: '内置 KataGo 资源',
      status: 'pass',
      required,
      detail: status.detail
    }
  }
  return {
    id: 'katago-assets',
    title: '内置 KataGo 资源',
    status: required ? 'fail' : 'warn',
    required,
    detail: liteRuntime ? 'Lite 安装包只内置 manifest，不内置大型 KataGo 二进制和模型。' : status.detail,
    action: required
      ? '请重新安装完整安装包，或检查 data/katago 资源是否损坏。'
      : liteRuntime
        ? '需要本机分析时，可在设置里安装官方模型/运行时，或使用远程算力。'
        : '开发环境可通过 scripts/prepare_katago_assets.mjs 准备资源。'
  }
}

async function checkLlmProxy(): Promise<DiagnosticCheck> {
  const settings = getSettings()
  const configured = Boolean(settings.llmBaseUrl.trim() && (settings.llmApiKey.trim() || hasLlmApiKey()) && settings.llmModel.trim())
  if (!configured) {
    return {
      id: 'llm-proxy',
      title: 'AI 老师',
      status: 'warn',
      required: false,
      detail: '还没有连接 AI 模型。KataGo 分析仍然可以正常使用。',
      action: '在“设置 > AI 模型”中填写服务地址、访问密钥和模型。'
    }
  }
  const verified = settings.llmSetupStatus === 'verified'
  return {
    id: 'llm-proxy',
    title: 'AI 老师',
    status: verified ? 'pass' : 'warn',
    required: false,
    detail: verified ? '文字、棋盘图片和 Agent 工具调用已通过验证。' : '配置已保存，但还没有完成能力验证。',
    action: verified ? undefined : '打开“设置 > AI 模型”，运行连接验证。'
  }
}

function summarize(checks: DiagnosticCheck[]): Pick<DiagnosticsReport, 'overall' | 'summary'> {
  const failedRequired = checks.filter((check) => check.required && check.status === 'fail')
  if (failedRequired.length > 0) {
    return {
      overall: 'blocked',
      summary: `有 ${failedRequired.length} 个必需项未通过，暂时无法进行完整复盘。`
    }
  }
  const warnings = checks.filter((check) => check.status === 'warn' || check.status === 'fail')
  if (warnings.length > 0) {
    return {
      overall: 'fixable',
      summary: `基础功能可用，但还有 ${warnings.length} 项建议处理。`
    }
  }
  return {
    overall: 'ready',
    summary: 'GoAgent 已准备好开始复盘。'
  }
}

export async function collectDiagnostics(): Promise<DiagnosticsReport> {
  const checks = await Promise.all([
    checkWritableHome(),
    checkBundledKataGoAssets(),
    checkKatagoBinary(),
    checkKatagoModel(),
    checkLlmProxy()
  ])
  const result = summarize(checks)
  return {
    ...result,
    generatedAt: new Date().toISOString(),
    checks
  }
}

export type { DiagnosticCheck, DiagnosticsOverall, DiagnosticsReport }
