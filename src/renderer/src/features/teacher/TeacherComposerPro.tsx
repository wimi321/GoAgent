import type { FormEvent, ReactElement } from 'react'
import { useEffect, useState } from 'react'
import type { AppSettings, CoachUserLevel, StudentAgeRange, TeacherPersonaStyle } from '@main/lib/types'
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
  onQuickPrompt?: (prompt: string) => void
}

const QUICK_PROMPTS = [
  '像老师一样讲这手',
  '只说我下次怎么想',
  '把变化讲短一点'
]

const LEVEL_OPTIONS: Array<{ value: CoachUserLevel; label: string }> = [
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '级位/中级' },
  { value: 'advanced', label: '高级' },
  { value: 'dan', label: '段位' }
]

const AGE_OPTIONS: Array<{ value: StudentAgeRange; label: string }> = [
  { value: 'unknown', label: '年龄未指定' },
  { value: 'child', label: '儿童' },
  { value: 'teen', label: '青少年' },
  { value: 'adult', label: '成年人' },
  { value: 'senior', label: '年长学习者' }
]

const STYLE_OPTIONS: Array<{ value: TeacherPersonaStyle; label: string }> = [
  { value: 'balanced', label: '平衡自然' },
  { value: 'rigorous', label: '严谨细致' },
  { value: 'gentle', label: '温柔和蔼' },
  { value: 'strict', label: '严格专业' },
  { value: 'humorous', label: '风趣幽默' }
]

function emitTeacherSessionAction(action: 'new' | 'close' | 'history'): void {
  window.dispatchEvent(new CustomEvent('gomentor:teacher-session-action', { detail: action }))
}

export function TeacherComposerPro({ value, busy = false, actions = [], onChange, onSubmit, onQuickPrompt }: TeacherComposerProProps): ReactElement {
  const [settings, setSettings] = useState<Pick<AppSettings, 'defaultCoachLevel' | 'defaultStudentAgeRange' | 'teacherStyle'> | null>(null)

  useEffect(() => {
    void window.gomentor.getDashboard().then((dashboard) => {
      setSettings({
        defaultCoachLevel: dashboard.settings.defaultCoachLevel ?? 'intermediate',
        defaultStudentAgeRange: dashboard.settings.defaultStudentAgeRange ?? 'unknown',
        teacherStyle: dashboard.settings.teacherStyle ?? 'balanced'
      })
    }).catch(() => undefined)
  }, [])

  async function updateTeacherSetting(next: Partial<AppSettings>): Promise<void> {
    const dashboard = await window.gomentor.updateSettings(next)
    setSettings({
      defaultCoachLevel: dashboard.settings.defaultCoachLevel ?? 'intermediate',
      defaultStudentAgeRange: dashboard.settings.defaultStudentAgeRange ?? 'unknown',
      teacherStyle: dashboard.settings.teacherStyle ?? 'balanced'
    })
  }

  return (
    <form className="ks-composer-pro" onSubmit={onSubmit}>
      <div className="ks-composer-pro__chrome">
        <span>Ask GoMentor</span>
        {busy ? <small>Reading board...</small> : null}
      </div>
      <div className="ks-composer-pro__sessions" aria-label="老师会话">
        <button type="button" onClick={() => emitTeacherSessionAction('new')} disabled={busy}>新会话</button>
        <button type="button" onClick={() => emitTeacherSessionAction('close')} disabled={busy}>关闭会话</button>
        <button type="button" onClick={() => emitTeacherSessionAction('history')} disabled={busy}>历史</button>
      </div>
      {settings ? (
        <div className="ks-composer-pro__persona" aria-label="学生级别、年龄与老师风格设置">
          <label>
            <span>学生级别</span>
            <select value={settings.defaultCoachLevel} onChange={(event) => void updateTeacherSetting({ defaultCoachLevel: event.target.value as CoachUserLevel })} disabled={busy}>
              {LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>年龄</span>
            <select value={settings.defaultStudentAgeRange} onChange={(event) => void updateTeacherSetting({ defaultStudentAgeRange: event.target.value as StudentAgeRange })} disabled={busy}>
              {AGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>老师风格</span>
            <select value={settings.teacherStyle} onChange={(event) => void updateTeacherSetting({ teacherStyle: event.target.value as TeacherPersonaStyle })} disabled={busy}>
              {STYLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      ) : null}
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
      <div className="ks-composer-pro__quick">
        {QUICK_PROMPTS.map((prompt) => (
          <button key={prompt} type="button" onClick={() => onQuickPrompt?.(prompt)} disabled={busy}>
            {prompt}
          </button>
        ))}
      </div>
      <div className="ks-composer-pro__box">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="输入复盘问题..."
        />
        <button type="submit" disabled={busy || !value.trim()}>
          {busy ? '分析中' : '发送'}
        </button>
      </div>
    </form>
  )
}
