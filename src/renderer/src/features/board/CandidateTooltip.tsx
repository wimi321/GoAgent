import type { ReactElement } from 'react'
import type { UiTranslator } from '../../i18n'
import { formatScoreLead, formatWinrate } from './timelineInteraction'

export interface CandidateTooltipMove {
  order?: number
  move?: string
  gtp?: string
  winrate?: number
  scoreLead?: number
  visits?: number
  prior?: number
  pv?: string[]
  note?: string
}

export interface CandidateTooltipPosition {
  x: number
  y: number
}

export interface CandidateTooltipProps {
  candidate: CandidateTooltipMove | null
  position: CandidateTooltipPosition | null
  boardLabel?: string
  t?: UiTranslator
}

function formatPrior(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }
  return `${(value <= 1 ? value * 100 : value).toFixed(1)}%`
}

export function CandidateTooltip({ candidate, position, boardLabel, t: providedT }: CandidateTooltipProps): ReactElement | null {
  const t = providedT ?? ((key: string) => {
    const fallback: Record<string, string> = {
      boardCandidate: '候选点',
      boardRecommended: '推荐',
      candidateWinrate: '胜率',
      candidateScore: '目差',
      candidateVisits: '访问',
      candidatePrior: '先验'
    }
    return fallback[key] ?? key
  }) as UiTranslator
  if (!candidate || !position) {
    return null
  }

  const title = candidate.move || candidate.gtp || boardLabel || t('boardCandidate')
  const order = candidate.order ? `#${candidate.order}` : t('boardRecommended')

  return (
    <div
      className="candidate-tooltip"
      style={{
        transform: `translate(${Math.round(position.x)}px, ${Math.round(position.y)}px)`
      }}
      role="tooltip"
    >
      <div className="candidate-tooltip__head">
        <strong>{title}</strong>
        <span>{order}</span>
      </div>
      <div className="candidate-tooltip__grid">
        <span>{t('candidateWinrate')}</span>
        <strong>{formatWinrate(candidate.winrate)}</strong>
        <span>{t('candidateScore')}</span>
        <strong>{formatScoreLead(candidate.scoreLead)}</strong>
        <span>{t('candidateVisits')}</span>
        <strong>{candidate.visits ?? '—'}</strong>
        <span>{t('candidatePrior')}</span>
        <strong>{formatPrior(candidate.prior)}</strong>
      </div>
      {candidate.pv && candidate.pv.length > 0 ? (
        <div className="candidate-tooltip__pv">
          <span>PV</span>
          <strong>{candidate.pv.slice(0, 10).join(' ')}</strong>
        </div>
      ) : null}
      {candidate.note ? <p>{candidate.note}</p> : null}
    </div>
  )
}
