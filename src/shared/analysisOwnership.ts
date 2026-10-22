interface OwnershipCandidate {
  move: string
  ownership?: number[]
  ownershipStdev?: number[]
}

interface OwnershipAnalysis {
  playedMove?: { move?: string }
  currentMove?: { gtp?: string }
  before: { topMoves: OwnershipCandidate[] }
  after: { topMoves: OwnershipCandidate[] }
}

function moveKey(move: string | undefined): string {
  return (move ?? '').trim().toUpperCase()
}

/**
 * Only the root, the best candidate and the played move's ownership maps are read (board
 * judgement, teacher trace). Dropping the other candidates' 361-point maps keeps frequent
 * progress updates and stored caches small.
 */
export function withPrimaryOwnershipOnly<T extends OwnershipAnalysis>(analysis: T): T {
  const played = moveKey(analysis.playedMove?.move ?? analysis.currentMove?.gtp)
  const trim = <C extends OwnershipCandidate>(moves: C[]): C[] => moves.map((move, index) =>
    index === 0 || moveKey(move.move) === played || (!move.ownership && !move.ownershipStdev)
      ? move
      : { ...move, ownership: undefined, ownershipStdev: undefined }
  )
  return {
    ...analysis,
    before: { ...analysis.before, topMoves: trim(analysis.before.topMoves) },
    after: { ...analysis.after, topMoves: trim(analysis.after.topMoves) }
  }
}
