export interface LatestThrottle<T> {
  push: (value: T, immediate?: boolean) => void
  dispose: () => void
}

/**
 * Applies at most one value per `intervalMs`, always the latest one. Analysis progress arrives
 * many times a second and each update re-renders the board; intermediate values are dropped.
 */
export function createLatestThrottle<T>(apply: (value: T) => void, intervalMs: number): LatestThrottle<T> {
  let pending: { value: T } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastAppliedAt = Number.NEGATIVE_INFINITY

  const flush = (): void => {
    timer = null
    if (!pending) return
    const { value } = pending
    pending = null
    lastAppliedAt = Date.now()
    apply(value)
  }

  return {
    push(value, immediate = false) {
      pending = { value }
      if (immediate) {
        if (timer) clearTimeout(timer)
        flush()
        return
      }
      if (timer) return
      timer = setTimeout(flush, Math.max(0, lastAppliedAt + intervalMs - Date.now()))
    },
    dispose() {
      if (timer) clearTimeout(timer)
      timer = null
      pending = null
    }
  }
}
