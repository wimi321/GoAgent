import type { AppSettings, TeacherRunResult, TtsReadMode } from '@main/lib/types'

const COORDINATE_PATTERN = /\b([A-HJ-T])(\d{1,2})\b/g
type SpeechLanguage = AppSettings['reviewLanguage'] | 'unknown'

const LANGUAGE_LABELS: Record<SpeechLanguage, string> = {
  'zh-CN': '中文',
  'zh-TW': '中文',
  'en-US': '英语',
  'ja-JP': '日语',
  'ko-KR': '韩语',
  'th-TH': '泰语',
  'vi-VN': '越南语',
  unknown: '未知语言'
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

export function detectSpeechLanguage(text: string): SpeechLanguage {
  const sample = text.replace(/\s+/g, ' ').trim()
  if (!sample) return 'unknown'
  const kana = countMatches(sample, /[\u3040-\u30ff]/g)
  const hangul = countMatches(sample, /[\uac00-\ud7af]/g)
  const thai = countMatches(sample, /[\u0e00-\u0e7f]/g)
  const han = countMatches(sample, /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g)
  const vietnamese = countMatches(sample, /[ăâđêôơưĂÂĐÊÔƠƯàáạảãầấậẩẫằắặẳẵèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/g)
  const latin = countMatches(sample, /[A-Za-z]/g)
  if (kana >= 2) return 'ja-JP'
  if (hangul >= 2) return 'ko-KR'
  if (thai >= 2) return 'th-TH'
  if (vietnamese >= 2) return 'vi-VN'
  if (han >= 2) return 'zh-CN'
  if (latin >= 8) return 'en-US'
  return 'unknown'
}

export function speechLanguageMatches(text: string, expected: AppSettings['ttsLanguage']): boolean {
  const detected = detectSpeechLanguage(text)
  if (detected === 'unknown') return true
  if ((detected === 'zh-CN' || detected === 'zh-TW') && (expected === 'zh-CN' || expected === 'zh-TW')) return true
  return detected === expected
}

export function assertSpeechLanguageMatches(text: string, expected: AppSettings['ttsLanguage']): void {
  const detected = detectSpeechLanguage(text)
  if (detected === 'unknown') return
  if (speechLanguageMatches(text, expected)) return
  throw new Error(`TTS 语言不匹配：当前文本主要是${LANGUAGE_LABELS[detected]}，但选择的语音包是 ${expected}。请切换老师输出语言/TTS 语言，或安装对应离线语音包/显式选择自定义 TTS API。`)
}

export function normalizeGoCoordinatesForSpeech(text: string): string {
  return text.replace(COORDINATE_PATTERN, (_match, letter: string, number: string) => `${letter} ${number}`)
}

export function markdownToSpeechText(markdown: string): string {
  return normalizeGoCoordinatesForSpeech(markdown)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/sourceRefs?:\s*[^\n]+/gi, '')
    .replace(/evidenceRefs?:\s*[^\n]+/gi, '')
    .replace(/\bPV\b/g, '参考变化')
    .replace(/winrateLoss\s*=\s*([0-9.]+)/gi, '胜率损失约 $1 个百分点')
    .replace(/scoreLoss\s*=\s*([0-9.]+)/gi, '目差损失约 $1 目')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function limitSpeechLength(text: string, maxChars = 900): string {
  const cleaned = text.trim()
  if (cleaned.length <= maxChars) return cleaned
  return `${cleaned.slice(0, maxChars).replace(/[，。；,.!?！？][^，。；,.!?！？]*$/, '')}。后面的细节可以在文字复盘中继续看。`
}

export function teacherResultToSpeechText(result: TeacherRunResult | undefined, markdown: string, mode: TtsReadMode): string {
  if (mode === 'full') return limitSpeechLength(markdownToSpeechText(markdown), 2400)
  const structured = result?.structuredResult ?? result?.structured
  const parts = [
    structured?.headline,
    structured?.summary,
    structured?.keyMistakes?.slice(0, 2).map((item) => item.explanation).join('。'),
    structured?.correctThinking?.slice(0, 2).join('。'),
    structured?.drills?.slice(0, 1).join('。')
  ].filter((part): part is string => Boolean(part && part.trim()))
  const base = parts.length ? parts.join('。') : markdown
  return limitSpeechLength(markdownToSpeechText(base), 900)
}
