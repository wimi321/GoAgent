const EVIDENCE_LABELS = [
  'KataGo 数据',
  'KataGo 证据',
  '实战',
  'AI 首选',
  '首选',
  '胜率损失',
  '胜率差',
  '目差损失',
  '搜索置信度',
  '首选参考',
  '另一个接近选择',
  '候选点',
  '参考变化',
  '搜索量',
  '访问数',
  'visits',
  'winrate',
  'scoreLead'
]

const EVIDENCE_LABEL_PATTERN = new RegExp(`(?:${EVIDENCE_LABELS.map(escapeRegExp).join('|')})\\s*[：:]`, 'gi')

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripMarkdownForSpeechChunking(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)、]\s+/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/(^|\s)#{1,6}(?=\s|$)/g, '$1')
    .replace(/#/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitEvidenceItems(line: string): string[] {
  const matches = [...line.matchAll(EVIDENCE_LABEL_PATTERN)]
  if (matches.length <= 1) return [line]
  const parts: string[] = []
  const prefix = line.slice(0, matches[0].index).trim()
  if (prefix) parts.push(prefix)
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0
    const end = index + 1 < matches.length ? matches[index + 1].index ?? line.length : line.length
    const part = line.slice(start, end).trim()
    if (part) parts.push(part)
  }
  return parts
}

function finishSpeechItem(item: string): string {
  let line = item.replace(/\s+/g, ' ').trim()
  if (!line) return ''
  if (/[：:]\s*$/.test(line)) line = line.replace(/[：:]\s*$/, '。')
  if (!/[。！？!?；;]$/.test(line)) line += '。'
  return line
}

function splitLongSpeechItem(item: string, maxChars: number): string[] {
  if (item.length <= maxChars) return [item]
  const chunks: string[] = []
  const sentences = item.match(/[^。！？!?；;]+[。！？!?；;]?/g) ?? [item]
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
      for (const itemPart of smaller) {
        const trimmed = itemPart.trim()
        if (!trimmed) continue
        if (fragment && fragment.length + trimmed.length > maxChars) {
          chunks.push(fragment.trim())
          fragment = ''
        }
        if (trimmed.length > maxChars) {
          for (let index = 0; index < trimmed.length; index += maxChars) chunks.push(trimmed.slice(index, index + maxChars))
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

function splitParagraphSpeech(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\n{2,}/g, '。\n').replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const sentences = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/g) ?? [normalized]
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
      chunks.push(...splitLongSpeechItem(part, maxChars))
      continue
    }
    if (current && current.length + part.length > maxChars) push()
    current += part
  }
  push()
  return chunks
}

function packSpeechItems(items: string[], maxChars: number): string[] {
  const chunks: string[] = []
  let current = ''
  const push = (): void => {
    const trimmed = current.trim()
    if (trimmed) chunks.push(trimmed)
    current = ''
  }
  for (const item of items) {
    const parts = splitLongSpeechItem(item, maxChars)
    for (const part of parts) {
      const separator = current ? '\n' : ''
      if (current && current.length + separator.length + part.length > maxChars) push()
      current = current ? `${current}\n${part}` : part
    }
  }
  push()
  return chunks
}

export function splitProgressiveSpeech(text: string, maxChars = 220): string[] {
  const prepared = stripMarkdownForSpeechChunking(text.replace(/\r/g, ''))
  if (!prepared) return []
  const lines = prepared.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const lineItems = lines.flatMap(splitEvidenceItems).map(finishSpeechItem).filter(Boolean)
  const hasEvidenceList = lines.length > 1 || lines.some((line) => splitEvidenceItems(line).length > 1)
  if (hasEvidenceList) return packSpeechItems(lineItems, maxChars)
  return splitParagraphSpeech(prepared, maxChars)
}
