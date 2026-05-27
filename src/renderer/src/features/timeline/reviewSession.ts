import type { BoardPvPreviewState } from '../board/pvInteraction'
import type { TimelineReviewItem } from './reviewNavigator'

export interface TimelineSelectionRange {
  start: number
  end: number
  keyMoves: number[]
}

export interface ReviewNavigatorSession {
  items: TimelineReviewItem[]
  activeMoveNumber?: number
  selectedRange?: TimelineSelectionRange
  hoveredPv?: BoardPvPreviewState | null
  lockedPv?: BoardPvPreviewState | null
  pvStepIndex: number
  updatedAt: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function sortedRange(start: number, end: number): { start: number; end: number } {
  return start <= end ? { start, end } : { start: end, end: start }
}

export function createReviewNavigatorSession(items: TimelineReviewItem[] = []): ReviewNavigatorSession {
  return { items, pvStepIndex: 0, updatedAt: nowIso() }
}

export function selectReviewMove(session: ReviewNavigatorSession, moveNumber: number): ReviewNavigatorSession {
  return { ...session, activeMoveNumber: moveNumber, pvStepIndex: 0, updatedAt: nowIso() }
}

export function selectReviewRange(session: ReviewNavigatorSession, startMove: number, endMove: number, limit = 5): ReviewNavigatorSession {
  const range = sortedRange(startMove, endMove)
  const keyMoves = session.items
    .filter((item) => item.moveNumber >= range.start && item.moveNumber <= range.end)
    .sort((left, right) => right.sortScore - left.sortScore || left.moveNumber - right.moveNumber)
    .slice(0, limit)
    .map((item) => item.moveNumber)
    .sort((left, right) => left - right)
  return { ...session, selectedRange: { ...range, keyMoves }, updatedAt: nowIso() }
}

export function clearReviewRange(session: ReviewNavigatorSession): ReviewNavigatorSession {
  const { selectedRange: _selectedRange, ...rest } = session
  return { ...rest, updatedAt: nowIso() }
}

export function setHoveredPv(session: ReviewNavigatorSession, pv: BoardPvPreviewState | null): ReviewNavigatorSession {
  if (session.lockedPv) return { ...session, hoveredPv: pv, updatedAt: nowIso() }
  return { ...session, hoveredPv: pv, pvStepIndex: 0, updatedAt: nowIso() }
}

export function toggleLockedPv(session: ReviewNavigatorSession, pv?: BoardPvPreviewState | null): ReviewNavigatorSession {
  const nextLocked = pv ?? session.hoveredPv ?? null
  if (session.lockedPv && (!nextLocked || session.lockedPv.anchorMove === nextLocked.anchorMove)) {
    return { ...session, lockedPv: null, pvStepIndex: 0, updatedAt: nowIso() }
  }
  return { ...session, lockedPv: nextLocked ? { ...nextLocked, locked: true } : null, pvStepIndex: 0, updatedAt: nowIso() }
}

export function activePvPreview(session: ReviewNavigatorSession): BoardPvPreviewState | null {
  return session.lockedPv ?? session.hoveredPv ?? null
}

export function stepActivePv(session: ReviewNavigatorSession, direction: 1 | -1): ReviewNavigatorSession {
  const pv = activePvPreview(session)
  if (!pv || pv.pv.length === 0) return session
  const next = Math.max(0, Math.min(pv.pv.length - 1, session.pvStepIndex + direction))
  return { ...session, pvStepIndex: next, updatedAt: nowIso() }
}

export function currentPvMove(session: ReviewNavigatorSession): string | undefined {
  const pv = activePvPreview(session)
  return pv?.pv[session.pvStepIndex]
}
