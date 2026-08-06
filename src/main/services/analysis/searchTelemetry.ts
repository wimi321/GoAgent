export interface KataGoSearchProgress {
  id?: string
  visits: number
  visitsPerSecond: number
  isDuringSearch: boolean
}

interface SearchResponseLike {
  id?: string
  isDuringSearch?: boolean
  rootInfo?: { visits?: number }
  moveInfos?: Array<{ visits?: number }>
}

interface SearchSample {
  visits: number
  sampledAt: number
  smoothedSpeed: number
}

function finitePositive(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

export function kataGoResponseVisits(response: SearchResponseLike): number {
  const rootVisits = finitePositive(response.rootInfo?.visits)
  const candidateVisits = (response.moveInfos ?? []).reduce(
    (total, move) => total + finitePositive(move.visits),
    0
  )
  return Math.max(rootVisits, candidateVisits)
}

/**
 * KataGo reports cumulative visits in each partial response. Sampling their
 * delta gives the same live throughput users expect from desktop Go clients,
 * independent of whether the response came from a local, persistent, or
 * remote engine.
 */
export function createKataGoSearchProgressTracker(
  onProgress?: (progress: KataGoSearchProgress) => void,
  now: () => number = Date.now
): { observe: (response: SearchResponseLike) => void } {
  const samples = new Map<string, SearchSample>()
  const startedAt = now()

  return {
    observe(response): void {
      if (!onProgress) return
      const visits = kataGoResponseVisits(response)
      if (visits <= 0) return

      const id = String(response.id || 'katago-search')
      const sampledAt = now()
      const previous = samples.get(id)
      let visitsPerSecond = 0
      let smoothedSpeed = previous?.smoothedSpeed ?? 0

      if (previous && visits > previous.visits) {
        const elapsedSeconds = Math.max(0.05, (sampledAt - previous.sampledAt) / 1000)
        const instantaneous = (visits - previous.visits) / elapsedSeconds
        smoothedSpeed = previous.smoothedSpeed > 0
          ? previous.smoothedSpeed * 0.62 + instantaneous * 0.38
          : instantaneous
        visitsPerSecond = smoothedSpeed
      } else if (!previous) {
        // The first partial response is already useful. Deriving an average
        // from the query start avoids leaving slower machines on "measuring"
        // until KataGo happens to emit a second report.
        const elapsedSeconds = Math.max(0.1, (sampledAt - startedAt) / 1000)
        smoothedSpeed = visits / elapsedSeconds
        visitsPerSecond = smoothedSpeed
      }

      samples.set(id, { visits, sampledAt, smoothedSpeed })
      onProgress({
        id: response.id,
        visits,
        visitsPerSecond,
        isDuringSearch: response.isDuringSearch !== false
      })

      if (response.isDuringSearch === false) {
        samples.delete(id)
      }
    }
  }
}
