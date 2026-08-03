import type {
  AppSettings,
  GameMove,
  ZhiziGpuType,
  ZhiziKataName,
  ZhiziKataWeight
} from '@main/lib/types'

export type ZhiziGtpAnalysisResponse = Record<string, unknown> & {
  id?: string
  error?: string
  isDuringSearch?: boolean
  rootInfo?: {
    currentPlayer?: GameMove['color']
    winrate?: number
    scoreLead?: number
    scoreMean?: number
  }
  moveInfos?: Array<Record<string, unknown>>
}

const GTP_VALUE_KEYS = new Set([
  'move',
  'visits',
  'edgeVisits',
  'utility',
  'winrate',
  'scoreMean',
  'scoreStdev',
  'scoreLead',
  'scoreSelfplay',
  'prior',
  'lcb',
  'utilityLcb',
  'weight',
  'noResultValue',
  'order',
  'pv',
  'pvVisits',
  'isSymmetryOf',
  'ownership',
  'ownershipStdev',
  'rootInfo'
])

export const ZHIZI_GPU_TYPES = ['vip-share', '1x', '3x', '6x', '12x', '24x'] as const
export const ZHIZI_KATA_NAMES = ['katago-TENSORRT', 'katago-CUDA'] as const
export const ZHIZI_KATA_WEIGHTS = ['18bnbt', 'fdx', '28bnbt'] as const

function allowedValue<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback
}

export function buildZhiziRemoteArgs(
  settings: Pick<AppSettings, 'zhiziGpuType' | 'zhiziKataName' | 'zhiziKataWeight'>
): string {
  const gpuType = allowedValue<ZhiziGpuType>(settings.zhiziGpuType, ZHIZI_GPU_TYPES, 'vip-share')
  const kataName = allowedValue<ZhiziKataName>(settings.zhiziKataName, ZHIZI_KATA_NAMES, 'katago-TENSORRT')
  const kataWeight = allowedValue<ZhiziKataWeight>(settings.zhiziKataWeight, ZHIZI_KATA_WEIGHTS, '28bnbt')
  return [
    '--platform', 'all',
    '--engine-type', 'go',
    '--gpu-type', gpuType,
    '--kata-name', kataName,
    '--kata-weight', kataWeight
  ].join(' ')
}

export interface GtpCommandResponse {
  id: number
  ok: boolean
  firstLine: string
}

export function formatGtpCommand(id: number, command: string): string {
  return `${Math.max(1, Math.trunc(id))} ${command.trim()}\n`
}

export function parseGtpCommandResponses(text: string): GtpCommandResponse[] {
  const responses: GtpCommandResponse[] = []
  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const match = rawLine.match(/^([=?])(\d+)(?:\s+(.*))?$/)
    if (!match) continue
    responses.push({
      id: Number(match[2]),
      ok: match[1] === '=',
      firstLine: match[3] ?? ''
    })
  }
  return responses
}

export function findGtpCommandResponse(text: string, id: number): GtpCommandResponse | undefined {
  return parseGtpCommandResponses(text).find((response) => response.id === id)
}

function normalizeRate(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (Math.abs(value) > 1.00001) return value / 10000
  return value
}

function numericToken(tokens: string[], index: number): number | undefined {
  const value = Number(tokens[index])
  return Number.isFinite(value) ? value : undefined
}

function parseKeyValues(text: string): Record<string, number> {
  const tokens = text.split(/\s+/).filter(Boolean)
  const values: Record<string, number> = {}
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const key = tokens[index]
    const value = numericToken(tokens, index + 1)
    if (value === undefined) continue
    values[key] = key === 'winrate' || key === 'prior' || key === 'lcb'
      ? normalizeRate(value)
      : value
    index += 1
  }
  return values
}

export function parseKataAnalyzeInfo(
  text: string,
  player: GameMove['color'],
  id: string
): ZhiziGtpAnalysisResponse {
  const completeLines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /\binfo\s+/.test(line))
  const latestFrame = completeLines[completeLines.length - 1] ?? text
  const compact = latestFrame
    .replace(/\r/g, '\n')
    .replace(/^=.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  const rootInfoText = compact.match(/\brootInfo\s+(.+?)(?:\s+ownership\s+|$)/)?.[1] ?? ''
  const rootInfo = parseKeyValues(rootInfoText)
  const segments = compact.split(/\binfo\s+/).map((segment) => segment.trim()).filter(Boolean)
  const moveInfos: Array<Record<string, unknown>> = []

  for (const segment of segments) {
    const moveSegment = segment.split(/\brootInfo\b/)[0]
    const tokens = moveSegment.split(/\s+/).filter(Boolean)
    const info: Record<string, unknown> = {}
    for (let index = 0; index < tokens.length; index += 1) {
      const key = tokens[index]
      if (!GTP_VALUE_KEYS.has(key)) continue
      if (key === 'rootInfo' || key === 'ownership' || key === 'ownershipStdev') break
      if (key === 'pv') {
        const pv: string[] = []
        for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
          if (GTP_VALUE_KEYS.has(tokens[cursor])) break
          pv.push(tokens[cursor])
          index = cursor
        }
        info.pv = pv.slice(0, 24)
        continue
      }
      if (key === 'pvVisits') {
        const pvVisits: number[] = []
        for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
          if (GTP_VALUE_KEYS.has(tokens[cursor])) break
          const value = Number(tokens[cursor])
          if (Number.isFinite(value)) pvVisits.push(value)
          index = cursor
        }
        info.pvVisits = pvVisits.slice(0, 24)
        continue
      }
      if (key === 'move' || key === 'isSymmetryOf') {
        info[key] = tokens[index + 1] ?? ''
        index += 1
        continue
      }
      const value = numericToken(tokens, index + 1)
      if (value !== undefined) {
        info[key] = key === 'winrate' || key === 'prior' || key === 'lcb'
          ? normalizeRate(value)
          : value
        index += 1
      }
    }
    if (typeof info.move === 'string' && info.move) moveInfos.push(info)
  }

  moveInfos.sort((left, right) => Number(left.order ?? 9999) - Number(right.order ?? 9999))
  const best = moveInfos[0]
  if (!best) {
    return {
      id,
      error: '智子云 KataGo GTP 没有返回候选点。',
      rootInfo: { currentPlayer: player, winrate: 0.5, scoreLead: 0 },
      moveInfos: []
    }
  }
  return {
    id,
    rootInfo: {
      currentPlayer: player,
      winrate: Number(rootInfo.winrate ?? best.winrate ?? 0.5),
      scoreLead: Number(rootInfo.scoreLead ?? rootInfo.scoreMean ?? best.scoreLead ?? best.scoreMean ?? 0),
      scoreMean: Number(rootInfo.scoreMean ?? rootInfo.scoreLead ?? best.scoreMean ?? best.scoreLead ?? 0)
    },
    moveInfos
  }
}

export function zhiziResponseVisitTotal(response: ZhiziGtpAnalysisResponse): number {
  return (response.moveInfos ?? []).reduce((sum, move) => {
    const visits = Number(move.visits ?? 0)
    return sum + (Number.isFinite(visits) && visits > 0 ? visits : 0)
  }, 0)
}

export function zhiziAnalysisReachedVisits(
  response: ZhiziGtpAnalysisResponse,
  targetVisits: number
): boolean {
  return zhiziResponseVisitTotal(response) >= Math.max(1, Math.round(targetVisits))
}
