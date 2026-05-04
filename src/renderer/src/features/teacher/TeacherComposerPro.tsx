import type { FormEvent, KeyboardEvent, ReactElement } from 'react'
import { useRef } from 'react'
import './teacher-pro.css'

interface TeacherComposerProProps {
  value: string
  busy?: boolean
  actions?: Array<{
    label: string
    onClick: () => void
    disabled?: boolean
    primary?: boolean
  }>
  onChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}

export function TeacherComposerPro({ value, busy = false, actions = [], onChange, onSubmit }: TeacherComposerProProps): ReactElement {
  const formRef = useRef<HTMLFormElement | null>(null)

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }
    event.preventDefault()
    if (!busy && value.trim()) {
      formRef.current?.requestSubmit()
    }
  }

  return (
    <form ref={formRef} className="ks-composer-pro" onSubmit={onSubmit}>
      <span className="ks-composer-pro__chrome">Ask GoMentor</span>
      {actions.length > 0 ? (
        <div className="ks-composer-pro__actions" aria-label="老师快捷动作">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.primary ? 'is-primary' : ''}
              onClick={action.onClick}
              disabled={busy || action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="ks-composer-pro__box">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder="问这盘棋的问题..."
        />
        <button type="submit" className="ks-composer-pro__send" disabled={busy || !value.trim()} aria-label="发送">
          {busy ? '发送中' : '发送'}
        </button>
      </div>
    </form>
  )
}
