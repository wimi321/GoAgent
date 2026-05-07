import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { TeacherRunResult, TtsSynthesisResult } from '@main/lib/types'
import './tts.css'

interface TeacherSpeechControlsProps {
  markdown: string
  result?: TeacherRunResult
  autoPlay?: boolean
  disabled?: boolean
}

type PlaybackState = 'idle' | 'synthesizing' | 'playing' | 'paused' | 'error'

export function TeacherSpeechControls({ markdown, result, autoPlay = false, disabled = false }: TeacherSpeechControlsProps): ReactElement {
  const [state, setState] = useState<PlaybackState>('idle')
  const [message, setMessage] = useState('')
  const [lastAudio, setLastAudio] = useState<TtsSynthesisResult | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoPlayedRef = useRef('')

  async function synthesizeAndPlay(): Promise<void> {
    const text = result?.structuredResult?.summary || result?.structured?.summary || markdown
    if (!text.trim() || disabled) return
    stopAudio()
    setState('synthesizing')
    setMessage('正在生成本地语音…')
    try {
      const audio = await window.goagent.synthesizeTts({ text, readMode: 'summary', format: 'wav' })
      const element = new Audio(audio.audioDataUrl)
      audioRef.current = element
      element.onended = () => setState('idle')
      element.onerror = () => {
        setState('error')
        setMessage('语音播放失败。')
      }
      setLastAudio(audio)
      setState('playing')
      setMessage(audio.cached ? '播放缓存语音' : '播放新生成语音')
      await element.play()
    } catch (cause) {
      setState('error')
      setMessage(String(cause))
    }
  }

  function stopAudio(): void {
    const element = audioRef.current
    if (element) {
      element.pause()
      element.currentTime = 0
      audioRef.current = null
    }
    setState('idle')
  }

  function pauseAudio(): void {
    audioRef.current?.pause()
    setState('paused')
  }

  async function resumeAudio(): Promise<void> {
    if (!audioRef.current) return
    setState('playing')
    await audioRef.current.play()
  }

  useEffect(() => {
    const key = result?.id || markdown.slice(0, 120)
    if (!autoPlay || disabled || autoPlayedRef.current === key || !markdown.trim()) return
    autoPlayedRef.current = key
    void synthesizeAndPlay()
    return () => stopAudio()
  }, [autoPlay, disabled, result?.id, markdown])

  return (
    <div className="ga-tts-controls" aria-label="老师语音朗读">
      <button type="button" onClick={() => void synthesizeAndPlay()} disabled={disabled || state === 'synthesizing'}>播放</button>
      <button type="button" onClick={pauseAudio} disabled={disabled || state !== 'playing'}>暂停</button>
      <button type="button" onClick={() => void resumeAudio()} disabled={disabled || state !== 'paused'}>继续</button>
      <button type="button" onClick={stopAudio} disabled={disabled || state === 'idle'}>停止</button>
      {lastAudio ? <small>{lastAudio.provider} · {lastAudio.cached ? '缓存' : '新语音'}</small> : null}
      {message ? <small className={state === 'error' ? 'is-error' : ''}>{message}</small> : null}
    </div>
  )
}
