import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import type { AppSettings, DashboardData, KataGoCustomEngineCheckResult, KataGoCustomPathKind } from '@main/lib/types'
import type { TranslationKey, UiTranslator } from '../../i18n'

type CustomEnginePaths = Pick<AppSettings, 'katagoCustomBin' | 'katagoCustomModel' | 'katagoCustomConfig'>

const FIELDS: Array<{ key: keyof CustomEnginePaths; kind: KataGoCustomPathKind; label: TranslationKey; pickTitle: TranslationKey }> = [
  { key: 'katagoCustomBin', kind: 'binary', label: 'customEngineBinary', pickTitle: 'customEnginePickBinary' },
  { key: 'katagoCustomModel', kind: 'model', label: 'customEngineModel', pickTitle: 'customEnginePickModel' },
  { key: 'katagoCustomConfig', kind: 'config', label: 'customEngineConfig', pickTitle: 'customEnginePickConfig' }
]

const EMPTY_PATHS: CustomEnginePaths = { katagoCustomBin: '', katagoCustomModel: '', katagoCustomConfig: '' }

function trimmedPaths(paths: CustomEnginePaths): CustomEnginePaths {
  return {
    katagoCustomBin: paths.katagoCustomBin.trim(),
    katagoCustomModel: paths.katagoCustomModel.trim(),
    katagoCustomConfig: paths.katagoCustomConfig.trim()
  }
}

/** Issue #57: lets users run their own KataGo program, model or analysis config. */
export function KataGoCustomEnginePanel({
  dashboard,
  busy,
  t,
  onDashboardUpdated,
  onEngineChanged
}: {
  dashboard: DashboardData
  busy: boolean
  t: UiTranslator
  onDashboardUpdated: (dashboard: DashboardData) => void
  onEngineChanged: () => void
}): ReactElement {
  const { katagoCustomBin = '', katagoCustomModel = '', katagoCustomConfig = '' } = dashboard.settings
  const [draft, setDraft] = useState<CustomEnginePaths>({ katagoCustomBin, katagoCustomModel, katagoCustomConfig })
  const [working, setWorking] = useState<'' | 'check' | 'save'>('')
  const [check, setCheck] = useState<KataGoCustomEngineCheckResult | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setDraft({ katagoCustomBin, katagoCustomModel, katagoCustomConfig })
  }, [katagoCustomBin, katagoCustomModel, katagoCustomConfig])

  const saved = trimmedPaths({ katagoCustomBin, katagoCustomModel, katagoCustomConfig })
  const pending = trimmedPaths(draft)
  const dirty = FIELDS.some(({ key }) => pending[key] !== saved[key])
  const customInUse = FIELDS.some(({ key }) => saved[key])
  const disabled = busy || working !== ''
  const profile = dashboard.systemProfile
  const customNotes = profile.notes.filter((note) => note.includes('自定义'))

  async function pick(field: (typeof FIELDS)[number]): Promise<void> {
    const picked = await window.goagent.pickKataGoCustomPath({ kind: field.kind, title: t(field.pickTitle) })
    if (picked.canceled) return
    setDraft((current) => ({ ...current, [field.key]: picked.path }))
    setCheck(null)
    setMessage('')
  }

  async function runCheck(): Promise<void> {
    setWorking('check')
    setCheck(null)
    setMessage('')
    try {
      setCheck(await window.goagent.checkKataGoCustomEngine(pending))
    } catch (cause) {
      setMessage(String(cause))
    } finally {
      setWorking('')
    }
  }

  async function save(next: CustomEnginePaths, doneMessage: TranslationKey): Promise<void> {
    setWorking('save')
    setMessage('')
    try {
      onDashboardUpdated(await window.goagent.updateSettings(next))
      onEngineChanged()
      setMessage(t(doneMessage))
    } catch (cause) {
      setMessage(String(cause))
    } finally {
      setWorking('')
    }
  }

  return (
    <section className="runtime-card katago-custom-engine-card">
      <header>
        <div>
          <strong>{t('customEngineTitle')}</strong>
          <p>{t('customEngineDescription')}</p>
        </div>
        {customInUse ? <span className="runtime-pill runtime-pill--ready">{t('customEngineInUse')}</span> : null}
      </header>
      {FIELDS.map((field) => (
        <label key={field.key}>
          {t(field.label)}
          <div className="llm-secret-input-row">
            <input
              value={draft[field.key]}
              placeholder={t('customEngineAutomatic')}
              onChange={(event) => {
                const value = event.target.value
                setDraft((current) => ({ ...current, [field.key]: value }))
                setCheck(null)
              }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button className="ghost-button" type="button" onClick={() => void pick(field)} disabled={disabled}>
              {t('customEngineBrowse')}
            </button>
          </div>
        </label>
      ))}
      <div className="katago-assets-card__actions">
        <button className="ghost-button" type="button" onClick={() => void runCheck()} disabled={disabled}>
          {working === 'check' ? t('customEngineChecking') : t('customEngineCheck')}
        </button>
        <button className="primary-button" type="button" onClick={() => void save(pending, 'customEngineSaved')} disabled={disabled || !dirty}>
          {t('customEngineApply')}
        </button>
        {customInUse ? (
          <button className="ghost-button" type="button" onClick={() => void save(EMPTY_PATHS, 'customEngineResetDone')} disabled={disabled}>
            {t('customEngineReset')}
          </button>
        ) : null}
      </div>
      {check ? (
        <div className={check.ok ? 'test-message' : 'error-line'} role="status">
          <span>{check.message}</span>
          {check.detail ? (
            <details>
              <summary>{t('technicalDetails')}</summary>
              <pre>{check.detail}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="test-message" role="status">{message}</p> : null}
      <div className="katago-custom-engine-card__active">
        <span>{t('customEngineActive')}</span>
        <code>{profile.katagoBin || '—'}</code>
        <code>{profile.katagoModel || '—'}</code>
        <code>{profile.katagoConfig || '—'}</code>
        {customNotes.map((note) => <small key={note}>{note}</small>)}
        {saved.katagoCustomModel ? <small>{t('customEnginePresetIgnored')}</small> : null}
      </div>
    </section>
  )
}
