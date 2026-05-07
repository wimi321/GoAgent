import type { TeacherRunResult, TtsReadMode } from '@main/lib/types'

const COORDINATE_PATTERN = /\b([A-HJ-T])(\d{1,2})\b/g

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
