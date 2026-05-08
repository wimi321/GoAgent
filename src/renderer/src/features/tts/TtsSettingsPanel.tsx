import type { FormEvent, ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { AppSettings, TtsAssetStatus, TtsProviderId, TtsVoice } from '@main/lib/types'
import './tts.css'

interface TtsSettingsPanelProps {
  settings: AppSettings
  busy?: boolean
  onSave: (next: Partial<AppSettings>) => Promise<void> | void
}

const PROVIDERS: Array<{ id: TtsProviderId; label: string; badge: string; note: string }> = [
  { id: 'kokoro-bundled', label: 'Kokoro 中文离线语音', badge: '推荐', note: '本机合成老师讲解，不发送到外部服务。' },
  { id: 'custom-openai-compatible', label: 'OpenAI 兼容语音 API', badge: '自定义', note: '仅在你显式选择后发送文本到配置的服务。' },
  { id: 'custom-http-json', label: 'HTTP JSON 语音 API', badge: '高级', note: '适配自建或第三方 JSON 语音服务。' },
  { id: 'external-local-service', label: '本地语音服务', badge: '高级', note: '只连接 localhost / 127.0.0.1。' }
]

const LANGUAGES: Array<{ value: AppSettings['ttsLanguage']; label: string; note: string }> = [
  { value: 'zh-CN', label: '简体中文', note: '内置' },
  { value: 'zh-TW', label: '繁體中文', note: '可选包' },
  { value: 'en-US', label: 'English', note: '可选包' },
  { value: 'ja-JP', label: '日本語', note: '可选包' },
  { value: 'ko-KR', label: '한국어', note: '可选包' },
  { value: 'th-TH', label: 'ไทย', note: '可选包' },
  { value: 'vi-VN', label: 'Tiếng Việt', note: '可选包' }
]

function providerNote(providerId: TtsProviderId): string {
  return PROVIDERS.find((provider) => provider.id === providerId)?.note ?? ''
}

function statusLabel(status: TtsAssetStatus | null, provider: TtsProviderId, enabled: boolean): { text: string; tone: 'ready' | 'warn' | 'off' } {
  if (!enabled) return { text: '语音已关闭', tone: 'off' }
  if (provider !== 'kokoro-bundled') return { text: '等待保存并测试自定义引擎', tone: 'warn' }
  if (!status) return { text: '正在读取本地语音资源', tone: 'warn' }
  return status.ready ? { text: '本地语音已就绪', tone: 'ready' } : { text: '本地语音资源未就绪', tone: 'warn' }
}

export function TtsSettingsPanel({ settings, busy = false, onSave }: TtsSettingsPanelProps): ReactElement {
  const [assetStatus, setAssetStatus] = useState<TtsAssetStatus | null>(null)
  const [voices, setVoices] = useState<TtsVoice[]>([])
  const [message, setMessage] = useState('')
  const [testing, setTesting] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<TtsProviderId>(settings.ttsProvider)
  const [selectedLanguage, setSelectedLanguage] = useState<AppSettings['ttsLanguage']>(settings.ttsLanguage)
  const [enabled, setEnabled] = useState(settings.ttsEnabled)
  const [rate, setRate] = useState(settings.ttsRate || 1)
  const [volume, setVolume] = useState(settings.ttsVolume || 1)
  const status = useMemo(() => statusLabel(assetStatus, selectedProvider, enabled), [assetStatus, enabled, selectedProvider])
  const showCustomApi = selectedProvider !== 'kokoro-bundled'

  async function refresh(): Promise<void> {
    setMessage('')
    try {
      const [nextStatus, nextVoices] = await Promise.all([
        window.goagent.inspectTtsAssets(),
        window.goagent.listTtsVoices()
      ])
      setAssetStatus(nextStatus)
      setVoices(nextVoices)
    } catch (cause) {
      setMessage(`语音状态读取失败：${String(cause)}`)
    }
  }

  useEffect(() => {
    setSelectedProvider(settings.ttsProvider)
    setSelectedLanguage(settings.ttsLanguage)
    setEnabled(settings.ttsEnabled)
    setRate(settings.ttsRate || 1)
    setVolume(settings.ttsVolume || 1)
  }, [settings.ttsEnabled, settings.ttsLanguage, settings.ttsProvider, settings.ttsRate, settings.ttsVolume])

  useEffect(() => { void refresh() }, [settings.ttsProvider, settings.ttsLanguage])

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next: Partial<AppSettings> = {
      ttsEnabled: data.get('ttsEnabled') === 'on',
      ttsAutoPlay: data.get('ttsAutoPlay') === 'on',
      ttsProvider: selectedProvider,
      ttsLanguage: selectedLanguage,
      ttsVoiceId: String(data.get('ttsVoiceId') || settings.ttsVoiceId),
      ttsRate: Number(data.get('ttsRate') || 1),
      ttsPitch: settings.ttsPitch,
      ttsVolume: Number(data.get('ttsVolume') || 1),
      ttsReadMode: String(data.get('ttsReadMode')) as AppSettings['ttsReadMode']
    }
    if (showCustomApi) {
      next.ttsCustomBaseUrl = String(data.get('ttsCustomBaseUrl') || '')
      next.ttsCustomApiKey = String(data.get('ttsCustomApiKey') || '')
      next.ttsCustomModel = String(data.get('ttsCustomModel') || '')
      next.ttsCustomVoice = String(data.get('ttsCustomVoice') || '')
      next.ttsCustomHeadersJson = String(data.get('ttsCustomHeadersJson') || '')
      next.ttsCustomBodyTemplate = String(data.get('ttsCustomBodyTemplate') || '')
      next.ttsCustomResponseType = String(data.get('ttsCustomResponseType') || 'audio-bytes') as AppSettings['ttsCustomResponseType']
      next.ttsCustomAudioJsonPath = String(data.get('ttsCustomAudioJsonPath') || '')
    }
    await onSave(next)
    await refresh()
  }

  async function testSpeech(): Promise<void> {
    setTesting(true)
    setMessage('')
    try {
      const result = await window.goagent.testTtsSettings({})
      const audio = new Audio(result.audioDataUrl)
      await audio.play()
      setMessage(`测试成功：${result.provider}${result.cached ? ' · 已使用缓存' : ''}`)
    } catch (cause) {
      setMessage(`测试失败：${String(cause)}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <form className="ga-tts-settings" onSubmit={(event) => void save(event)}>
      <section className="ga-tts-hero">
        <div>
          <span className="ga-tts-kicker">Teacher voice</span>
          <h3>语音朗读</h3>
          <p>把老师讲解读出来。GoAgent 只使用你选中的语音引擎，失败时会直接说明原因，不会偷偷切换。</p>
        </div>
        <span className={`ga-tts-status ga-tts-status--${status.tone}`}>{status.text}</span>
      </section>

      <section className="ga-tts-card ga-tts-card--compact">
        <label className="ga-tts-switch">
          <input name="ttsEnabled" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          <span>
            <strong>启用语音</strong>
            <small>在老师回答下方显示播放、暂停和停止。</small>
          </span>
        </label>
        <label className="ga-tts-switch">
          <input name="ttsAutoPlay" type="checkbox" defaultChecked={settings.ttsAutoPlay} />
          <span>
            <strong>回答完成后自动播放</strong>
            <small>适合课堂或投屏讲解；手动播放仍然可用。</small>
          </span>
        </label>
      </section>

      <section className="ga-tts-card">
        <div className="ga-tts-section-head">
          <div>
            <h4>语音引擎</h4>
            <p>{providerNote(selectedProvider)}</p>
          </div>
        </div>
        <div className="ga-tts-provider-grid">
          {PROVIDERS.map((provider) => (
            <label key={provider.id} className={`ga-tts-provider ${selectedProvider === provider.id ? 'is-selected' : ''}`}>
              <input
                name="ttsProvider"
                type="radio"
                value={provider.id}
                checked={selectedProvider === provider.id}
                onChange={() => setSelectedProvider(provider.id)}
              />
              <span className="ga-tts-provider__top">
                <strong>{provider.label}</strong>
                <em>{provider.badge}</em>
              </span>
              <small>{provider.note}</small>
            </label>
          ))}
        </div>
      </section>

      <section className="ga-tts-card">
        <div className="ga-tts-section-head">
          <div>
            <h4>声音与语言</h4>
            <p>{showCustomApi ? '自定义引擎会使用下方 API 配置。' : assetStatus?.detail ?? '读取内置 Kokoro 中文语音资源。'}</p>
          </div>
          <button type="button" className="ga-tts-secondary" onClick={() => void refresh()} disabled={busy}>刷新</button>
        </div>
        <div className="ga-tts-grid">
          <label>
            <span>语言</span>
            <select name="ttsLanguage" value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value as AppSettings['ttsLanguage'])}>
              {LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label} · {language.note}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>声音</span>
            <select name="ttsVoiceId" defaultValue={settings.ttsVoiceId}>
              {voices.length ? voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>) : <option value={settings.ttsVoiceId}>{settings.ttsVoiceId || '未加载声音'}</option>}
            </select>
          </label>
        </div>
      </section>

      <section className="ga-tts-card">
        <div className="ga-tts-section-head">
          <div>
            <h4>播放偏好</h4>
            <p>生成长讲解时会分段衔接，播放期间仍可滚动和操作棋盘。</p>
          </div>
        </div>
        <div className="ga-tts-grid">
          <label className="ga-tts-range">
            <span>语速 <strong>{rate.toFixed(2)}x</strong></span>
            <input name="ttsRate" type="range" step="0.05" min="0.65" max="1.55" value={rate} onChange={(event) => setRate(Number(event.target.value))} />
          </label>
          <label className="ga-tts-range">
            <span>音量 <strong>{Math.round(volume * 100)}%</strong></span>
            <input name="ttsVolume" type="range" step="0.05" min="0" max="1" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          </label>
          <fieldset className="ga-tts-segment">
            <legend>朗读内容</legend>
            {[
              ['full', '完整讲解'],
              ['selection', '选中文本'],
              ['summary', '精简内容']
            ].map(([value, label]) => (
              <label key={value}>
                <input name="ttsReadMode" type="radio" value={value} defaultChecked={settings.ttsReadMode === value} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        </div>
      </section>

      {showCustomApi ? (
        <section className="ga-tts-card ga-tts-card--advanced">
          <details open>
            <summary>自定义 API</summary>
            <div className="ga-tts-grid">
              <label><span>Base URL / Endpoint</span><input name="ttsCustomBaseUrl" defaultValue={settings.ttsCustomBaseUrl} placeholder="https://example.com/v1" /></label>
              <label><span>API Key</span><input name="ttsCustomApiKey" type="password" placeholder="留空表示不修改已保存密钥" /></label>
              <label><span>Model</span><input name="ttsCustomModel" defaultValue={settings.ttsCustomModel} placeholder="tts-model" /></label>
              <label><span>Voice</span><input name="ttsCustomVoice" defaultValue={settings.ttsCustomVoice} placeholder="voice-id" /></label>
              <label><span>Response</span><select name="ttsCustomResponseType" defaultValue={settings.ttsCustomResponseType}><option value="audio-bytes">audio bytes</option><option value="json-audio-url">json audio url</option><option value="json-base64">json base64</option></select></label>
              <label><span>JSON 音频路径</span><input name="ttsCustomAudioJsonPath" defaultValue={settings.ttsCustomAudioJsonPath} placeholder="audio" /></label>
            </div>
            <label><span>Headers JSON</span><textarea name="ttsCustomHeadersJson" defaultValue={settings.ttsCustomHeadersJson} placeholder='{"X-Api-Key":"..."}' /></label>
            <label><span>Body Template</span><textarea name="ttsCustomBodyTemplate" defaultValue={settings.ttsCustomBodyTemplate} placeholder='{"text":"{{text}}","voice":"{{voice}}"}' /></label>
          </details>
        </section>
      ) : null}

      {message ? <p className={`ga-tts-message ${message.includes('失败') ? 'is-error' : 'is-ready'}`}>{message}</p> : null}

      <div className="ga-tts-actions">
        <button type="button" className="ga-tts-secondary" onClick={() => void testSpeech()} disabled={busy || testing || !enabled}>{testing ? '测试中' : '测试朗读'}</button>
        <button type="submit" className="ga-tts-primary" disabled={busy}>保存语音设置</button>
      </div>
    </form>
  )
}
