import type { LibraryGame, StoneColor } from '@main/lib/types'

const COMMON_KOMI = [7.5, 6.5, 5.5, 0.5, 0]

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function trimNumber(value: number, digits = 2): string {
  return round(value, digits).toFixed(digits).replace(/\.?0+$/, '')
}

function normalizedEncodedKomiCandidateScore(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 20) {
    return Number.POSITIVE_INFINITY
  }
  const commonDistance = Math.min(...COMMON_KOMI.map((komi) => Math.abs(komi - value)))
  const fractional = Math.abs(value - Math.floor(value))
  const halfPointBonus = Math.abs(fractional - 0.5) < 0.001 ? -2 : 0
  const integerBonus = fractional < 0.001 ? -0.5 : 0
  const highKomiPenalty = value > 10 ? 4 : 0
  return commonDistance + halfPointBonus + integerBonus + highKomiPenalty
}

export function normalizeSgfKomi(raw: string | number | undefined, fallback = 7.5): number {
  const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw || fallback))
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  if (Math.abs(parsed) <= 20 || !Number.isInteger(parsed)) {
    return parsed
  }

  const encodedCandidates = [parsed / 50, parsed / 100]
    .map((value) => ({ value, score: normalizedEncodedKomiCandidateScore(value) }))
    .sort((left, right) => left.score - right.score)
  const best = encodedCandidates[0]
  return best && Number.isFinite(best.score) ? best.value : parsed
}

export function komiSummary(raw: string | number | undefined): {
  raw: string
  normalized: number
  text: string
  note?: string
} {
  const rawText = String(raw ?? '')
  const normalized = normalizeSgfKomi(rawText)
  const text = `贴目 ${trimNumber(normalized, 2)}`
  const parsed = Number.parseFloat(rawText)
  const note = Number.isFinite(parsed) && Math.abs(parsed - normalized) > 0.001
    ? `SGF 原始 KM[${rawText}] 是平台编码，KataGo 分析使用归一后的 ${trimNumber(normalized, 2)}。`
    : undefined
  return { raw: rawText, normalized: round(normalized, 2), text, note }
}

function colorName(color: StoneColor): string {
  return color === 'B' ? '黑' : '白'
}

function parseResult(result: string | undefined): { winner?: StoneColor; margin?: number; special?: string } {
  const raw = String(result ?? '').trim()
  const numeric = raw.match(/^([BW])\+(\d+(?:\.\d+)?)$/i)
  if (numeric) {
    return {
      winner: numeric[1].toUpperCase() as StoneColor,
      margin: Number.parseFloat(numeric[2])
    }
  }
  const special = raw.match(/^([BW])\+([A-Z]+)$/i)
  if (special) {
    return {
      winner: special[1].toUpperCase() as StoneColor,
      special: special[2].toUpperCase()
    }
  }
  return {}
}

function specialResultLabel(code: string): string {
  if (code === 'R') return '中盘胜'
  if (code === 'T') return '超时胜'
  return `胜（${code}）`
}

export function gameResultSummary(
  game: Pick<LibraryGame, 'result' | 'source'>
): {
  raw: string
  text: string
  sourceKind: 'sgf-record'
  confidence: 'recorded-result' | 'unparsed' | 'missing'
  winner?: StoneColor
  rawMargin?: number
  displayLeadPoints?: number
  displayLeadText?: string
  teacherText?: string
  displayLeadUnit?: 'points'
  comparisonLeadPoints?: number
  foxAreaCountMargin?: number
  foxAreaPointDifference?: number
  note?: string
} {
  const raw = String(game.result ?? '').trim()
  if (!raw) {
    return { raw, text: '棋谱未记录终局结果', sourceKind: 'sgf-record', confidence: 'missing' }
  }
  const parsed = parseResult(raw)
  if (!parsed.winner) {
    return { raw, text: `棋谱记录结果：${raw}`, sourceKind: 'sgf-record', confidence: 'unparsed' }
  }
  if (typeof parsed.margin === 'number' && Number.isFinite(parsed.margin)) {
    const displayLeadPoints = game.source === 'fox' ? parsed.margin * 2 : parsed.margin
    const displayLeadText = `${colorName(parsed.winner)}+${trimNumber(displayLeadPoints, 2)}`
    const teacherText = `${colorName(parsed.winner)}领先 ${trimNumber(displayLeadPoints, 2)} 目`
    const text = game.source === 'fox'
      ? `棋谱记录：${colorName(parsed.winner)}领先 ${trimNumber(displayLeadPoints, 2)} 目（Fox 原始结果 ${raw}）`
      : `棋谱记录：${colorName(parsed.winner)}领先 ${trimNumber(displayLeadPoints, 2)} 目`
    const note = game.source === 'fox'
      ? 'Fox 数字结果是平台记录口径；和 KataGo/LizzieYzy 风格的目差比较时使用 displayLeadPoints，不要把原始 B+22.75 直接说成 22.75 目差。'
      : '棋谱结果是终局记录，不是 KataGo 当前局面估值。'
    return {
      raw,
      text,
      sourceKind: 'sgf-record',
      confidence: 'recorded-result',
      winner: parsed.winner,
      rawMargin: round(parsed.margin, 2),
      displayLeadPoints: round(displayLeadPoints, 2),
      displayLeadText,
      teacherText,
      displayLeadUnit: 'points',
      comparisonLeadPoints: round(displayLeadPoints, 2),
      foxAreaCountMargin: game.source === 'fox' ? round(parsed.margin, 2) : undefined,
      foxAreaPointDifference: game.source === 'fox' ? round(displayLeadPoints, 2) : undefined,
      note
    }
  }
  const label = parsed.special ? specialResultLabel(parsed.special) : '胜'
  return {
    raw,
    text: `棋谱记录：${colorName(parsed.winner)}${label}`,
    teacherText: `${colorName(parsed.winner)}${label}`,
    sourceKind: 'sgf-record',
    confidence: 'recorded-result',
    winner: parsed.winner,
    note: '棋谱结果是终局记录，不是 KataGo 当前局面估值。'
  }
}
