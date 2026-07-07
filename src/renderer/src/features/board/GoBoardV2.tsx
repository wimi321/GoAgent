import type { MouseEvent, PointerEvent, ReactElement } from 'react'
import { useMemo, useState } from 'react'
import type { GameRecord, KataGoMoveAnalysis } from '@main/lib/types'
import type { UiTranslator } from '../../i18n'
import {
  candidateVariationMoves,
  getBoardSize,
  moveToColor,
  normalizeWinrate,
  renderCandidates,
  renderPlayedMove,
  renderStones,
  boardPointLabel,
  type BoardPoint,
  type RenderCandidate,
  type RenderKeyMove,
  type RenderPlayedMove,
  type RenderStone,
  type RenderVariationMove
} from './boardGeometry'
import type { CandidateTooltipMove, CandidateTooltipPosition } from './CandidateTooltip'
import type { TrialBranch } from './trialBranch'
import type { TerritoryDisplayMode, TerritoryJudgement, TerritoryOwner } from './territoryJudgement'
import './board-v2.css'

interface GoBoardV2Props {
  record: GameRecord
  moveNumber: number
  analysis?: KataGoMoveAnalysis | null
  keyMoves?: RenderKeyMove[]
  flashPoint?: (BoardPoint & { nonce?: number; label?: string }) | null
  compact?: boolean
  trialBranch?: TrialBranch | null
  territoryJudgement?: TerritoryJudgement | null
  territoryMode?: TerritoryDisplayMode
  onPointClick?: (point: BoardPoint) => void
  onPointContextMenu?: () => void
  onCandidateHover?: (candidate: RenderCandidate | null) => void
  t?: UiTranslator
}

const VIEWBOX = 960
const EDGE = 76
const INNER = VIEWBOX - EDGE * 2
const STAR_CONFIG: Record<number, number[]> = {
  19: [3, 9, 15],
  13: [3, 6, 9],
  9: [2, 4, 6]
}

type HoveredCandidate = {
  candidate: CandidateTooltipMove
  renderCandidate: RenderCandidate
  position: CandidateTooltipPosition
} | null
type BoardHoverEvent = PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement>
type TerritoryStrandedStone = RenderStone & {
  territoryOwner: TerritoryOwner
  strength: number
  territoryLabel: string
}

const STRANDED_STONE_THRESHOLD = 0.68

function valueOf(record: unknown, key: string): unknown {
  return typeof record === 'object' && record !== null ? (record as Record<string, unknown>)[key] : undefined
}

function xy(point: BoardPoint, boardSize: number): { x: number; y: number } {
  const cell = INNER / (boardSize - 1)
  return {
    x: EDGE + point.x * cell,
    y: EDGE + point.y * cell
  }
}

function coordinateLetters(boardSize: number): string[] {
  return 'ABCDEFGHJKLMNOPQRSTUVWXYZ'.slice(0, boardSize).split('')
}

function starPoints(boardSize: number): BoardPoint[] {
  const anchors = STAR_CONFIG[boardSize] ?? (boardSize >= 15 ? [3, Math.floor(boardSize / 2), boardSize - 4] : [2, Math.floor(boardSize / 2), boardSize - 3])
  return anchors.flatMap((x) => anchors.map((y) => ({ x, y })))
}

function toTooltipMove(candidate: RenderCandidate, t: UiTranslator): CandidateTooltipMove {
  const rawPv = valueOf(candidate.raw, 'pv')
  return {
    order: candidate.rank,
    move: String(valueOf(candidate.raw, 'move') ?? candidate.label),
    gtp: String(valueOf(candidate.raw, 'gtp') ?? valueOf(candidate.raw, 'move') ?? candidate.label),
    winrate: candidate.winrateValue ?? valueOf(candidate.raw, 'winrate') as number | undefined,
    scoreLead: candidate.scoreValue ?? valueOf(candidate.raw, 'scoreLead') as number | undefined,
    visits: valueOf(candidate.raw, 'visits') as number | undefined,
    prior: valueOf(candidate.raw, 'prior') as number | undefined,
    pv: Array.isArray(rawPv) ? rawPv.map(String).slice(0, 14) : undefined,
    note: candidate.rank === 1 ? t('boardCandidateTopNote') : undefined
  }
}

function formatCandidateWinrate(candidate: RenderCandidate): string {
  if (candidate.winrateLabel) {
    return candidate.winrateLabel
  }
  const normalized = normalizeWinrate(valueOf(candidate.raw, 'winrate'))
  if (normalized === null) {
    return '—'
  }
  return `${(normalized * 100).toFixed(1)}%`
}

function formatCandidateVisits(candidate: RenderCandidate): string {
  const visits = valueOf(candidate.raw, 'visits')
  if (typeof visits !== 'number' || !Number.isFinite(visits)) {
    return candidate.visitsLabel ?? '—'
  }
  if (visits >= 10000) {
    return `${(visits / 10000).toFixed(visits >= 100000 ? 0 : 1)}w`
  }
  if (visits >= 1000) {
    return `${(visits / 1000).toFixed(visits >= 10000 ? 0 : 1)}k`
  }
  return String(Math.round(visits))
}

function formatVisitsLabel(value: string | undefined): string {
  if (!value) {
    return '—'
  }
  const visits = Number(value)
  if (!Number.isFinite(visits)) {
    return value
  }
  if (visits >= 10000) {
    return `${(visits / 10000).toFixed(visits >= 100000 ? 0 : 1)}w`
  }
  if (visits >= 1000) {
    return `${(visits / 1000).toFixed(visits >= 10000 ? 0 : 1)}k`
  }
  return String(Math.round(visits))
}

function formatCandidateScore(candidate: RenderCandidate): string {
  return candidate.scoreLabel ?? '0.0'
}

function tooltipPosition(point: { x: number; y: number }, svg: SVGSVGElement): CandidateTooltipPosition {
  const rect = svg.getBoundingClientRect()
  const x = (point.x / VIEWBOX) * rect.width + 14
  const y = (point.y / VIEWBOX) * rect.height - 14
  return {
    x: Math.min(Math.max(8, x), Math.max(8, rect.width - 250)),
    y: Math.min(Math.max(8, y), Math.max(8, rect.height - 132))
  }
}

function svgCursorPoint(event: BoardHoverEvent): { x: number; y: number } | null {
  const svg = event.currentTarget
  const matrix = svg.getScreenCTM()?.inverse()
  if (!matrix) {
    return null
  }
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  return point.matrixTransform(matrix)
}

function CandidateMark({
  candidate,
  boardSize,
  active = false
}: {
  candidate: RenderCandidate
  boardSize: number
  active?: boolean
}): ReactElement {
  const p = xy(candidate, boardSize)
  const className = `ks-candidate ks-candidate--${candidate.emphasis} ks-candidate--rank-${candidate.rank}${active ? ' ks-candidate--active' : ''}`
  const scale = candidate.emphasis === 'primary' ? 1.02 : candidate.emphasis === 'secondary' ? 0.96 : 0.9
  const winrate = formatCandidateWinrate(candidate)
  const visits = formatCandidateVisits(candidate)
  const score = formatCandidateScore(candidate)
  return (
    <g
      className={className}
      transform={`translate(${p.x} ${p.y}) scale(${scale})`}
    >
      <circle className="ks-candidate-hitarea" r="34" />
      <circle className="ks-candidate-soft-glow" r="25.8" />
      <circle className="ks-candidate-ring" r="24.2" />
      <circle className="ks-candidate-disc" r="22.8" />
      <circle className="ks-candidate-rank-badge" cx="16.2" cy="-17" r="8.1" />
      <text className="ks-candidate-rank" x="16.2" y="-17">{candidate.rank}</text>
      <text className="ks-candidate-winrate" y="-8.3">{winrate}</text>
      <text className="ks-candidate-visits" y="4.2">{visits}</text>
      <text className="ks-candidate-score" y="15.4">{score}</text>
    </g>
  )
}

function KeyMoveMark({ mark, boardSize }: { mark: RenderKeyMove; boardSize: number }): ReactElement {
  const p = xy(mark, boardSize)
  return (
    <g className={`ks-keymove ks-keymove--${mark.severity}`} transform={`translate(${p.x} ${p.y})`}>
      <circle r="31" />
      <text y="-33">{mark.label}</text>
    </g>
  )
}

function VariationPreview({
  moves,
  boardSize,
  anchor,
  totalMoves
}: {
  moves: RenderVariationMove[]
  boardSize: number
  anchor?: BoardPoint | null
  totalMoves?: number
}): ReactElement | null {
  if (moves.length === 0) {
    return null
  }
  const points = moves.map((move) => xy(move, boardSize))
  const anchorPoint = anchor ? xy(anchor, boardSize) : null
  const pathPoints = anchorPoint ? [anchorPoint, ...points] : points
  const path = pathPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const labelPoint = points[Math.min(points.length - 1, 1)] ?? points[0]

  return (
    <g className="ks-variation-preview-layer">
      {points.length > 1 ? <path className="ks-variation-path" d={path} /> : null}
      {moves.map((move) => {
        const p = xy(move, boardSize)
        const label = move.step > 99 ? '99+' : String(move.step)
        return (
          <g key={`${move.step}-${move.move}`} className={`ks-variation-stone ks-variation-stone--${move.color} ${move.isFirst ? 'ks-variation-stone--first' : ''}`} transform={`translate(${p.x} ${p.y})`}>
            <circle className="ks-variation-stone-shadow" r={move.isFirst ? 19.5 : 17.2} />
            <circle className="ks-variation-stone-body" r={move.isFirst ? 18.3 : 16.2} />
            <text className="ks-variation-stone-number" y="0.6">{label}</text>
          </g>
        )
      })}
      <g className="ks-variation-pv-label" transform={`translate(${Math.min(labelPoint.x + 32, VIEWBOX - 96)} ${Math.max(labelPoint.y - 30, 58)})`}>
        <rect x="-34" y="-13" width="68" height="26" rx="13" />
        <text y="1">PV {totalMoves ?? moves.length}手</text>
      </g>
    </g>
  )
}

function PlayedMoveMark({ played, boardSize, t }: { played: RenderPlayedMove; boardSize: number; t: UiTranslator }): ReactElement {
  const p = xy(played, boardSize)
  const rankLabel = played.rank ? t('rankChoice', { rank: played.rank }) : t('playedMove')
  const loss = Math.max(0, played.winrateLoss ?? 0)
  const severity = loss >= 10 ? 'mistake' : loss >= 4 ? 'inaccuracy' : 'ok'
  return (
    <g className={`ks-played-move ks-played-move--${played.color} ks-played-move--${severity}`} transform={`translate(${p.x} ${p.y})`}>
      <rect className="ks-played-move-frame" x="-29" y="-29" width="58" height="58" rx="9.5" />
      <rect className="ks-played-move-panel" x="-23" y="-20.5" width="46" height="41" rx="8.5" />
      <rect className="ks-played-move-label-bg" x="-27" y="-32.5" width="30" height="13.5" rx="6.75" />
      <text className="ks-played-move-label" x="-12" y="-25.6">{t('playedMove')}</text>
      <text className="ks-played-move-rank" x="13.5" y="-25.6">{rankLabel}</text>
      <text className="ks-played-move-winrate" y="-7.6">{played.winrateLabel ?? '—'}</text>
      <text className="ks-played-move-visits" y="5">{formatVisitsLabel(played.visitsLabel)}</text>
      <text className="ks-played-move-score" y="16.4">{played.scoreLabel ?? '0.0'}</text>
    </g>
  )
}

function PreviousMoveMarker({ color, t }: { color: 'B' | 'W'; t: UiTranslator }): ReactElement {
  return (
    <g className={`ks-previous-move ks-previous-move--${color}`} aria-label={t('boardPreviousMoveLabel')}>
      <rect className="ks-previous-move-shadow" x="-8.2" y="-8.2" width="16.4" height="16.4" rx="3.2" transform="rotate(45)" />
      <rect className="ks-previous-move-gem" x="-7.1" y="-7.1" width="14.2" height="14.2" rx="2.8" transform="rotate(45)" />
      <path className="ks-previous-move-glint" d="M -3.6 -5.4 L 5.2 3.4" />
    </g>
  )
}

function BoardFlashMark({ point, boardSize }: { point: BoardPoint & { label?: string }; boardSize: number }): ReactElement {
  const p = xy(point, boardSize)
  const label = point.label ?? boardPointLabel(point, boardSize)
  return (
    <g className="ks-board-flash" transform={`translate(${p.x} ${p.y})`} aria-label={label}>
      <circle className="ks-board-flash__halo" r="34" />
      <circle className="ks-board-flash__ring" r="27" />
      <circle className="ks-board-flash__core" r="5.2" />
      <g className="ks-board-flash__label" transform="translate(0 -42)">
        <rect x="-19" y="-11" width="38" height="22" rx="11" />
        <text y="0.5">{label}</text>
      </g>
    </g>
  )
}

function TrialStoneMark({ move, boardSize }: { move: TrialBranch['moves'][number]; boardSize: number }): ReactElement {
  const p = xy(move, boardSize)
  const label = move.moveNumber > 99 ? '99+' : String(move.moveNumber)
  return (
    <g className={`ks-trial-stone-mark ks-trial-stone-mark--${move.color}`} transform={`translate(${p.x} ${p.y})`}>
      <circle className="ks-trial-stone-ring" r="28.4" />
      <g className="ks-trial-stone-badge" transform="translate(18 -18)">
        <circle r="10.2" />
        <text y="0.4">{label}</text>
      </g>
    </g>
  )
}

function territoryStrandedStones(stones: RenderStone[], judgement: TerritoryJudgement | null | undefined): TerritoryStrandedStone[] {
  if (!judgement?.available || judgement.cells.length === 0) {
    return []
  }
  const ownershipByPoint = new Map(judgement.cells.map((cell) => [`${cell.x},${cell.y}`, cell]))
  const candidates = stones.flatMap((stone) => {
    const ownership = ownershipByPoint.get(`${stone.x},${stone.y}`)
    if (!ownership || ownership.owner === stone.color || ownership.strength < STRANDED_STONE_THRESHOLD) {
      return []
    }
    return [{
      ...stone,
      territoryOwner: ownership.owner,
      strength: ownership.strength,
      territoryLabel: ownership.label
    }]
  })
  if (candidates.length > Math.max(8, stones.length * 0.32)) {
    return []
  }
  return candidates
}

function TerritoryStrandedStoneMark({ marker, boardSize }: { marker: TerritoryStrandedStone; boardSize: number }): ReactElement {
  const p = xy(marker, boardSize)
  const ownerLabel = marker.territoryOwner === 'B' ? '黑地' : '白地'
  const stoneLabel = marker.color === 'B' ? '黑子' : '白子'
  const markerSize = 8.8 + Math.min(5.2, Math.max(0, marker.strength - STRANDED_STONE_THRESHOLD) * 17)
  return (
    <g
      className={`ks-territory-stranded-stone ks-territory-stranded-stone--in-${marker.territoryOwner} ${marker.strength >= 0.82 ? 'ks-territory-stranded-stone--strong' : ''}`}
      transform={`translate(${p.x} ${p.y})`}
      aria-label={`${marker.territoryLabel} ${ownerLabel}中的${stoneLabel}`}
      style={{ opacity: Math.min(0.9, 0.58 + marker.strength * 0.26) }}
    >
      <rect
        className="ks-territory-stranded-stone__chip"
        x={-markerSize / 2}
        y={-markerSize / 2}
        width={markerSize}
        height={markerSize}
        rx="2.2"
        transform="rotate(45)"
      />
      <rect
        className="ks-territory-stranded-stone__chip-core"
        x={-markerSize * 0.28}
        y={-markerSize * 0.28}
        width={markerSize * 0.56}
        height={markerSize * 0.56}
        rx="1.2"
        transform="rotate(45)"
      />
    </g>
  )
}

function TerritoryOverlay({
  judgement,
  mode,
  boardSize
}: {
  judgement: TerritoryJudgement
  mode: TerritoryDisplayMode
  boardSize: number
}): ReactElement | null {
  if (!judgement.available || judgement.cells.length === 0) {
    return null
  }
  const cell = INNER / (boardSize - 1)
  return (
    <g className={`ks-territory-layer ks-territory-layer--${mode} ks-territory-layer--${judgement.confidence}`}>
      {judgement.cells.map((cellInfo) => {
        const p = xy(cellInfo, boardSize)
        const isUnclear = cellInfo.strength < 0.18
        const visualOwner = isUnclear ? 'unclear' : cellInfo.owner
        const opacity = isUnclear
          ? Math.min(0.38, Math.max(0.12, cellInfo.strength * 1.25))
          : Math.min(0.72, Math.max(0.18, Math.pow(cellInfo.strength, 1 / 1.42) * 0.62))
        const blockSize = mode === 'blocks'
          ? cell * (isUnclear ? 0.42 : 0.76)
          : mode === 'marks'
            ? Math.max(isUnclear ? 4.8 : 7.5, cell * (isUnclear ? 0.18 : 0.32) * Math.max(0.45, cellInfo.strength))
            : cell * (isUnclear ? 0.48 : 0.9)
        const markerSize = Math.max(isUnclear ? 2.6 : 4.8, blockSize * (isUnclear ? 0.18 : 0.21))
        if (mode === 'marks') {
          return (
            <circle
              key={`${cellInfo.x}-${cellInfo.y}`}
              className={`ks-territory-mark ks-territory-mark--${visualOwner}`}
              cx={p.x}
              cy={p.y}
              r={blockSize}
              style={{ opacity: Math.min(0.92, opacity * 1.55) }}
            />
          )
        }
        return (
          <g
            key={`${cellInfo.x}-${cellInfo.y}`}
            className={`ks-territory-point ks-territory-point--${visualOwner}`}
            style={{ opacity }}
          >
            <rect
              className={`ks-territory-cell ks-territory-cell--${visualOwner}`}
              x={p.x - blockSize / 2}
              y={p.y - blockSize / 2}
              width={blockSize}
              height={blockSize}
              rx={mode === 'blocks' ? 5 : blockSize * 0.44}
            />
            <circle
              className={`ks-territory-dot ks-territory-dot--${visualOwner}`}
              cx={p.x}
              cy={p.y}
              r={markerSize}
            />
          </g>
        )
      })}
    </g>
  )
}

export function GoBoardV2({
  record,
  moveNumber,
  analysis = null,
  keyMoves = [],
  flashPoint = null,
  compact = false,
  trialBranch = null,
  territoryJudgement = null,
  territoryMode = 'heat',
  onPointClick,
  onPointContextMenu,
  onCandidateHover,
  t: providedT
}: GoBoardV2Props): ReactElement {
  const t = providedT ?? ((key: string) => {
    const fallback: Record<string, string> = {
      boardImageLabel: '围棋棋盘',
      boardCandidateTopNote: 'KataGo 当前首选。'
    }
    return fallback[key] ?? key
  }) as UiTranslator
  const [hoveredCandidate, setHoveredCandidate] = useState<HoveredCandidate>(null)
  const boardSize = getBoardSize(record)
  const stones = useMemo(() => renderStones(record, moveNumber), [record, moveNumber])
  const candidates = useMemo(() => renderCandidates(analysis, boardSize), [analysis, boardSize])
  const playedMove = useMemo(() => renderPlayedMove(analysis, boardSize), [analysis, boardSize])
  const strandedStones = useMemo(() => territoryStrandedStones(stones, territoryJudgement), [stones, territoryJudgement])
  const strandedStoneKeys = useMemo(() => new Set(strandedStones.map((stone) => `${stone.x},${stone.y}`)), [strandedStones])
  const variationFirstColor = analysis?.trialContext?.active
    ? analysis.trialContext.nextColor
    : moveToColor(analysis?.currentMove ?? (moveNumber > 0 ? record.moves[moveNumber - 1] : undefined))
  const activeCandidate = hoveredCandidate
  const variationMoves = useMemo(
    () => activeCandidate ? candidateVariationMoves(activeCandidate.renderCandidate, boardSize, variationFirstColor) : [],
    [activeCandidate, boardSize, variationFirstColor]
  )
  const variationPreviewMoves = useMemo(() => variationMoves.filter((move) => !move.isFirst), [variationMoves])
  const previousMoveNumber = moveNumber > 1 ? moveNumber - 1 : -1
  const letters = coordinateLetters(boardSize)
  const lines = Array.from({ length: boardSize }, (_, index) => index)

  function handleCandidateHover(candidate: RenderCandidate | null, position?: CandidateTooltipPosition): void {
    setHoveredCandidate(candidate && position ? { candidate: toTooltipMove(candidate, t), renderCandidate: candidate, position } : null)
    onCandidateHover?.(candidate)
  }

  function sameCandidate(left: RenderCandidate | null | undefined, right: RenderCandidate | null | undefined): boolean {
    return Boolean(left && right && left.rank === right.rank && left.label === right.label)
  }

  function cursorInActivePreview(cursor: { x: number; y: number }, cell: number): boolean {
    if (!hoveredCandidate) {
      return false
    }
    const activePoint = xy(hoveredCandidate.renderCandidate, boardSize)
    const activeExitRadius = Math.max(54, cell * 1.03)
    if (Math.hypot(activePoint.x - cursor.x, activePoint.y - cursor.y) <= activeExitRadius) {
      return true
    }
    const variationStickyRadius = Math.max(28, cell * 0.52)
    return variationPreviewMoves.some((move) => {
      const point = xy(move, boardSize)
      return Math.hypot(point.x - cursor.x, point.y - cursor.y) <= variationStickyRadius
    })
  }

  function handleBoardPointerMove(event: BoardHoverEvent): void {
    const cursor = svgCursorPoint(event)
    if (!cursor) {
      return
    }
    const cell = INNER / (boardSize - 1)
    const hitRadius = Math.max(38, cell * 0.78)
    if (cursorInActivePreview(cursor, cell)) {
      return
    }
    let nearest: { candidate: RenderCandidate; point: { x: number; y: number }; distance: number } | null = null
    for (const candidate of candidates) {
      const point = xy(candidate, boardSize)
      const distance = Math.hypot(point.x - cursor.x, point.y - cursor.y)
      if (distance <= hitRadius && (!nearest || distance < nearest.distance)) {
        nearest = { candidate, point, distance }
      }
    }
    if (!nearest) {
      if (hoveredCandidate) {
        handleCandidateHover(null)
      }
      return
    }
    if (sameCandidate(hoveredCandidate?.renderCandidate, nearest.candidate)) {
      return
    }
    handleCandidateHover(nearest.candidate, tooltipPosition(nearest.point, event.currentTarget))
  }

  function eventBoardPoint(event: PointerEvent<SVGSVGElement>): BoardPoint | null {
    const matrix = event.currentTarget.getScreenCTM()?.inverse()
    if (!matrix) {
      return null
    }
    if (!onPointClick) {
      return null
    }
    const svg = event.currentTarget
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const cursor = point.matrixTransform(matrix)
    const cell = INNER / (boardSize - 1)
    const x = Math.round((cursor.x - EDGE) / cell)
    const y = Math.round((cursor.y - EDGE) / cell)
    if (x >= 0 && y >= 0 && x < boardSize && y < boardSize) {
      return { x, y }
    }
    return null
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>): void {
    if (event.button === 2) {
      event.preventDefault()
      onPointContextMenu?.()
      return
    }
    const point = eventBoardPoint(event)
    if (point) {
      onPointClick?.(point)
    }
  }

  return (
    <div className={`ks-board-shell ${compact ? 'ks-board-shell--compact' : ''}`}>
      <svg
        className="ks-go-board-v2"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        role="img"
        aria-label={t('boardImageLabel')}
        onPointerMove={handleBoardPointerMove}
        onPointerLeave={() => handleCandidateHover(null)}
        onMouseMove={handleBoardPointerMove}
        onMouseLeave={() => handleCandidateHover(null)}
        onPointerDown={handlePointerDown}
        onContextMenu={(event) => event.preventDefault()}
      >
        <defs>
          <linearGradient id="ks-board-wood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--ks-board-light, #d8ad6b)" />
            <stop offset="0.44" stopColor="var(--ks-board-mid, #bf8747)" />
            <stop offset="1" stopColor="var(--ks-board-dark, #7c5229)" />
          </linearGradient>
          <linearGradient id="ks-board-edge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0c987" />
            <stop offset="0.12" stopColor="#ba7c39" />
            <stop offset="0.86" stopColor="#6d431f" />
            <stop offset="1" stopColor="#3f2615" />
          </linearGradient>
          <filter id="ks-board-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="28" stdDeviation="22" floodColor="#000" floodOpacity="0.42" />
          </filter>
          <radialGradient id="ks-black-stone" cx="34%" cy="28%" r="72%">
            <stop offset="0" stopColor="#62676c" />
            <stop offset="0.14" stopColor="#2f3439" />
            <stop offset="0.58" stopColor="#080a0c" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <radialGradient id="ks-white-stone" cx="32%" cy="24%" r="75%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.34" stopColor="#f4efe7" />
            <stop offset="0.78" stopColor="#cfc7ba" />
            <stop offset="1" stopColor="#91897f" />
          </radialGradient>
          <radialGradient id="ks-stone-highlight" cx="34%" cy="22%" r="50%">
            <stop offset="0" stopColor="rgba(255,255,255,.82)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,.18)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <pattern id="ks-board-grain" width="92" height="46" patternUnits="userSpaceOnUse">
            <path d="M0 8 C24 0 46 18 92 8" stroke="rgba(70,35,10,.14)" strokeWidth="2" fill="none" />
            <path d="M0 31 C30 44 58 23 92 36" stroke="rgba(255,232,165,.10)" strokeWidth="1.5" fill="none" />
            <path d="M0 19 C18 15 38 24 58 17 S78 12 92 17" stroke="rgba(82,41,14,.08)" strokeWidth="1" fill="none" />
          </pattern>
        </defs>

        <rect className="ks-board-drop" x="18" y="18" width="924" height="924" rx="32" filter="url(#ks-board-shadow)" />
        <rect className="ks-board-bevel" x="24" y="24" width="912" height="912" rx="30" />
        <rect className="ks-board-surface-v2" x="36" y="36" width="888" height="888" rx="22" />
        <rect x="36" y="36" width="888" height="888" rx="22" fill="url(#ks-board-grain)" opacity="0.68" />

        <g className="ks-grid-lines">
          {lines.map((index) => {
            const start = xy({ x: 0, y: index }, boardSize)
            const end = xy({ x: boardSize - 1, y: index }, boardSize)
            const verticalStart = xy({ x: index, y: 0 }, boardSize)
            const verticalEnd = xy({ x: index, y: boardSize - 1 }, boardSize)
            return (
              <g key={index}>
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
                <line x1={verticalStart.x} y1={verticalStart.y} x2={verticalEnd.x} y2={verticalEnd.y} />
              </g>
            )
          })}
        </g>

        <g className="ks-star-points">
          {starPoints(boardSize).map((point) => {
            const p = xy(point, boardSize)
            return <circle key={`${point.x}-${point.y}`} cx={p.x} cy={p.y} r="6" />
          })}
        </g>

        {territoryJudgement ? <TerritoryOverlay judgement={territoryJudgement} mode={territoryMode} boardSize={boardSize} /> : null}

        <g className="ks-board-coordinates-v2">
          {letters.map((letter, index) => {
            const top = xy({ x: index, y: 0 }, boardSize)
            const left = xy({ x: 0, y: index }, boardSize)
            return (
              <g key={letter}>
                <text x={top.x} y="52">{letter}</text>
                <text x={top.x} y="908">{letter}</text>
                <text x="52" y={left.y}>{boardSize - index}</text>
                <text x="908" y={left.y}>{boardSize - index}</text>
              </g>
            )
          })}
        </g>

        <g className="ks-keymoves-layer">
          {keyMoves.map((mark) => <KeyMoveMark key={`${mark.moveNumber}-${mark.label}`} mark={mark} boardSize={boardSize} />)}
        </g>

        <g className="ks-stones-layer">
          {stones.map((stone) => {
            const p = xy(stone, boardSize)
            const isPreviousMove = stone.moveNumber === previousMoveNumber
            const isTerritoryStranded = strandedStoneKeys.has(`${stone.x},${stone.y}`)
            return (
              <g
                key={`${stone.x}-${stone.y}-${stone.moveNumber}`}
                className={`ks-stone ks-stone--${stone.color} ${isPreviousMove ? 'ks-stone--previous' : ''} ${isTerritoryStranded ? 'ks-stone--territory-stranded' : ''}`}
                transform={`translate(${p.x} ${p.y})`}
              >
                <circle className="ks-stone-shadow" r="24" />
                <circle className="ks-stone-body" r="22.2" />
                <ellipse className="ks-stone-highlight" cx="-6.5" cy="-8.2" rx="8.6" ry="5.2" />
                {isPreviousMove ? <PreviousMoveMarker color={stone.color} t={t} /> : null}
              </g>
            )
          })}
        </g>

        {strandedStones.length > 0 ? (
          <g className="ks-territory-stranded-stones-layer">
            {strandedStones.map((marker) => (
              <TerritoryStrandedStoneMark key={`${marker.x}-${marker.y}-${marker.moveNumber}`} marker={marker} boardSize={boardSize} />
            ))}
          </g>
        ) : null}

        {trialBranch?.active && trialBranch.moves.length > 0 ? (
          <g className="ks-trial-stones-layer">
            {trialBranch.moves.map((move) => (
              <TrialStoneMark key={`${move.moveNumber}-${move.gtp}`} move={move} boardSize={boardSize} />
            ))}
          </g>
        ) : null}

        <g className="ks-candidates-layer">
          {candidates.map((candidate) => (
            <CandidateMark
              key={`${candidate.rank}-${candidate.label}`}
              candidate={candidate}
              boardSize={boardSize}
              active={sameCandidate(activeCandidate?.renderCandidate, candidate)}
            />
          ))}
        </g>

        <VariationPreview
          moves={variationPreviewMoves}
          boardSize={boardSize}
          anchor={activeCandidate?.renderCandidate ?? null}
          totalMoves={variationMoves.length}
        />

        {playedMove ? (
          <g className="ks-played-move-layer">
            <PlayedMoveMark played={playedMove} boardSize={boardSize} t={t} />
          </g>
        ) : null}

        {flashPoint ? (
          <g key={`${flashPoint.x}-${flashPoint.y}-${flashPoint.nonce ?? 0}`} className="ks-board-flash-layer">
            <BoardFlashMark point={flashPoint} boardSize={boardSize} />
          </g>
        ) : null}
      </svg>
    </div>
  )
}
