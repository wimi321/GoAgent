import type { ReactElement } from 'react'
import type { UiTranslator } from '../../i18n'
import type { TerritoryJudgement } from './territoryJudgement'

interface TerritoryControlPanelProps {
  enabled: boolean
  judgement: TerritoryJudgement
  busy?: boolean
  compact?: boolean
  onToggle: () => void
  onDeepen: () => void
  t: UiTranslator
}

interface TerritorySummaryStripProps {
  judgement: TerritoryJudgement
  compact?: boolean
  t: UiTranslator
}

function confidenceLabel(confidence: TerritoryJudgement['confidence'], t: UiTranslator): string {
  if (confidence === 'high') return t('territoryConfidenceHigh')
  if (confidence === 'medium') return t('territoryConfidenceMedium')
  if (confidence === 'low') return t('territoryConfidenceLow')
  return t('territoryConfidenceMissing')
}

export function TerritoryControlPanel({
  enabled,
  judgement,
  busy = false,
  compact = false,
  onToggle,
  onDeepen,
  t
}: TerritoryControlPanelProps): ReactElement {
  return (
    <div className={`territory-control ${compact ? 'territory-control--compact' : ''} ${enabled ? 'is-enabled' : ''}`} data-disable-replay-wheel="true">
      <button type="button" className="territory-control__toggle" onClick={onToggle} aria-pressed={enabled}>
        <span className="territory-control__spark" />
        {t('territoryJudgement')}
      </button>
      {enabled ? (
        <>
          <span className={`territory-control__confidence territory-control__confidence--${judgement.confidence}`}>
            {t('territoryConfidence')}{confidenceLabel(judgement.confidence, t)}
          </span>
          <span className="territory-control__legend" aria-label={t('territoryLegend')}>
            <i className="territory-control__legend-dot territory-control__legend-dot--black" />
            {t('territoryBlackTerritory')}
            <i className="territory-control__legend-dot territory-control__legend-dot--white" />
            {t('territoryWhiteTerritory')}
            <i className="territory-control__legend-dot territory-control__legend-dot--unclear" />
            {t('territoryContested')}
          </span>
          <button type="button" className="territory-control__deepen" onClick={onDeepen} disabled={busy}>
            {busy ? t('timelineLoading') : t('territoryDeepen')}
          </button>
        </>
      ) : null}
    </div>
  )
}

export function TerritorySummaryStrip({ judgement, compact = false, t }: TerritorySummaryStripProps): ReactElement {
  const whiteShare = Math.max(0, Math.min(100, 100 - judgement.blackShare))
  if (compact) {
    return (
      <div
        className={`territory-summary territory-summary--compact ${judgement.available ? '' : 'territory-summary--missing'}`}
        title={judgement.note}
      >
        <span className="territory-summary__compact-lead">
          <i>{t('territoryJudgement')}</i>
          <strong>{judgement.leadText}</strong>
        </span>
        <span className="territory-summary__compact-balance" aria-label={t('territoryBalance')}>
          <b className="territory-summary__bar territory-summary__bar--black" style={{ width: `${judgement.available ? judgement.blackShare : 50}%` }} />
          <b className="territory-summary__bar territory-summary__bar--white" style={{ width: `${judgement.available ? whiteShare : 50}%` }} />
        </span>
        <span className={`territory-summary__compact-confidence territory-control__confidence--${judgement.confidence}`}>
          {confidenceLabel(judgement.confidence, t)}
        </span>
      </div>
    )
  }
  return (
    <div className={`territory-summary ${compact ? 'territory-summary--compact' : ''} ${judgement.available ? '' : 'territory-summary--missing'}`}>
      <div className="territory-summary__metrics">
        <div className="territory-summary__metric territory-summary__metric--lead">
          <span>{t('territoryLead')}</span>
          <strong>{judgement.leadText}</strong>
        </div>
        <div className="territory-summary__metric">
          <span>{t('territoryBlackStrong')}</span>
          <strong>{judgement.available ? judgement.blackStrong : '—'}</strong>
        </div>
        <div className="territory-summary__metric">
          <span>{t('territoryWhiteStrong')}</span>
          <strong>{judgement.available ? judgement.whiteStrong : '—'}</strong>
        </div>
        <div className="territory-summary__metric">
          <span>{t('territoryUnsettled')}</span>
          <strong>{judgement.available ? judgement.unsettled : '—'}</strong>
        </div>
        <div className="territory-summary__metric">
          <span>{t('territoryConfidence')}</span>
          <strong>{confidenceLabel(judgement.confidence, t)}</strong>
        </div>
      </div>
      <div className="territory-summary__balance" aria-label={t('territoryBalance')}>
        <span className="territory-summary__bar territory-summary__bar--black" style={{ width: `${judgement.available ? judgement.blackShare : 50}%` }} />
        <span className="territory-summary__bar territory-summary__bar--white" style={{ width: `${judgement.available ? whiteShare : 50}%` }} />
        <em>{judgement.available ? `${judgement.blackShare}% / ${whiteShare}%` : t('territoryNeedDeepen')}</em>
      </div>
      <div className="territory-summary__regions">
        {judgement.available && judgement.regions.length > 0 ? judgement.regions.slice(0, 4).map((region) => (
          <span key={region.id} className={`territory-summary__region territory-summary__region--${region.owner}`}>
            <i />
            {region.label}
            <b>{region.owner === 'B' ? t('black') : region.owner === 'W' ? t('white') : t('territoryUnclear')}</b>
          </span>
        )) : (
          <span className="territory-summary__region territory-summary__region--unclear">
            <i />
            {judgement.note}
          </span>
        )}
      </div>
    </div>
  )
}
