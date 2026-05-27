import type { BoardEvidenceHighlight, BoardPvPreviewState } from './pvInteraction'

export interface VariationPlaybackFrame {
  index: number
  move: string
  label: string
  active: boolean
  confidence: BoardPvPreviewState['confidence']
}

export interface VariationPlaybackState {
  anchorMove: string
  currentIndex: number
  frames: VariationPlaybackFrame[]
  warning?: string
  statusText: string
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.max(0, Math.min(length - 1, Math.round(index)))
}

export function buildVariationPlaybackState(preview: BoardPvPreviewState | null, currentIndex = 0): VariationPlaybackState | null {
  if (!preview) return null
  const index = clampIndex(currentIndex, preview.pv.length)
  const frames = preview.pv.map((move, frameIndex) => ({
    index: frameIndex,
    move,
    label: `${frameIndex + 1}. ${move}`,
    active: frameIndex === index,
    confidence: preview.confidence
  }))
  return {
    anchorMove: preview.anchorMove,
    currentIndex: index,
    frames,
    warning: preview.warning,
    statusText: frames.length
      ? `${preview.anchorMove} PV ${index + 1}/${frames.length}: ${frames[index]?.move ?? ''}`
      : `${preview.anchorMove} 暂无 PV`
  }
}

export function stepVariationPlayback(preview: BoardPvPreviewState | null, currentIndex: number, direction: 1 | -1): VariationPlaybackState | null {
  if (!preview) return null
  return buildVariationPlaybackState(preview, clampIndex(currentIndex + direction, preview.pv.length))
}

export function playbackHighlights(state: VariationPlaybackState | null): BoardEvidenceHighlight[] {
  if (!state) return []
  return state.frames.map((frame) => ({
    point: frame.move,
    label: frame.active ? `当前变化 ${frame.label}` : frame.label,
    reason: frame.active ? 'active-pv-frame' : 'pv-frame'
  }))
}

export function variationPlaybackText(state: VariationPlaybackState | null): string {
  if (!state) return ''
  return [state.statusText, state.warning, state.frames.map((frame) => frame.label).join(' → ')].filter(Boolean).join('\n')
}
