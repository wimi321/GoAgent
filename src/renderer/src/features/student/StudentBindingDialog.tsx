import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { UiTranslator } from '../../i18n'
import './student.css'

export interface StudentOption {
  id: string
  displayName: string
  primaryFoxNickname?: string
  aliases?: string[]
  suggestedColor?: 'B' | 'W'
}

export interface StudentBindingDialogProps {
  open: boolean
  blackName?: string
  whiteName?: string
  suggestions?: StudentOption[]
  onClose: () => void
  onBindExisting: (input: { studentId: string; color?: 'B' | 'W'; aliasFromPlayerName?: string }) => void
  onCreateStudent: (input: { displayName: string; foxNickname?: string; color?: 'B' | 'W'; aliasFromPlayerName?: string }) => void
  onSkip: () => void
  t?: UiTranslator
}

export function StudentBindingDialog(props: StudentBindingDialogProps): ReactElement | null {
  const t = props.t ?? ((key: string, vars?: Record<string, string | number | undefined>) => {
    const fallback: Record<string, string> = {
      bindDialogLabel: '绑定棋手画像',
      bindDialogTitle: '这盘棋绑定到哪个棋手？',
      bindDialogDescription: '老师会把复盘结果写入这个棋手的长期画像，之后分析最近 10 局会自动使用同一份上下文。',
      blackSide: `黑方：${vars?.name ?? ''}`,
      whiteSide: `白方：${vars?.name ?? ''}`,
      unknownPlayer: '未知',
      bindExistingPlayer: '绑定已有棋手',
      createNewPlayer: '创建新棋手',
      selectPlayer: '选择棋手',
      pleaseSelect: '请选择',
      playerName: '棋手名',
      playerNamePlaceholder: '输入棋手名',
      foxNicknameOptional: '野狐昵称（可选）',
      foxNicknameHelp: '用于长期画像聚合',
      skipBinding: '暂不绑定',
      cancel: '取消',
      bindPlayer: '绑定',
      createAndBind: '创建并绑定',
      unnamedPlayer: '未命名棋手'
    }
    return fallback[key] ?? key
  }) as UiTranslator
  const [mode, setMode] = useState<'existing' | 'create'>(props.suggestions?.length ? 'existing' : 'create')
  const [studentId, setStudentId] = useState(props.suggestions?.[0]?.id ?? '')
  const [displayName, setDisplayName] = useState('')
  const [foxNickname, setFoxNickname] = useState('')
  const [color, setColor] = useState<'B' | 'W' | ''>('')

  const playerName = useMemo(() => {
    if (color === 'B') return props.blackName
    if (color === 'W') return props.whiteName
    return ''
  }, [color, props.blackName, props.whiteName])

  function studentOptionLabel(student: StudentOption): string {
    const displayName = student.displayName.trim()
    const foxNickname = student.primaryFoxNickname?.trim()
    if (!foxNickname || foxNickname.toLowerCase() === displayName.toLowerCase()) {
      return displayName
    }
    return `${displayName} · Fox ${foxNickname}`
  }

  useEffect(() => {
    if (!props.open) {
      return
    }
    const firstSuggestion = props.suggestions?.[0]
    setMode(firstSuggestion ? 'existing' : 'create')
    setStudentId(firstSuggestion?.id ?? '')
    setDisplayName('')
    setFoxNickname('')
    setColor(firstSuggestion?.suggestedColor ?? '')
  }, [props.open, props.blackName, props.whiteName, props.suggestions?.length, props.suggestions?.[0]?.id, props.suggestions?.[0]?.suggestedColor])

  if (!props.open) return null

  return (
    <div className="student-dialog-backdrop" role="presentation">
      <section className="student-dialog" role="dialog" aria-modal="true" aria-label={t('bindDialogLabel')}>
        <header>
          <h2>{t('bindDialogTitle')}</h2>
          <p>{t('bindDialogDescription')}</p>
        </header>

        <div className="student-player-choice">
          <button className={color === 'B' ? 'is-active' : ''} onClick={() => setColor('B')}>
            {t('blackSide', { name: props.blackName || t('unknownPlayer') })}
          </button>
          <button className={color === 'W' ? 'is-active' : ''} onClick={() => setColor('W')}>
            {t('whiteSide', { name: props.whiteName || t('unknownPlayer') })}
          </button>
        </div>

        <div className="student-mode-tabs">
          <button className={mode === 'existing' ? 'is-active' : ''} onClick={() => setMode('existing')}>{t('bindExistingPlayer')}</button>
          <button className={mode === 'create' ? 'is-active' : ''} onClick={() => setMode('create')}>{t('createNewPlayer')}</button>
        </div>

        {mode === 'existing' ? (
          <label>
            {t('selectPlayer')}
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
              <option value="">{t('pleaseSelect')}</option>
              {(props.suggestions ?? []).map((student) => (
                <option key={student.id} value={student.id}>
                  {studentOptionLabel(student)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="student-create-form">
            <label>
              {t('playerName')}
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={playerName || t('playerNamePlaceholder')} />
            </label>
            <label>
              {t('foxNicknameOptional')}
              <input value={foxNickname} onChange={(event) => setFoxNickname(event.target.value)} placeholder={t('foxNicknameHelp')} />
            </label>
          </div>
        )}

        <footer>
          <button className="ghost-button" onClick={props.onSkip}>{t('skipBinding')}</button>
          <button className="ghost-button" onClick={props.onClose}>{t('cancel')}</button>
          {mode === 'existing' ? (
            <button className="primary-button" disabled={!studentId} onClick={() => props.onBindExisting({ studentId, color: color || undefined, aliasFromPlayerName: playerName })}>{t('bindPlayer')}</button>
          ) : (
            <button className="primary-button" disabled={!displayName.trim() && !playerName} onClick={() => props.onCreateStudent({ displayName: displayName.trim() || playerName || t('unnamedPlayer'), foxNickname: foxNickname.trim() || undefined, color: color || undefined, aliasFromPlayerName: playerName })}>{t('createAndBind')}</button>
          )}
        </footer>
      </section>
    </div>
  )
}
