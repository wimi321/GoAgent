import type {
  AppSettings,
  ZhiziCloudConnectionTestResult
} from '@main/lib/types'
import { getZhiziCloudAccountStatus } from './zhiziCloudAuth'
import { queryZhiziGtpAnalysisBatch } from './zhiziGtpEngine'
import {
  classifyZhiziRemoteError,
  getZhiziPersistentSessionTelemetry
} from './zhiziSocketSession'

function resultState(code: ReturnType<typeof classifyZhiziRemoteError>['code']): ZhiziCloudConnectionTestResult['state'] {
  if (code === 'auth') return 'token-expired'
  if (code === 'network' || code === 'timeout') return 'network-error'
  if (code === 'capacity') return 'worker-unavailable'
  if (code === 'entitlement') return 'entitlement-error'
  return 'error'
}

export async function probeZhiziCloudConnection(
  settings: AppSettings
): Promise<ZhiziCloudConnectionTestResult> {
  if (!settings.zhiziToken.trim()) {
    return {
      ok: false,
      state: 'logged-out',
      message: '智子云未登录：请先用账号密码或短信验证码登录。'
    }
  }

  let accountStatus: Awaited<ReturnType<typeof getZhiziCloudAccountStatus>>
  let accountStatusWarning = ''
  try {
    accountStatus = await getZhiziCloudAccountStatus(settings.zhiziToken)
  } catch {
    accountStatus = {
      tokenValid: true,
      isMembership: false,
      hasConnectAccount: false
    }
    accountStatusWarning = '账号资料暂时无法读取，已直接检测远程引擎。'
  }
  if (!accountStatus.tokenValid) {
    return {
      ok: false,
      state: 'token-expired',
      message: '智子云登录已失效，请重新登录。',
      ...accountStatus
    }
  }

  const before = getZhiziPersistentSessionTelemetry()
  const startedAt = Date.now()
  let latestVisits = 0
  let latestSpeed = 0
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
          maxVisits: 64
        }
      ],
      onSearchProgress: (progress) => {
        latestVisits = Math.max(latestVisits, progress.visits)
        if (progress.visitsPerSecond > 0) latestSpeed = progress.visitsPerSecond
      }
    })
    const result = results.get('zhizi-smoke')
    const best = result?.moveInfos?.[0]
    if (!best) {
      return {
        ok: false,
        state: 'error',
        message: '智子云已连接，但没有返回候选点。请稍后重试。',
        ...accountStatus
      }
    }
    const after = getZhiziPersistentSessionTelemetry()
    return {
      ok: true,
      state: 'ready',
      message: [
        before.ready
          ? '智子云连接正常，已复用远程引擎并收到分析结果。'
          : '智子云连接成功，远程 KataGo 已返回分析结果。',
        accountStatusWarning
      ].filter(Boolean).join(' '),
      candidateCount: result?.moveInfos?.length ?? 0,
      topMove: typeof best.move === 'string' ? best.move : undefined,
      visits: typeof best.visits === 'number' ? best.visits : latestVisits || undefined,
      winrate: typeof best.winrate === 'number' ? best.winrate : undefined,
      scoreMean: typeof best.scoreMean === 'number'
        ? best.scoreMean
        : typeof best.scoreLead === 'number'
          ? best.scoreLead
          : undefined,
      visitsPerSecond: latestSpeed || undefined,
      readyMillis: before.ready ? 0 : after.lastReadyMillis,
      analysisMillis: Date.now() - startedAt,
      sessionReused: before.ready,
      gpuType: settings.zhiziGpuType || 'vip-share',
      ...accountStatus
    }
  } catch (cause) {
    const error = classifyZhiziRemoteError(cause, settings.zhiziGpuType || 'vip-share')
    return {
      ok: false,
      state: resultState(error.code),
      message: error.message,
      gpuType: settings.zhiziGpuType || 'vip-share',
      ...accountStatus
    }
  }
}
