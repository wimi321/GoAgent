import type { ReactElement } from 'react'
import type { KataGoAssetInstallProgress, KataGoModelPreset } from '@main/lib/types'
import { translateKataGoPreset, type UiTranslator } from '../../i18n'

export interface KataGoAssetStatusView {
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

function formatBytes(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) {
    return ''
  }
  if (value >= 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
  }
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`
  }
  return `${Math.round(value / 1024)} KB`
}

function speedTierLabel(tier: KataGoModelPreset['speedTier'] | undefined, t: UiTranslator): string {
  switch (tier) {
    case 'fast':
      return t('speedFast')
    case 'balanced':
      return t('speedBalanced')
    case 'strong':
      return t('speedStrong')
    case 'maximum':
      return t('speedMaximum')
    default:
      return t('officialWeights')
  }
}

export function KataGoAssetsPanel({
  status,
  selectedPreset,
  busy = false,
  installProgress,
  installMessage,
  onInstall,
  onPause,
  onRefresh,
  t: providedT
}: {
  status?: KataGoAssetStatusView | null
  selectedPreset?: KataGoModelPreset
  busy?: boolean
  installProgress?: KataGoAssetInstallProgress | null
  installMessage?: string
  onInstall?: () => void
  onPause?: () => void
  onRefresh?: () => void
  t?: UiTranslator
}): ReactElement {
  const t = providedT ?? ((key: string, vars?: Record<string, string | number | undefined>) => {
    const fallback: Record<string, string> = {
      speedFast: '速度优先',
      speedBalanced: '教学平衡',
      speedStrong: '精读强度',
      speedMaximum: '旗舰强度',
      officialWeights: '官方权重',
      weightReady: '已就绪',
      weightInstalled: '权重已安装',
      weightPending: '待应用',
      weightInstall: '权重安装',
      chooseWeightToApply: '选择权重后应用。',
      selectedWeight: '当前选择',
      recommendedScene: '推荐场景',
      currentModel: `当前模型：${vars?.model ?? ''}`,
      selectedWeightNotInstalled: '当前选择的权重尚未安装。',
      engineNeedPrepare: ' KataGo 引擎还需要准备。',
      assetStatusMissing: '尚未读取资源状态。',
      applying: '应用中',
      pauseDownload: '暂停下载',
      resumeDownload: '继续下载',
      applySelectedWeight: '应用选择的权重',
      recheck: '重新检查'
    }
    return fallback[key] ?? key
  }) as UiTranslator
  const percent = installProgress?.percent
  const bytesLabel = installProgress?.receivedBytes
    ? `${formatBytes(installProgress.receivedBytes)}${installProgress.totalBytes ? ` / ${formatBytes(installProgress.totalBytes)}` : ''}`
    : ''
  const modelReady = Boolean(status?.modelFound)
  const binaryReady = Boolean(status?.binaryFound && status.binaryExecutable)
  const statusLabel = status?.ready ? t('weightReady') : modelReady ? t('weightInstalled') : t('weightPending')
  const selectedPresetCopy = selectedPreset ? translateKataGoPreset(selectedPreset, t) : null
  return (
    <section className="runtime-card katago-assets-card">
      <header>
        <div>
          <strong>{t('weightInstall')}</strong>
          <p>{selectedPresetCopy ? `${selectedPresetCopy.blockSize} · ${speedTierLabel(selectedPresetCopy.speedTier, t)} · ${selectedPresetCopy.badge}` : t('chooseWeightToApply')}</p>
        </div>
        <span className={status?.ready ? 'runtime-pill runtime-pill--ready' : 'runtime-pill runtime-pill--warn'}>{statusLabel}</span>
      </header>
      {selectedPreset ? (
        <div className="katago-preset-card">
          <div>
            <span>{t('selectedWeight')}</span>
            <strong>{selectedPresetCopy?.group ?? selectedPreset.group}</strong>
          </div>
          <div>
            <span>{t('recommendedScene')}</span>
            <strong>{selectedPresetCopy?.blockSize ?? selectedPreset.blockSize} · {speedTierLabel(selectedPresetCopy?.speedTier ?? selectedPreset.speedTier, t)}</strong>
          </div>
        </div>
      ) : null}
      {status ? (
        <div className="katago-resource-summary">
          <span className={modelReady ? 'runtime-dot runtime-dot--ready' : 'runtime-dot runtime-dot--warn'} />
          <p>
            {modelReady ? t('currentModel', { model: status.modelDisplayName }) : t('selectedWeightNotInstalled')}
            {!binaryReady ? t('engineNeedPrepare') : ''}
          </p>
        </div>
      ) : <p>{t('assetStatusMissing')}</p>}
      {installProgress ? (
        <div className="katago-install-progress" aria-live="polite">
          <div>
            <span>{installProgress.message}</span>
            {typeof percent === 'number' ? <strong>{percent.toFixed(percent % 1 === 0 ? 0 : 1)}%</strong> : null}
          </div>
          <div className="katago-install-progress__bar">
            <span style={{ width: `${Math.max(4, percent ?? 8)}%` }} />
          </div>
          {bytesLabel ? <small>{bytesLabel}</small> : null}
        </div>
      ) : null}
      {installMessage && !installProgress ? <p className="test-message">{installMessage}</p> : null}
      <div className="katago-assets-card__actions">
        {busy ? (
          <button className="primary-button" type="button" onClick={onPause} disabled={!onPause}>{t('pauseDownload')}</button>
        ) : (
          <button className="primary-button" type="button" onClick={onInstall} disabled={!onInstall}>
            {installProgress?.stage === 'paused' ? t('resumeDownload') : t('applySelectedWeight')}
          </button>
        )}
        <button className="ghost-button" type="button" onClick={onRefresh}>{t('recheck')}</button>
      </div>
    </section>
  )
}
