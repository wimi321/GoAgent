import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { AppSettings, TeacherRunResult, TtsSynthesisResult } from '@main/lib/types'
import './tts.css'

interface TeacherSpeechControlsProps {
  markdown: string
  result?: TeacherRunResult
  readMode?: AppSettings['ttsReadMode']
  autoPlay?: boolean
  disabled?: boolean
}

type PlaybackState = 'idle' | 'synthesizing' | 'playing' | 'paused' | 'error'

export function TeacherSpeechControls({ markdown, result, readMode = 'full', autoPlay = false, disabled = false }: TeacherSpeechControlsProps): ReactElement {
  const [state, setState] = useState<PlaybackState>('idle')
  const [message, setMessage] = useState('')
  const [lastAudio, setLastAudio] = useState<TtsSynthesisResult | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoPlayedRef = useRef('')
  const runIdRef = useRef(0)
  const synthLockRef = useRef(false)
  const playbackDoneRef = useRef<(() => void) | null>(null)

  function speechSourceText(): string {
    if (readMode === 'selection') {
      const selected = window.getSelection()?.toString().trim()
      if (selected) return selected
    }
    return markdown
  }

  function splitProgressiveSpeech(text: string, maxChars = 220): string[] {
    const normalized = text.replace(/\r/g, '').replace(/\n{2,}/g, '。\n').replace(/\s+/g, ' ').trim()
    if (!normalized) return []
    const sentences = normalized.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) ?? [normalized]
    const chunks: string[] = []
    let current = ''
    const push = (): void => {
      const trimmed = current.trim()
      if (trimmed) chunks.push(trimmed)
      current = ''
    }
    for (const sentence of sentences) {
      const part = sentence.trim()
      if (!part) continue
      if (part.length > maxChars) {
        push()
        const smaller = part.match(/[^，,、：:]+[，,、：:]?/g) ?? [part]
        let fragment = ''
        for (const item of smaller) {
          const trimmed = item.trim()
          if (!trimmed) continue
          if (fragment && fragment.length + trimmed.length > maxChars) {
            chunks.push(fragment.trim())
            fragment = ''
          }
          if (trimmed.length > maxChars) {
            for (let index = 0; index < trimmed.length; index += maxChars) {
              chunks.push(trimmed.slice(index, index + maxChars))
            }
          } else {
            fragment += trimmed
          }
        }
        if (fragment.trim()) chunks.push(fragment.trim())
        continue
      }
      if (current && current.length + part.length > maxChars) push()
      current += part
    }
    push()
    return chunks
  }

  async function synthesizeAndPlay(): Promise<void> {
    if (synthLockRef.current || state === 'synthesizing' || state === 'playing') return
    const text = speechSourceText()
    if (!text.trim() || disabled) return
    synthLockRef.current = true
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    disposeAudio()
    const chunks = splitProgressiveSpeech(text)
    if (!chunks.length) {
      synthLockRef.current = false
      return
    }
    setState('synthesizing')
    setMessage(chunks.length > 1 ? `正在生成第 1 / ${chunks.length} 段语音…` : '正在生成本地语音…')
    try {
      const firstAudio = await synthesizeChunk(chunks[0], runId, 0, chunks.length)
      if (runIdRef.current !== runId) return
      synthLockRef.current = false
      await playProgressiveChunks(chunks, firstAudio, runId)
    } catch (cause) {
      if (runIdRef.current !== runId) return
      setState('error')
      setMessage(String(cause))
    } finally {
      if (runIdRef.current === runId) synthLockRef.current = false
    }
  }

  async function synthesizeChunk(chunk: string, runId: number, index: number, total: number, silent = false): Promise<TtsSynthesisResult> {
    if (runIdRef.current !== runId) throw new Error('语音播放已停止。')
    if (total > 1 && !silent) setMessage(`正在生成第 ${index + 1} / ${total} 段语音…`)
    return window.goagent.synthesizeTts({ text: chunk, readMode: 'selection', format: 'wav' })
  }

  async function playProgressiveChunks(chunks: string[], firstAudio: TtsSynthesisResult, runId: number): Promise<void> {
    let currentAudio = firstAudio
    const prefetchChunk = (index: number): Promise<TtsSynthesisResult | Error | null> =>
      synthesizeChunk(chunks[index], runId, index, chunks.length, true).catch((error: unknown) => {
        if (runIdRef.current !== runId) return null
        return error instanceof Error ? error : new Error(String(error))
      })
    let nextAudioPromise: Promise<TtsSynthesisResult | Error | null> | null = chunks.length > 1
      ? prefetchChunk(1)
      : null

    for (let index = 0; index < chunks.length; index += 1) {
      if (runIdRef.current !== runId) return
      setLastAudio(currentAudio)
      if (index + 1 < chunks.length && !nextAudioPromise) {
        nextAudioPromise = prefetchChunk(index + 1)
      }
      await playAudio(currentAudio, runId, currentAudio.cached, index, chunks.length)
      if (runIdRef.current !== runId) return
      if (index + 1 >= chunks.length) {
        setState('idle')
        setMessage(chunks.length > 1 ? '语音播放完成' : '')
        return
      }
      setState('synthesizing')
      setMessage(`正在衔接第 ${index + 2} / ${chunks.length} 段语音…`)
      const nextAudio = await nextAudioPromise
      if (!nextAudio || runIdRef.current !== runId) return
      if (nextAudio instanceof Error) throw nextAudio
      currentAudio = nextAudio
      nextAudioPromise = index + 2 < chunks.length
        ? prefetchChunk(index + 2)
        : null
    }
  }

  async function playAudio(audio: TtsSynthesisResult, runId: number, cached: boolean, index = 0, total = 1): Promise<void> {
    const element = new Audio(audio.audioDataUrl)
    audioRef.current = element
    await new Promise<void>((resolve, reject) => {
      playbackDoneRef.current = resolve
      element.onended = () => {
        playbackDoneRef.current = null
        resolve()
      }
      element.onerror = () => {
        playbackDoneRef.current = null
        reject(new Error('语音播放失败。'))
      }
      setState('playing')
      const prefix = total > 1 ? `播放第 ${index + 1} / ${total} 段` : '播放'
      setMessage(`${prefix}${cached ? '缓存语音' : '新生成语音'}`)
      element.play().catch((error: unknown) => {
        playbackDoneRef.current = null
        reject(error)
      })
    })
  }

  function disposeAudio(): void {
    const element = audioRef.current
    if (element) {
      element.pause()
      element.currentTime = 0
      element.onended = null
      element.onerror = null
      audioRef.current = null
    }
    playbackDoneRef.current?.()
    playbackDoneRef.current = null
  }

  function stopAudio(): void {
    runIdRef.current += 1
    synthLockRef.current = false
    disposeAudio()
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
      <button type="button" onClick={() => void synthesizeAndPlay()} disabled={disabled || state === 'synthesizing' || state === 'playing'}>播放</button>
      <button type="button" onClick={pauseAudio} disabled={disabled || state !== 'playing'}>暂停</button>
      <button type="button" onClick={() => void resumeAudio()} disabled={disabled || state !== 'paused'}>继续</button>
      <button type="button" onClick={stopAudio} disabled={disabled || state === 'idle'}>停止</button>
      {lastAudio ? <small>{lastAudio.provider} · {lastAudio.cached ? '缓存' : '新语音'}</small> : null}
      {message ? <small className={state === 'error' ? 'is-error' : ''}>{message}</small> : null}
    </div>
  )
}
