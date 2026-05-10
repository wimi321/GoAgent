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
  { id: 'volcengine-doubao', label: '火山引擎 · 豆包语音', badge: '云端', note: '使用火山引擎豆包语音合成，只有你显式选择后才会发送朗读文本。' },
  { id: 'custom-openai-compatible', label: 'OpenAI 兼容语音 API', badge: '自定义', note: '仅在你显式选择后发送文本到配置的服务。' },
  { id: 'custom-http-json', label: 'HTTP JSON 语音 API', badge: '高级', note: '适配自建或第三方 JSON 语音服务。' },
  { id: 'external-local-service', label: '本地语音服务', badge: '高级', note: '只连接 localhost / 127.0.0.1。' }
]

const VOLCENGINE_VOICES: TtsVoice[] = [
  { id: 'zh_female_xiaohe_uranus_bigtts', label: '小何 2.0 · 温和讲解女声', language: 'zh-CN', provider: 'volcengine-doubao' },
  { id: 'zh_female_vv_uranus_bigtts', label: 'Vivi 2.0 · 清亮自然女声', language: 'zh-CN', provider: 'volcengine-doubao' },
  { id: 'zh_male_m191_uranus_bigtts', label: '云舟 2.0 · 沉稳男声', language: 'zh-CN', provider: 'volcengine-doubao' },
  { id: 'zh_male_taocheng_uranus_bigtts', label: '小天 2.0 · 年轻男声', language: 'zh-CN', provider: 'volcengine-doubao' }
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
  if (provider === 'volcengine-doubao') return { text: '保存后可测试火山语音', tone: 'warn' }
  if (provider !== 'kokoro-bundled') return { text: '等待保存并测试自定义引擎', tone: 'warn' }
  if (!status) return { text: '正在读取本地语音资源', tone: 'warn' }
  return status.ready ? { text: '本地语音已就绪', tone: 'ready' } : { text: '本地语音资源未就绪', tone: 'warn' }
}

function defaultVoiceForProvider(provider: TtsProviderId, settings: AppSettings): string {
  if (provider === 'volcengine-doubao') return settings.ttsVolcengineSpeaker || VOLCENGINE_VOICES[0].id
  if (provider === 'kokoro-bundled') return settings.ttsVoiceId || 'zf_001'
  return settings.ttsCustomVoice || settings.ttsVoiceId || 'default'
}

interface SecretFieldProps {
  name: string
  label: string
  placeholder: string
  loadSaved?: () => Promise<{ hasKey: boolean; value: string }>
  onMessage?: (message: string) => void
}

function SecretField({ name, label, placeholder, loadSaved, onMessage }: SecretFieldProps): ReactElement {
  const [visible, setVisible] = useState(false)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  async function toggleVisible(): Promise<void> {
    if (visible) {
      setVisible(false)
      return
    }
    if (!value.trim() && loadSaved) {
      setLoading(true)
      try {
        const saved = await loadSaved()
        if (saved.hasKey && saved.value) {
          setValue(saved.value)
          onMessage?.(`${label} 已从本机安全存储读取，可以核对后保存。`)
        } else {
          onMessage?.(`本机还没有保存 ${label}。`)
        }
      } catch (cause) {
        onMessage?.(`${label} 读取失败：${String(cause)}`)
      } finally {
        setLoading(false)
      }
    }
    setVisible(true)
  }

  return (
    <label className="ga-tts-secret-field">
      <span>{label}</span>
      <div className="ga-tts-secret-input">
        <input
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="button" onClick={() => void toggleVisible()} disabled={loading} aria-label={`${visible ? '隐藏' : '显示'}${label}`}>
          {loading ? '读取中' : visible ? '隐藏' : '显示'}
        </button>
      </div>
    </label>
  )
}

export function TtsSettingsPanel({ settings, busy = false, onSave }: TtsSettingsPanelProps): ReactElement {
  const [assetStatus, setAssetStatus] = useState<TtsAssetStatus | null>(null)
  const [voices, setVoices] = useState<TtsVoice[]>([])
  const [message, setMessage] = useState('')
  const [testing, setTesting] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<TtsProviderId>(settings.ttsProvider)
  const [selectedLanguage, setSelectedLanguage] = useState<AppSettings['ttsLanguage']>(settings.ttsLanguage)
  const [selectedVoiceId, setSelectedVoiceId] = useState(defaultVoiceForProvider(settings.ttsProvider, settings))
  const [selectedVolcengineAuthMode, setSelectedVolcengineAuthMode] = useState<AppSettings['ttsVolcengineAuthMode']>(settings.ttsVolcengineAuthMode || 'api-key')
  const [selectedReadMode, setSelectedReadMode] = useState<AppSettings['ttsReadMode']>(settings.ttsReadMode || 'full')
  const [enabled, setEnabled] = useState(settings.ttsEnabled)
  const [rate, setRate] = useState(settings.ttsRate || 1)
  const [volume, setVolume] = useState(settings.ttsVolume || 1)
  const status = useMemo(() => statusLabel(assetStatus, selectedProvider, enabled), [assetStatus, enabled, selectedProvider])
  const showVolcengineApi = selectedProvider === 'volcengine-doubao'
  const showCustomApi = selectedProvider !== 'kokoro-bundled' && !showVolcengineApi
  const visibleVoices = useMemo(() => {
    if (showVolcengineApi) {
      const custom = settings.ttsVolcengineSpeaker && !VOLCENGINE_VOICES.some((voice) => voice.id === settings.ttsVolcengineSpeaker)
        ? [{ id: settings.ttsVolcengineSpeaker, label: `${settings.ttsVolcengineSpeaker} · 自定义音色`, language: settings.ttsLanguage, provider: 'volcengine-doubao' as const }]
        : []
      return [...custom, ...VOLCENGINE_VOICES]
    }
    return voices
  }, [settings.ttsLanguage, settings.ttsVolcengineSpeaker, showVolcengineApi, voices])

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
    setSelectedVoiceId(defaultVoiceForProvider(settings.ttsProvider, settings))
    setSelectedVolcengineAuthMode(settings.ttsVolcengineAuthMode || 'api-key')
    setSelectedReadMode(settings.ttsReadMode || 'full')
    setEnabled(settings.ttsEnabled)
    setRate(settings.ttsRate || 1)
    setVolume(settings.ttsVolume || 1)
  }, [settings])

  useEffect(() => {
    setSelectedVoiceId(defaultVoiceForProvider(selectedProvider, settings))
  }, [selectedProvider])

  useEffect(() => { void refresh() }, [settings.ttsProvider, settings.ttsLanguage])

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next: Partial<AppSettings> = {
      ttsEnabled: data.get('ttsEnabled') === 'on',
      ttsAutoPlay: data.get('ttsAutoPlay') === 'on',
      ttsProvider: selectedProvider,
      ttsLanguage: selectedLanguage,
      ttsVoiceId: selectedVoiceId,
      ttsRate: Number(data.get('ttsRate') || 1),
      ttsPitch: settings.ttsPitch,
      ttsVolume: Number(data.get('ttsVolume') || 1),
      ttsReadMode: selectedReadMode
    }
    if (showVolcengineApi) {
      next.ttsVolcengineEndpoint = String(data.get('ttsVolcengineEndpoint') || '')
      next.ttsVolcengineAuthMode = selectedVolcengineAuthMode
      if (selectedVolcengineAuthMode === 'legacy-token') {
        next.ttsVolcengineAppId = String(data.get('ttsVolcengineAppId') || '')
        next.ttsVolcengineAccessToken = String(data.get('ttsVolcengineAccessToken') || '')
      } else {
        next.ttsVolcengineApiKey = String(data.get('ttsVolcengineApiKey') || '')
      }
      next.ttsVolcengineResourceId = String(data.get('ttsVolcengineResourceId') || '')
      next.ttsVolcengineSpeaker = selectedVoiceId || String(data.get('ttsVolcengineSpeaker') || '')
      next.ttsVolcengineModel = String(data.get('ttsVolcengineModel') || '')
      next.ttsVolcengineSampleRate = Number(data.get('ttsVolcengineSampleRate') || 24000)
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
                onChange={() => {
                  setSelectedProvider(provider.id)
                  setSelectedVoiceId(defaultVoiceForProvider(provider.id, settings))
                }}
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
            <p>{showVolcengineApi ? '火山引擎音色来自豆包语音，若控制台音色不同，可在下方填写自定义 speaker。' : showCustomApi ? '自定义引擎会使用下方 API 配置。' : assetStatus?.detail ?? '读取内置 Kokoro 中文语音资源。'}</p>
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
            <select name="ttsVoiceId" value={selectedVoiceId} onChange={(event) => setSelectedVoiceId(event.target.value)}>
              {visibleVoices.length ? visibleVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.label} · {voice.id}</option>) : <option value={settings.ttsVoiceId}>{settings.ttsVoiceId || '未加载声音'}</option>}
            </select>
            {showVolcengineApi ? <small className="ga-tts-field-note">下拉项后半段是火山 speaker ID，方便和控制台核对。</small> : null}
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
                <input
                  name="ttsReadMode"
                  type="radio"
                  value={value}
                  checked={selectedReadMode === value}
                  onChange={() => setSelectedReadMode(value as AppSettings['ttsReadMode'])}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        </div>
      </section>

      {showVolcengineApi ? (
        <section className="ga-tts-card ga-tts-card--advanced">
          <details open>
            <summary>火山引擎配置</summary>
            <fieldset className="ga-tts-segment">
              <legend>鉴权方式</legend>
              <label>
                <input
                  name="ttsVolcengineAuthMode"
                  type="radio"
                  value="api-key"
                  checked={selectedVolcengineAuthMode === 'api-key'}
                  onChange={() => setSelectedVolcengineAuthMode('api-key')}
                />
                <span>新版 API Key</span>
              </label>
              <label>
                <input
                  name="ttsVolcengineAuthMode"
                  type="radio"
                  value="legacy-token"
                  checked={selectedVolcengineAuthMode === 'legacy-token'}
                  onChange={() => setSelectedVolcengineAuthMode('legacy-token')}
                />
                <span>旧版 APP ID + Access Token</span>
              </label>
            </fieldset>
            <div className="ga-tts-grid">
              <label><span>Endpoint</span><input name="ttsVolcengineEndpoint" defaultValue={settings.ttsVolcengineEndpoint} placeholder="https://openspeech.bytedance.com/api/v3/tts/unidirectional" /></label>
              {selectedVolcengineAuthMode === 'api-key' ? (
                <SecretField
                  name="ttsVolcengineApiKey"
                  label="API Key"
                  placeholder="留空表示不修改已保存 API Key"
                  onMessage={setMessage}
                  loadSaved={async () => {
                    const saved = await window.goagent.getSavedVolcengineTtsApiKey()
                    return { hasKey: saved.hasKey, value: saved.apiKey }
                  }}
                />
              ) : (
                <>
                  <label><span>APP ID</span><input name="ttsVolcengineAppId" defaultValue={settings.ttsVolcengineAppId} placeholder="火山控制台 APP ID" /></label>
                  <SecretField
                    name="ttsVolcengineAccessToken"
                    label="Access Token"
                    placeholder="留空表示不修改已保存 Access Token"
                    onMessage={setMessage}
                    loadSaved={async () => {
                      const saved = await window.goagent.getSavedVolcengineTtsAccessToken()
                      return { hasKey: saved.hasKey, value: saved.accessToken }
                    }}
                  />
                </>
              )}
              <label><span>Resource ID</span><input name="ttsVolcengineResourceId" defaultValue={settings.ttsVolcengineResourceId} placeholder="seed-tts-2.0" /></label>
              <label><span>自定义 speaker</span><input name="ttsVolcengineSpeaker" value={selectedVoiceId} onChange={(event) => setSelectedVoiceId(event.target.value)} placeholder="zh_female_vv_uranus_bigtts" /></label>
              <label><span>Model</span><input name="ttsVolcengineModel" defaultValue={settings.ttsVolcengineModel} placeholder="seed-tts-2.0-standard" /></label>
              <label><span>采样率</span><select name="ttsVolcengineSampleRate" defaultValue={String(settings.ttsVolcengineSampleRate || 24000)}><option value="24000">24000 Hz</option><option value="32000">32000 Hz</option><option value="44100">44100 Hz</option><option value="48000">48000 Hz</option></select></label>
            </div>
            <p className="ga-tts-message">GoAgent 使用火山 HTTP Chunked V3 接口。新版控制台填 API Key；旧控制台如果显示 APP ID / Access Token / Secret Key，请选择旧版鉴权，只填 APP ID 和 Access Token，Secret Key 不用于这个接口。Resource ID 请填控制台已授权的资源，常见为 seed-tts-2.0。</p>
          </details>
        </section>
      ) : null}

      {showCustomApi ? (
        <section className="ga-tts-card ga-tts-card--advanced">
          <details open>
            <summary>自定义 API</summary>
            <div className="ga-tts-grid">
              <label><span>Base URL / Endpoint</span><input name="ttsCustomBaseUrl" defaultValue={settings.ttsCustomBaseUrl} placeholder="https://example.com/v1" /></label>
              <SecretField
                name="ttsCustomApiKey"
                label="API Key"
                placeholder="留空表示不修改已保存密钥"
                onMessage={setMessage}
                loadSaved={async () => {
                  const saved = await window.goagent.getSavedTtsApiKey()
                  return { hasKey: saved.hasKey, value: saved.apiKey }
                }}
              />
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
