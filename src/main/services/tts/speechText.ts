import type { AppSettings, TeacherRunResult, TtsReadMode } from '@main/lib/types'

const COORDINATE_PATTERN = /\b([A-HJ-T])\s*(\d{1,2})\b/gi
type SpeechLanguage = AppSettings['reviewLanguage'] | 'unknown'
type CoordinateLetterMode = 'latin' | 'localized'

interface SpeechTextOptions {
  coordinateLetterMode?: CoordinateLetterMode
}

const COORDINATE_LETTER_SPEECH: Record<string, string> = {
  A: '诶',
  B: '比',
  C: '西',
  D: '迪',
  E: '衣',
  F: '艾弗',
  G: '吉',
  H: '艾尺',
  J: '杰',
  K: '凯',
  L: '艾勒',
  M: '艾姆',
  N: '恩',
  O: '欧',
  P: '批',
  Q: '丘',
  R: '阿尔',
  S: '艾斯',
  T: '替'
}

const ENGLISH_TERM_SPEECH: Record<string, string> = {
  ai: 'AI',
  byo: '读秒',
  byoyomi: '读秒',
  gpt: 'GPT',
  joseki: '定式',
  katago: '卡塔狗',
  komi: '贴目',
  ko: '劫',
  llm: 'LLM',
  openai: 'OpenAI',
  pv: 'PV',
  scorelead: '目差',
  scoreloss: '目差损失',
  sgf: 'SGF',
  sente: '先手',
  gote: '后手',
  tesuji: '手筋',
  winrate: '胜率',
  winrateloss: '胜率损失'
}

const LATIN_CHAR_SPEECH: Record<string, string> = {
  a: '诶',
  b: '比',
  c: '西',
  d: '迪',
  e: '衣',
  f: '艾弗',
  g: '吉',
  h: '艾尺',
  i: '艾',
  j: '杰',
  k: '凯',
  l: '艾勒',
  m: '艾姆',
  n: '恩',
  o: '欧',
  p: '批',
  q: '丘',
  r: '阿尔',
  s: '艾斯',
  t: '替',
  u: '优',
  v: '维',
  w: '达不溜',
  x: '艾克斯',
  y: '歪',
  z: '贼德',
  '+': '加',
  '#': '井号',
  '.': '点',
  '-': '杠',
  '_': '下划线'
}

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

function coordinateLetterForSpeech(letter: string, mode: CoordinateLetterMode): string {
  const normalized = letter.toUpperCase()
  if (mode === 'latin') return normalized
  return COORDINATE_LETTER_SPEECH[normalized] ?? normalized
}

export function normalizeGoCoordinatesForSpeech(text: string, options: SpeechTextOptions = {}): string {
  const mode = options.coordinateLetterMode ?? 'latin'
  return text.replace(COORDINATE_PATTERN, (_match, letter: string, number: string) => {
    const letterName = coordinateLetterForSpeech(letter, mode)
    const numberName = numberToChinese(Number(number))
    return mode === 'latin' ? `${letterName} ${numberName}` : `${letterName}${numberName}`
  })
}

function numberToChinese(value: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (!Number.isInteger(value) || value < 0 || value > 99) return String(value)
  if (value < 10) return digits[value]
  if (value === 10) return '十'
  if (value < 20) return `十${digits[value % 10]}`
  const tens = Math.floor(value / 10)
  const ones = value % 10
  return ones === 0 ? `${digits[tens]}十` : `${digits[tens]}十${digits[ones]}`
}

export function normalizeTechnicalTermsForSpeech(text: string, options: SpeechTextOptions = {}): string {
  const mode = options.coordinateLetterMode ?? 'latin'
  return text
    .replace(/\bwinrateLoss\s*=\s*([0-9.]+)/gi, '胜率损失约 $1 个百分点')
    .replace(/\bscoreLoss\s*=\s*([0-9.]+)/gi, '目差损失约 $1 目')
    .replace(/([0-9]+(?:\.[0-9]+)?)\s*%/g, '百分之$1')
    .replace(/\b([A-HJ-T])(?=\s*[点处位])/g, (_match, letter: string) => {
      const spoken = coordinateLetterForSpeech(letter, mode)
      return mode === 'latin' ? `${spoken} ` : spoken
    })
    .replace(/\b[A-Za-z][A-Za-z0-9+#._-]*\b/g, (token) => latinTokenToSpeech(token, mode))
}

function latinTokenToSpeech(token: string, coordinateLetterMode: CoordinateLetterMode = 'localized'): string {
  if (coordinateLetterMode === 'latin' && /^[A-HJ-T]$/i.test(token)) {
    return token.toUpperCase()
  }
  const normalized = token.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const known = ENGLISH_TERM_SPEECH[normalized]
  if (known) return known
  if (/^[A-Za-z]+(?:[-_][A-Za-z]+)+$/.test(token)) {
    return token.replace(/[-_]+/g, ' ')
  }
  if (/^[A-Za-z]{2,}$/.test(token)) {
    return token
  }
  return [...token].map((char) => {
    if (/\d/.test(char)) return numberToChinese(Number(char))
    return LATIN_CHAR_SPEECH[char.toLowerCase()] ?? char
  }).join('')
}

export function markdownToSpeechText(markdown: string, options: SpeechTextOptions = {}): string {
  const normalizedOptions: Required<SpeechTextOptions> = {
    coordinateLetterMode: options.coordinateLetterMode ?? 'latin'
  }
  const stripped = markdown
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
    .replace(/(^|\s)#{1,6}(?=\s|$)/g, '$1')
    .replace(/#/g, '')
  return normalizeTechnicalTermsForSpeech(normalizeGoCoordinatesForSpeech(stripped, normalizedOptions), normalizedOptions)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function limitSpeechLength(text: string, maxChars = 900): string {
  const cleaned = text.trim()
  if (cleaned.length <= maxChars) return cleaned
  return `${cleaned.slice(0, maxChars).replace(/[，。；,.!?！？][^，。；,.!?！？]*$/, '')}。后面的细节可以在文字复盘中继续看。`
}

export function teacherResultToSpeechText(result: TeacherRunResult | undefined, markdown: string, mode: TtsReadMode): string {
  void result
  const cleaned = markdownToSpeechText(markdown)
  if (mode === 'full') return limitSpeechLength(cleaned, 12000)
  if (mode === 'selection') return limitSpeechLength(cleaned, 6000)
  return limitSpeechLength(cleaned, 5000)
}
