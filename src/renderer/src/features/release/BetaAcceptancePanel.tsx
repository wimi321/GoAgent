import type { ReactElement } from 'react'
import type { ReleaseReadinessFlags } from '@main/lib/types'
import type { UiTranslator } from '../../i18n'

export interface BetaAcceptanceItem {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail' | 'unknown'
  detail?: string
}

export interface BetaAcceptancePanelProps {
  items: BetaAcceptanceItem[]
  flags?: ReleaseReadinessFlags
  onRunChecks?: () => void
  t?: UiTranslator
}

function labelForStatus(status: BetaAcceptanceItem['status'], t: UiTranslator): string {
  if (status === 'pass') return t('pass')
  if (status === 'warn') return t('warning')
  if (status === 'fail') return t('fail')
  return t('unknown')
}

export function BetaAcceptancePanel({ items, flags, onRunChecks, t: providedT }: BetaAcceptancePanelProps): ReactElement {
  const t = providedT ?? ((key: string) => {
    const fallback: Record<string, string> = {
      betaAcceptance: 'P0 Beta 验收',
      publicBetaReady: 'Public Beta Ready',
      publicBetaNotReady: 'Public Beta 未就绪',
      pass: '通过',
      warning: '警告',
      fail: '失败',
      unknown: '未检查',
      recheck: '重新检查',
      automation: '自动化',
      assets: '资源',
      installers: '安装包',
      signing: '签名',
      visualQa: '视觉 QA'
    }
    return fallback[key] ?? key
  }) as UiTranslator
  const failCount = items.filter((item) => item.status === 'fail').length
  const warnCount = items.filter((item) => item.status === 'warn').length
  const passCount = items.filter((item) => item.status === 'pass').length
  const publicBetaReady = flags?.publicBetaReady ?? failCount === 0

  return (
    <section className="beta-acceptance-panel">
      <div className="beta-acceptance-panel__head">
        <div>
          <strong>{t('betaAcceptance')}</strong>
          <small>
            {publicBetaReady ? t('publicBetaReady') : t('publicBetaNotReady')} · {passCount} {t('pass')} · {warnCount} {t('warning')} · {failCount} {t('fail')}
          </small>
        </div>
        {onRunChecks ? <button type="button" onClick={onRunChecks}>{t('recheck')}</button> : null}
      </div>
      {flags ? (
        <div className="beta-acceptance-panel__flags">
          <span data-ready={flags.automationReady}>{t('automation')}</span>
          <span data-ready={flags.assetsReady}>{t('assets')}</span>
          <span data-ready={flags.installersReady}>{t('installers')}</span>
          <span data-ready={flags.signingReady}>{t('signing')}</span>
          <span data-ready={flags.windowsSmokeReady}>Windows smoke</span>
          <span data-ready={flags.visualQaReady}>{t('visualQa')}</span>
        </div>
      ) : null}
      <div className="beta-acceptance-panel__list">
        {items.map((item) => (
          <article key={item.id} className={`beta-check beta-check--${item.status}`}>
            <span>{labelForStatus(item.status, t)}</span>
            <div>
              <strong>{item.label}</strong>
              {item.detail ? <small>{item.detail}</small> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
