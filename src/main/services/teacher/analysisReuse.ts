import type { KataGoMoveAnalysis } from '@main/lib/types'

/** Forced-played searches do not establish the depth of the unrestricted root search. */
export function canReuseTeacherAnalysis(analysis: KataGoMoveAnalysis | undefined, request: {
  gameId: string
  moveNumber: number
  trialBranchHash?: string
  requestedMaxVisits?: number
}): boolean {
  if (!analysis || analysis.gameId !== request.gameId || analysis.moveNumber !== request.moveNumber ||
    (analysis.trialContext?.active ? analysis.trialContext.branchHash : undefined) !== request.trialBranchHash) return false
  if (request.requestedMaxVisits === undefined) return true
  if (!Number.isFinite(request.requestedMaxVisits) || request.requestedMaxVisits < 1) return false
  const rootVisits = analysis.analysisQuality?.totalVisits
  // KataGo may report one less completed root visit than its configured budget.
  return typeof rootVisits === 'number' && Number.isFinite(rootVisits) && rootVisits >= 0 && rootVisits + 1 >= request.requestedMaxVisits
}
