import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import type { KataGoMoveAnalysis } from '@main/lib/types'
import type { UiTranslator } from '../../i18n'
import { getAnalysisMoveNumber, getAnalysisWinrate, classifyMoveLoss, normalizeWinrate } from './boardGeometry'
import { moveFromTimelineSvgX } from './timelineInteraction'
import './board-v2.css'

type Severity = 'blunder' | 'mistake' | 'inaccuracy' | 'turning-point'

interface TimelinePoint {
  moveNumber: number
  winrate: number
  scoreLead?: number
  loss?: number
  severity?: Severity
}

interface WinrateTimelineV2Props {
  evaluations: KataGoMoveAnalysis[]
  currentMoveNumber: number
  totalMoves: number
  loading?: boolean
  loadingLabel?: string
  onMove?: (moveNumber: number) => void
  onRangeSelect?: (start: number, end: number) => void
  onRangeClear?: () => void
  rangeStart?: number | null
  rangeEnd?: number | null
  summary?: ReactNode
  t?: UiTranslator
}

function valueOf(record: unknown, key: string): unknown {
  return typeof record === 'object' && record !== null ? (record as Record<string, unknown>)[key] : undefined
}

function extractLoss(item: unknown): number | undefined {
  const raw = valueOf(valueOf(item, 'playedMove'), 'winrateLoss') ?? valueOf(item, 'winrateLoss') ?? valueOf(item, 'loss') ?? valueOf(item, 'mistakeLoss')
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.abs(raw))
  }
  const before = normalizeWinrate(valueOf(valueOf(item, 'before'), 'winrate'))
  const after = normalizeWinrate(valueOf(valueOf(item, 'after'), 'winrate'))
  if (before !== null && after !== null) {
    const color = valueOf(valueOf(item, 'currentMove'), 'color')
    const playerBefore = color === 'W' ? 1 - before : before
    const playerAfter = color === 'W' ? 1 - after : after
    return Math.max(0, (playerBefore - playerAfter) * 100)
  }
  return undefined
}

function extractScoreLead(item: unknown): number | undefined {
  const raw =
    valueOf(valueOf(item, 'after'), 'scoreLead') ??
    valueOf(valueOf(item, 'after'), 'scoreMean') ??
    valueOf(valueOf(item, 'after'), 'score') ??
    valueOf(item, 'scoreLead') ??
    valueOf(item, 'scoreMean')
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw
  }
  return undefined
}

function buildPoints(evaluations: KataGoMoveAnalysis[], totalMoves: number): TimelinePoint[] {
  return evaluations.flatMap((item) => {
    const moveNumber = getAnalysisMoveNumber(item)
    const winrate = getAnalysisWinrate(item)
    if (moveNumber === null || winrate === null) {
      return []
    }
    const loss = extractLoss(item)
    return [{
      moveNumber,
      winrate,
      scoreLead: extractScoreLead(item),
      loss,
      severity: loss === undefined ? undefined : classifyMoveLoss(loss) as Severity
    }]
  }).filter((point) => point.moveNumber >= 0 && point.moveNumber <= totalMoves)
    .sort((a, b) => a.moveNumber - b.moveNumber)
}

function severityShortLabel(severity: Severity, t: UiTranslator): string {
  if (severity === 'blunder') return t('severityBlunder')
  if (severity === 'mistake') return t('severityMistake')
  if (severity === 'inaccuracy') return t('severityInaccuracy')
  return t('severityTurningPoint')
}

function formatBlackWinrate(winrate: number | undefined): string {
  if (typeof winrate !== 'number' || !Number.isFinite(winrate)) {
    return '—'
  }
  return `${(Math.max(0, Math.min(1, winrate)) * 100).toFixed(1)}%`
}

function formatWinrateLoss(loss: number | undefined): string {
  if (typeof loss !== 'number' || !Number.isFinite(loss)) {
    return '—'
  }
  return `${loss.toFixed(loss >= 10 ? 0 : 1)}%`
}

function formatSignedScore(value: number | undefined, unit: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}${unit}`
}

export function WinrateTimelineV2({
  evaluations,
  currentMoveNumber,
  totalMoves,
  loading = false,
  loadingLabel = '',
  onMove,
  onRangeSelect,
  onRangeClear,
  rangeStart: activeRangeStart,
  rangeEnd: activeRangeEnd,
  summary,
  t: providedT
}: WinrateTimelineV2Props): ReactElement {
  const t = providedT ?? ((key: string, vars?: Record<string, string | number | undefined>) => {
    const fallback: Record<string, string> = {
      timelineAria: '胜率图，可用鼠标滚轮或左右方向键切换手数',
      timelineTitle: '胜率走势',
      timelineLoading: '分析中',
      timelineCurrentBlackWinrate: '当前黑胜率',
      timelinePreviousMove: '上一手',
      timelineNextMove: '下一手',
      timelineScoreLead: '目差',
      timelineEmpty: '导入棋谱后生成胜率图',
      timelineTooltip: `第 ${vars?.move ?? ''} 手 · ${vars?.winrate ?? ''}%`,
      timelineTooltipLoss: `胜率差 ${vars?.loss ?? ''} · ${vars?.severity ?? ''}`,
      timelineDeltaUp: `较上手 +${vars?.delta ?? ''}%`,
      timelineDeltaDown: `较上手 ${vars?.delta ?? ''}%`,
      timelineDeltaFlat: '与上手持平',
      timelineRangeBadge: `区间 ${vars?.lo ?? ''}-${vars?.hi ?? ''}`,
      timelineScoreUnit: '目',
      timelineSeverityHeader: '严重度',
      severityBlunder: '重大',
      severityMistake: '问题',
      severityInaccuracy: '缓手',
      severityTurningPoint: '转折'
    }
    return fallback[key] ?? key
  }) as UiTranslator

  const [dragging, setDragging] = useState(false)
  const [hoveredMove, setHoveredMove] = useState<number | null>(null)
  const [hoverLeft, setHoverLeft] = useState(0)
  const [dragRangeStart, setDragRangeStart] = useState<number | null>(null)
  const [dragRangeEnd, setDragRangeEnd] = useState<number | null>(null)
  const [isRangeDragging, setIsRangeDragging] = useState(false)
  const draggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const points = useMemo(() => buildPoints(evaluations, totalMoves), [evaluations, totalMoves])
  const width = 1000
  const height = 90
  const padX = 22
  const padY = 8
  const plotW = width - padX * 2
  const plotH = height - padY * 2
  const safeTotal = Math.max(1, totalMoves)
  const x = (move: number): number => padX + (Math.max(0, Math.min(safeTotal, move)) / safeTotal) * plotW
  const y = (winrate: number): number => padY + (1 - Math.max(0, Math.min(1, winrate))) * plotH

  const linePath = useMemo(() => {
    if (points.length < 2) return ''
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.moveNumber).toFixed(1)} ${y(point.winrate).toFixed(1)}`).join(' ')
  }, [points, safeTotal])

  const areaPath = useMemo(() => {
    if (points.length < 2) return ''
    const first = points[0]
    const last = points[points.length - 1]
    const segments = points.map((point) => `L ${x(point.moveNumber).toFixed(1)} ${y(point.winrate).toFixed(1)}`)
    return `M ${x(first.moveNumber).toFixed(1)} ${(padY + plotH).toFixed(1)} ${segments.join(' ')} L ${x(last.moveNumber).toFixed(1)} ${(padY + plotH).toFixed(1)} Z`
  }, [points, safeTotal])

  const hoverPoint = hoveredMove === null
    ? null
    : points.find((point) => point.moveNumber === hoveredMove) ?? null
  const currentPoint = points.find((point) => point.moveNumber === currentMoveNumber)
  const previousPoint = useMemo(() => {
    if (!currentPoint) return null
    const idx = points.indexOf(currentPoint)
    return idx > 0 ? points[idx - 1] : null
  }, [points, currentPoint])

  const currentBlackWinrateLabel = formatBlackWinrate(currentPoint?.winrate)
  const deltaPct = useMemo(() => {
    if (!currentPoint || !previousPoint) return null
    return (currentPoint.winrate - previousPoint.winrate) * 100
  }, [currentPoint, previousPoint])
  const deltaLabel = deltaPct === null || Math.abs(deltaPct) < 0.1
    ? t('timelineDeltaFlat')
    : deltaPct > 0
      ? t('timelineDeltaUp', { delta: deltaPct.toFixed(1) })
      : t('timelineDeltaDown', { delta: deltaPct.toFixed(1) })
  const deltaTone: 'up' | 'down' | 'flat' = deltaPct === null || Math.abs(deltaPct) < 0.1 ? 'flat' : deltaPct > 0 ? 'up' : 'down'

  const currentScoreLead = currentPoint?.scoreLead
  const canMovePrevious = Boolean(onMove) && currentMoveNumber > 0
  const canMoveNext = Boolean(onMove) && currentMoveNumber < totalMoves
  const hasActiveRange = activeRangeStart != null && activeRangeEnd != null
  const rangeLo = isRangeDragging
    ? Math.min(dragRangeStart ?? 0, dragRangeEnd ?? 0)
    : hasActiveRange ? Math.min(activeRangeStart, activeRangeEnd) : null
  const rangeHi = isRangeDragging
    ? Math.max(dragRangeStart ?? 0, dragRangeEnd ?? 0)
    : hasActiveRange ? Math.max(activeRangeStart, activeRangeEnd) : null

  const severityCounts = useMemo(() => {
    const counts = { blunder: 0, mistake: 0, inaccuracy: 0 }
    for (const point of points) {
      if (point.severity === 'blunder') counts.blunder += 1
      else if (point.severity === 'mistake') counts.mistake += 1
      else if (point.severity === 'inaccuracy') counts.inaccuracy += 1
    }
    return counts
  }, [points])

  function svgXFromEvent(event: ReactPointerEvent<SVGSVGElement>): number {
    const svg = event.currentTarget
    const matrix = svg.getScreenCTM()?.inverse()
    if (matrix) {
      const point = svg.createSVGPoint()
      point.x = event.clientX
      point.y = event.clientY
      return point.matrixTransform(matrix).x
    }
    const rect = svg.getBoundingClientRect()
    return ((event.clientX - rect.left) / Math.max(1, rect.width)) * width
  }

  function containerLeftFromSvgX(svg: SVGSVGElement, svgX: number): number {
    const containerRect = containerRef.current?.getBoundingClientRect()
    const matrix = svg.getScreenCTM()
    if (containerRect && matrix) {
      const point = svg.createSVGPoint()
      point.x = svgX
      point.y = 0
      return point.matrixTransform(matrix).x - containerRect.left
    }
    const rect = svg.getBoundingClientRect()
    return rect.left + (svgX / width) * rect.width - (containerRect?.left ?? rect.left)
  }

  function moveFromEvent(event: ReactPointerEvent<SVGSVGElement>): number {
    return moveFromTimelineSvgX({
      svgX: svgXFromEvent(event),
      plotLeft: padX,
      plotWidth: plotW,
      totalMoves
    })
  }

  function selectMove(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!onMove) return
    onMove(moveFromEvent(event))
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>): void {
    if (event.altKey) {
      event.preventDefault()
      containerRef.current?.focus({ preventScroll: true })
      event.currentTarget.setPointerCapture(event.pointerId)
      const move = moveFromEvent(event)
      setIsRangeDragging(true)
      setDragRangeStart(move)
      setDragRangeEnd(move)
      return
    }
    if (hasActiveRange) onRangeClear?.()
    containerRef.current?.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    setDragging(true)
    selectMove(event)
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>): void {
    if (isRangeDragging) {
      setDragRangeEnd(moveFromEvent(event))
      return
    }
    const move = moveFromEvent(event)
    setHoveredMove(move)
    const markerLeft = containerLeftFromSvgX(event.currentTarget, x(move))
    const containerWidth = containerRef.current?.getBoundingClientRect().width ?? event.currentTarget.getBoundingClientRect().width
    setHoverLeft(Math.min(Math.max(8, markerLeft + 10), Math.max(8, containerWidth - 180)))
    if (draggingRef.current) {
      selectMove(event)
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<SVGSVGElement>): void {
    if (isRangeDragging) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      const endMove = moveFromEvent(event)
      setIsRangeDragging(false)
      if (dragRangeStart !== null && endMove !== dragRangeStart) {
        const lo = Math.min(dragRangeStart, endMove)
        const hi = Math.max(dragRangeStart, endMove)
        onRangeSelect?.(lo, hi)
      }
      setDragRangeStart(null)
      setDragRangeEnd(null)
      return
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    draggingRef.current = false
    setDragging(false)
    selectMove(event)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape' && hasActiveRange) {
      event.preventDefault()
      onRangeClear?.()
      return
    }
    if (!onMove || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
      return
    }
    event.preventDefault()
    const delta = event.key === 'ArrowLeft' ? -1 : 1
    onMove(Math.max(0, Math.min(totalMoves, currentMoveNumber + delta)))
  }

  function stepMove(delta: number): void {
    if (!onMove) return
    onMove(Math.max(0, Math.min(totalMoves, currentMoveNumber + delta)))
  }

  return (
    <div
      ref={containerRef}
      className="ks-timeline-v2"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={t('timelineAria')}
    >
      <div className="ks-timeline-head">
        <div className="ks-timeline-nav" aria-label={t('timelineAria')}>
          <button type="button" onClick={() => stepMove(-1)} disabled={!canMovePrevious} aria-label={t('timelinePreviousMove')} title={t('timelinePreviousMove')}>‹</button>
          <span className="ks-timeline-move-count" aria-live="polite">{currentMoveNumber}<i>/</i>{totalMoves}</span>
          <button type="button" onClick={() => stepMove(1)} disabled={!canMoveNext} aria-label={t('timelineNextMove')} title={t('timelineNextMove')}>›</button>
        </div>

        <div className={`ks-timeline-kpi ks-timeline-kpi--winrate`}>
          <span className="ks-timeline-kpi__label">{t('timelineCurrentBlackWinrate')}</span>
          <strong className="ks-timeline-kpi__value">{currentBlackWinrateLabel}</strong>
          <span className={`ks-timeline-kpi__delta ks-timeline-kpi__delta--${deltaTone}`} aria-label={deltaLabel} title={deltaLabel}>
            {deltaTone === 'up' ? '▲' : deltaTone === 'down' ? '▼' : '·'}
            <i>{deltaPct === null ? '—' : `${Math.abs(deltaPct).toFixed(1)}`}</i>
          </span>
        </div>

        <div className="ks-timeline-kpi ks-timeline-kpi--score">
          <span className="ks-timeline-kpi__label">{t('timelineScoreLead')}</span>
          <strong className="ks-timeline-kpi__value">{formatSignedScore(currentScoreLead, t('timelineScoreUnit'))}</strong>
        </div>

        {summary ? <div className="ks-timeline-kpi ks-timeline-kpi--summary">{summary}</div> : null}

        <div className="ks-timeline-severity-legend" aria-label={t('timelineSeverityHeader')}>
          <span className="ks-timeline-severity-legend__item ks-timeline-severity-legend__item--blunder" title={t('severityBlunder')}>
            <i className="ks-timeline-severity-dot ks-timeline-severity-dot--blunder" />
            <em>{severityCounts.blunder}</em>
          </span>
          <span className="ks-timeline-severity-legend__item ks-timeline-severity-legend__item--mistake" title={t('severityMistake')}>
            <i className="ks-timeline-severity-dot ks-timeline-severity-dot--mistake" />
            <em>{severityCounts.mistake}</em>
          </span>
          <span className="ks-timeline-severity-legend__item ks-timeline-severity-legend__item--inaccuracy" title={t('severityInaccuracy')}>
            <i className="ks-timeline-severity-dot ks-timeline-severity-dot--inaccuracy" />
            <em>{severityCounts.inaccuracy}</em>
          </span>
        </div>

        {loading ? <small className="ks-timeline-loading">{loadingLabel || t('timelineLoading')}</small> : null}
        {hasActiveRange && rangeLo !== null && rangeHi !== null ? (
          <button
            type="button"
            className="ks-timeline-range-chip"
            onClick={onRangeClear}
            aria-label={t('timelineRangeBadge', { lo: rangeLo, hi: rangeHi })}
          >
            {t('timelineRangeBadge', { lo: rangeLo, hi: rangeHi })}
            <i aria-hidden>×</i>
          </button>
        ) : null}
      </div>

      <svg
        className={`ks-timeline-canvas ${dragging ? 'is-dragging' : ''}`}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={() => {
          if (!draggingRef.current && !isRangeDragging) {
            setHoveredMove(null)
          }
        }}
        role="img"
        aria-label={t('timelineTitle')}
      >
        <defs>
          <linearGradient id="ks-timeline-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--ks-blue, #557f9d)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--ks-blue, #557f9d)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal grid */}
        {[0.25, 0.75].map((row) => (
          <line key={row} className="ks-timeline-grid" x1={padX} y1={padY + row * plotH} x2={width - padX} y2={padY + row * plotH} />
        ))}
        <line className="ks-timeline-center" x1={padX} y1={y(0.5)} x2={width - padX} y2={y(0.5)} />

        {/* range highlight */}
        {rangeLo !== null && rangeHi !== null ? (
          <rect
            className="ks-timeline-range-highlight"
            x={x(rangeLo)}
            y={padY}
            width={Math.max(1, x(rangeHi) - x(rangeLo))}
            height={plotH}
          />
        ) : null}

        {/* winrate area + line */}
        {areaPath ? <path className="ks-timeline-area" d={areaPath} /> : null}
        {linePath ? <path className="ks-timeline-line ks-timeline-line--winrate" d={linePath} /> : null}

        {/* severity markers */}
        {points.map((point) => point.severity && point.severity !== 'turning-point' ? (
          <circle
            key={`severity-${point.moveNumber}`}
            className={`ks-timeline-dot ks-timeline-dot--${point.severity}`}
            cx={x(point.moveNumber)}
            cy={y(point.winrate)}
            r={3.6}
          />
        ) : null)}

        {/* current move indicator */}
        <line className="ks-timeline-current" x1={x(currentMoveNumber)} y1={padY} x2={x(currentMoveNumber)} y2={height - padY} />
        {currentPoint ? (
          <circle className="ks-timeline-current-dot" cx={x(currentMoveNumber)} cy={y(currentPoint.winrate)} r={4.5} />
        ) : null}

        {/* hover */}
        {hoveredMove !== null ? (
          <g className="ks-timeline-hover">
            <line className="ks-timeline-hover-line" x1={x(hoveredMove)} y1={padY} x2={x(hoveredMove)} y2={height - padY} />
            {hoverPoint ? <circle className="ks-timeline-hover-dot" cx={x(hoveredMove)} cy={y(hoverPoint.winrate)} r={3.5} /> : null}
          </g>
        ) : null}

        {points.length === 0 ? <text className="ks-timeline-empty" x={width / 2} y={height / 2}>{t('timelineEmpty')}</text> : null}
      </svg>

      {hoveredMove !== null ? (
        <div className="ks-timeline-tooltip" style={{ left: `${Math.round(hoverLeft)}px` }} role="tooltip">
          <strong>{hoverPoint ? t('timelineTooltip', { move: hoveredMove, winrate: Math.round(hoverPoint.winrate * 100) }) : `第 ${hoveredMove} 手`}</strong>
          {hoverPoint?.severity && hoverPoint.severity !== 'turning-point' ? (
            <span className={`ks-timeline-tooltip__severity ks-timeline-tooltip__severity--${hoverPoint.severity}`}>
              {t('timelineTooltipLoss', { loss: formatWinrateLoss(hoverPoint.loss), severity: severityShortLabel(hoverPoint.severity, t) })}
            </span>
          ) : (
            <span className="ks-timeline-tooltip__meta">{hoverPoint?.scoreLead !== undefined ? formatSignedScore(hoverPoint.scoreLead, t('timelineScoreUnit')) : t('timelineLoading')}</span>
          )}
        </div>
      ) : null}
    </div>
  )
}
