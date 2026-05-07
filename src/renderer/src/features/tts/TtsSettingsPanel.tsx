import type { FormEvent, ReactElement } from 'react'
import { useEffect, useState } from 'react'
import type { AppSettings, TtsAssetStatus, TtsProviderId, TtsVoice } from '@main/lib/types'
import './tts.css'

interface TtsSettingsPanelProps {
  settings: AppSettings
  busy?: boolean
  onSave: (next: Partial<AppSettings>) => Promise<void> | void
}

const PROVIDERS: Array<{ id: TtsProviderId; label: string; note: string }> = [
  { id: 'kokoro-bundled', label: 'Kokoro 中文离线语音', note: '默认。本机离线，不调用 API。' },
  { id: 'custom-openai-compatible', label: '自定义 OpenAI-compatible TTS API', note: '显式选择后才发送文本到配置服务。' },
  { id: 'custom-http-json', label: '自定义 HTTP JSON TTS API', note: '适配用户自建服务。' },
  { id: 'external-local-service', label: '外部本地 TTS 服务', note: '仅允许 localhost / 127.0.0.1。' }
]

export function TtsSettingsPanel({ settings, busy = false, onSave }: TtsSettingsPanelProps): ReactElement {
  const [assetStatus, setAssetStatus] = useState<TtsAssetStatus | null>(null)
  const [voices, setVoices] = useState<TtsVoice[]>([])
  const [message, setMessage] = useState('')
  const [testing, setTesting] = useState(false)

  async function refresh(): Promise<void> {
    setMessage('')
    try {
      setAssetStatus(await window.goagent.inspectTtsAssets())
      setVoices(await window.goagent.listTtsVoices())
    } catch (cause) {
      setMessage(`TTS 状态读取失败：${String(cause)}`)
    }
  }

  useEffect(() => { void refresh() }, [settings.ttsProvider, settings.ttsLanguage])

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await onSave({
      ttsEnabled: data.get('ttsEnabled') === 'on',
      ttsAutoPlay: data.get('ttsAutoPlay') === 'on',
      ttsProvider: String(data.get('ttsProvider')) as TtsProviderId,
      ttsLanguage: String(data.get('ttsLanguage')) as AppSettings['ttsLanguage'],
      ttsVoiceId: String(data.get('ttsVoiceId') || settings.ttsVoiceId),
      ttsRate: Number(data.get('ttsRate') || 1),
      ttsPitch: Number(data.get('ttsPitch') || 1),
      ttsVolume: Number(data.get('ttsVolume') || 1),
      ttsReadMode: String(data.get('ttsReadMode')) as AppSettings['ttsReadMode'],
      ttsCustomBaseUrl: String(data.get('ttsCustomBaseUrl') || ''),
      ttsCustomApiKey: String(data.get('ttsCustomApiKey') || ''),
      ttsCustomModel: String(data.get('ttsCustomModel') || ''),
      ttsCustomVoice: String(data.get('ttsCustomVoice') || ''),
      ttsCustomHeadersJson: String(data.get('ttsCustomHeadersJson') || ''),
      ttsCustomBodyTemplate: String(data.get('ttsCustomBodyTemplate') || ''),
      ttsCustomResponseType: String(data.get('ttsCustomResponseType') || 'audio-bytes') as AppSettings['ttsCustomResponseType'],
      ttsCustomAudioJsonPath: String(data.get('ttsCustomAudioJsonPath') || '')
    })
    await refresh()
  }

  async function testSpeech(): Promise<void> {
    setTesting(true)
    setMessage('')
    try {
      const result = await window.goagent.testTtsSettings({})
      const audio = new Audio(result.audioDataUrl)
      await audio.play()
      setMessage(`测试成功：${result.provider}`)
    } catch (cause) {
      setMessage(`测试失败：${String(cause)}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <form className="ga-tts-settings" onSubmit={(event) => void save(event)}>
      <h3>语音朗读</h3>
      <p>GoAgent 使用显式选择的 TTS 引擎。当前引擎不可用时只显示错误，不自动切换到其它引擎。</p>
      <label><input name="ttsEnabled" type="checkbox" defaultChecked={settings.ttsEnabled} /> 启用语音</label>
      <label><input name="ttsAutoPlay" type="checkbox" defaultChecked={settings.ttsAutoPlay} /> 老师回答完成后自动播放</label>
      <label>引擎
        <select name="ttsProvider" defaultValue={settings.ttsProvider}>
          {PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
        </select>
      </label>
      <label>语言
        <select name="ttsLanguage" defaultValue={settings.ttsLanguage}>
          {['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR', 'th-TH', 'vi-VN'].map((language) => <option key={language} value={language}>{language}</option>)}
        </select>
      </label>
      <label>声音
        <select name="ttsVoiceId" defaultValue={settings.ttsVoiceId}>
          {voices.length ? voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>) : <option value={settings.ttsVoiceId}>{settings.ttsVoiceId || '未加载声音'}</option>}
        </select>
      </label>
      <label>语速 <input name="ttsRate" type="number" step="0.05" min="0.5" max="1.8" defaultValue={settings.ttsRate} /></label>
      <label>音量 <input name="ttsVolume" type="number" step="0.05" min="0" max="1" defaultValue={settings.ttsVolume} /></label>
      <label>朗读内容
        <select name="ttsReadMode" defaultValue={settings.ttsReadMode}>
          <option value="summary">摘要</option>
          <option value="full">完整讲解</option>
          <option value="selection">选中文本</option>
        </select>
      </label>
      <details>
        <summary>自定义 API 设置</summary>
        <input name="ttsCustomBaseUrl" defaultValue={settings.ttsCustomBaseUrl} placeholder="Base URL / Endpoint" />
        <input name="ttsCustomApiKey" type="password" placeholder="API Key（留空表示不修改）" />
        <input name="ttsCustomModel" defaultValue={settings.ttsCustomModel} placeholder="Model" />
        <input name="ttsCustomVoice" defaultValue={settings.ttsCustomVoice} placeholder="Voice" />
        <textarea name="ttsCustomHeadersJson" defaultValue={settings.ttsCustomHeadersJson} placeholder='{"X-Api-Key":"..."}' />
        <textarea name="ttsCustomBodyTemplate" defaultValue={settings.ttsCustomBodyTemplate} placeholder='{"text":"{{text}}","voice":"{{voice}}"}' />
        <select name="ttsCustomResponseType" defaultValue={settings.ttsCustomResponseType}><option value="audio-bytes">audio bytes</option><option value="json-audio-url">json audio url</option><option value="json-base64">json base64</option></select>
        <input name="ttsCustomAudioJsonPath" defaultValue={settings.ttsCustomAudioJsonPath} placeholder="audio" />
      </details>
      {assetStatus ? <p className={assetStatus.ready ? 'is-ready' : 'is-error'}>{assetStatus.detail}</p> : null}
      {message ? <p>{message}</p> : null}
      <button type="button" onClick={() => void refresh()} disabled={busy}>刷新语音状态</button>
      <button type="button" onClick={() => void testSpeech()} disabled={busy || testing}>{testing ? '测试中' : '测试朗读'}</button>
      <button type="submit" disabled={busy}>保存语音设置</button>
    </form>
  )
}
