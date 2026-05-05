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
  onStop?: () => void
}

export function TeacherComposerPro({ value, busy = false, actions = [], onChange, onSubmit, onStop }: TeacherComposerProProps): ReactElement {
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
      <span className="ks-composer-pro__chrome">Ask GoMentor：新会话、关闭会话、历史、教学设定包含学生级别（段位）、年龄、老师风格</span>
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
        <button
          type={busy ? 'button' : 'submit'}
          className={`ks-composer-pro__send${busy ? ' is-stopping' : ''}`}
          disabled={!busy && !value.trim()}
          aria-label={busy ? '停止生成' : '发送'}
          onClick={busy ? onStop : undefined}
        >
          {busy ? '停止' : '发送'}
        </button>
      </div>
    </form>
  )
}
