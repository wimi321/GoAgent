import type { KataGoMoveAnalysis } from '@main/lib/types'
import { boardPointLabel, type BoardPoint } from './boardGeometry'

export type TerritoryDisplayMode = 'heat' | 'blocks' | 'marks'
export type TerritoryOwner = 'B' | 'W'
export type TerritorySource = 'root' | 'best-continuation' | 'unavailable'
export type TerritoryConfidence = 'high' | 'medium' | 'low' | 'missing'

export interface TerritoryCell extends BoardPoint {
  owner: TerritoryOwner
  value: number
  strength: number
  label: string
}

export interface TerritoryRegionSummary {
  id: string
  label: string
  owner: TerritoryOwner | 'unclear'
  average: number
  points: string[]
}

export interface TerritoryJudgement {
  available: boolean
  source: TerritorySource
  confidence: TerritoryConfidence
  boardSize: number
  moveNumber?: number
  scoreLead?: number
  leadText: string
  blackStrong: number
  whiteStrong: number
  unsettled: number
  blackInfluence: number
  whiteInfluence: number
  blackShare: number
  cells: TerritoryCell[]
  regions: TerritoryRegionSummary[]
  note: string
}

const OWNERSHIP_VISUAL_THRESHOLD = 0.055
const STRONG_OWNERSHIP_THRESHOLD = 0.52
const UNSETTLED_THRESHOLD = 0.24

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function validOwnership(value: unknown, boardSize: number): number[] | null {
  if (!Array.isArray(value) || value.length < boardSize * boardSize) {
    return null
  }
  const numbers = value.slice(0, boardSize * boardSize).map((item) => Number(item))
  return numbers.every((item) => Number.isFinite(item)) ? numbers : null
}

function ownershipSource(analysis: KataGoMoveAnalysis | null | undefined, boardSize: number): { source: TerritorySource; ownership: number[] | null } {
  const root = validOwnership(analysis?.after.ownership, boardSize)
  if (root) {
    return { source: 'root', ownership: root }
  }
  const beforeRoot = analysis?.moveNumber === 0 ? validOwnership(analysis?.before.ownership, boardSize) : null
  if (beforeRoot) {
    return { source: 'root', ownership: beforeRoot }
  }
  const bestContinuation =
    validOwnership(analysis?.after.topMoves?.[0]?.ownership, boardSize) ??
    validOwnership(analysis?.before.topMoves?.[0]?.ownership, boardSize)
  return { source: bestContinuation ? 'best-continuation' : 'unavailable', ownership: bestContinuation }
}

function confidenceFor(input: {
  source: TerritorySource
  analysis?: KataGoMoveAnalysis | null
  unsettled: number
  boardSize: number
}): TerritoryConfidence {
  if (input.source === 'unavailable') {
    return 'missing'
  }
  const bestVisits = Math.max(
    0,
    finite(input.analysis?.after.topMoves?.[0]?.visits) ?? 0,
    finite(input.analysis?.before.topMoves?.[0]?.visits) ?? 0,
    finite(input.analysis?.analysisQuality?.bestVisits) ?? 0
  )
  const unsettledRatio = input.unsettled / Math.max(1, input.boardSize * input.boardSize)
  if (input.source === 'root' && bestVisits >= 700 && unsettledRatio < 0.42) {
    return 'high'
  }
  if (input.source === 'root' && bestVisits >= 220) {
    return 'medium'
  }
  if (input.source === 'best-continuation' && bestVisits >= 500) {
    return 'medium'
  }
  return 'low'
}

function leadText(scoreLead: number | undefined): string {
  if (typeof scoreLead !== 'number' || !Number.isFinite(scoreLead)) {
    return '待分析'
  }
  if (Math.abs(scoreLead) < 0.05) {
    return '均势'
  }
  return `${scoreLead > 0 ? '黑' : '白'}领先 ${Math.abs(scoreLead).toFixed(1)}目`
}

function regionFor(point: BoardPoint, boardSize: number): string {
  const third = boardSize / 3
  const twoThirds = boardSize - third
  if (point.x >= third && point.x < twoThirds && point.y >= third && point.y < twoThirds) return 'center'
  const horizontal = point.x < boardSize / 2 ? 'left' : 'right'
  const vertical = point.y < boardSize / 2 ? 'top' : 'bottom'
  return `${vertical}-${horizontal}`
}

function regionLabel(id: string): string {
  const labels: Record<string, string> = {
    'top-left': '左上',
    'top-right': '右上',
    'bottom-left': '左下',
    'bottom-right': '右下',
    center: '中腹'
  }
  return labels[id] ?? id
}

function buildRegions(cells: TerritoryCell[], boardSize: number): TerritoryRegionSummary[] {
  const buckets = new Map<string, TerritoryCell[]>()
  for (const cell of cells) {
    const id = regionFor(cell, boardSize)
    const bucket = buckets.get(id) ?? []
    bucket.push(cell)
    buckets.set(id, bucket)
  }
  return Array.from(buckets.entries()).map(([id, bucket]) => {
    const average = bucket.reduce((sum, cell) => sum + cell.value, 0) / Math.max(1, bucket.length)
    const owner: TerritoryRegionSummary['owner'] = Math.abs(average) < 0.18 ? 'unclear' : average > 0 ? 'B' : 'W'
    return {
      id,
      label: regionLabel(id),
      owner,
      average: Math.round(average * 100) / 100,
      points: bucket
        .slice()
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 3)
        .map((cell) => cell.label)
    }
  }).sort((a, b) => Math.abs(b.average) - Math.abs(a.average)).slice(0, 5)
}

export function buildTerritoryJudgement(analysis: KataGoMoveAnalysis | null | undefined, boardSizeInput = 19): TerritoryJudgement {
  const boardSize = Math.max(2, Math.round(boardSizeInput || analysis?.boardSize || 19))
  const { source, ownership } = ownershipSource(analysis, boardSize)
  const scoreLead = finite(analysis?.after.scoreLead)
  if (!ownership) {
    return {
      available: false,
      source: 'unavailable',
      confidence: 'missing',
      boardSize,
      moveNumber: analysis?.moveNumber,
      scoreLead,
      leadText: leadText(scoreLead),
      blackStrong: 0,
      whiteStrong: 0,
      unsettled: 0,
      blackInfluence: 0,
      whiteInfluence: 0,
      blackShare: 50,
      cells: [],
      regions: [],
      note: '当前分析没有 ownership 数据。请加深当前手分析后再看形势判断。'
    }
  }

  let blackStrong = 0
  let whiteStrong = 0
  let unsettled = 0
  let blackInfluence = 0
  let whiteInfluence = 0
  const cells: TerritoryCell[] = []
  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const value = clamp(Number(ownership[y * boardSize + x] ?? 0), -1, 1)
      const strength = Math.abs(value)
      if (value >= STRONG_OWNERSHIP_THRESHOLD) blackStrong += 1
      if (value <= -STRONG_OWNERSHIP_THRESHOLD) whiteStrong += 1
      if (strength <= UNSETTLED_THRESHOLD) unsettled += 1
      if (value > 0) blackInfluence += value
      if (value < 0) whiteInfluence += Math.abs(value)
      if (strength >= OWNERSHIP_VISUAL_THRESHOLD) {
        const point = { x, y }
        cells.push({
          ...point,
          owner: value >= 0 ? 'B' : 'W',
          value,
          strength,
          label: boardPointLabel(point, boardSize)
        })
      }
    }
  }
  const totalInfluence = blackInfluence + whiteInfluence
  const confidence = confidenceFor({ source, analysis, unsettled, boardSize })
  return {
    available: true,
    source,
    confidence,
    boardSize,
    moveNumber: analysis?.moveNumber,
    scoreLead,
    leadText: leadText(scoreLead),
    blackStrong,
    whiteStrong,
    unsettled,
    blackInfluence: Math.round(blackInfluence * 10) / 10,
    whiteInfluence: Math.round(whiteInfluence * 10) / 10,
    blackShare: totalInfluence > 0 ? Math.round((blackInfluence / totalInfluence) * 100) : 50,
    cells,
    regions: buildRegions(cells, boardSize),
    note: source === 'root'
      ? '基于 KataGo 当前局面的 ownership。'
      : '当前没有 root ownership，暂用一选后续作为参考，不能当作实战最终归属。'
  }
}
