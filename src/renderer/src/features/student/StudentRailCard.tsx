import type { ReactElement } from 'react'
import type { UiTranslator } from '../../i18n'
import './student.css'

export interface StudentRailCardProps {
  displayName?: string
  primaryFoxNickname?: string
  disabled?: boolean
  onChangeBinding?: () => void
  t?: UiTranslator
}

export function StudentRailCard({
  displayName,
  primaryFoxNickname,
  disabled = false,
  onChangeBinding,
  t
}: StudentRailCardProps): ReactElement {
  const translate = t ?? ((key: string, vars?: Record<string, string | number | undefined>) => {
    const fallback: Record<string, string> = {
      studentCardLabel: '棋手',
      unboundPlayer: '未绑定棋手',
      changeBinding: '修改',
      bindPlayer: '绑定',
      bindPlayerAria: '绑定棋手',
      changeBindingAria: `修改绑定棋手：${vars?.name ?? ''}`
    }
    return fallback[key] ?? key
  }) as UiTranslator
  const name = displayName || primaryFoxNickname || translate('unboundPlayer')
  const hasPlayer = Boolean(displayName || primaryFoxNickname)
  return (
    <section className="student-rail-card">
      <button
        type="button"
        className="student-rail-card__button"
        disabled={disabled}
        onClick={onChangeBinding}
        aria-label={hasPlayer ? translate('changeBindingAria', { name }) : translate('bindPlayerAria')}
      >
        <span>{translate('studentCardLabel')}</span>
        <strong>{name}</strong>
        <em>{hasPlayer ? translate('changeBinding') : translate('bindPlayer')}</em>
      </button>
    </section>
  )
}
