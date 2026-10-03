import type { KataGoMoveAnalysis } from '@main/lib/types'
import { recognizeMoveConcepts, formatMoveConceptsForPrompt, type MoveConceptResult } from '../knowledge/moveConcepts'
import { buildGlobalPriorityEvidence, type GlobalPriorityEvidence } from './globalPriorityEvidence'
import { buildBoardGroupRelations, type BoardGroupRelations } from './boardGroupRelations'
import { buildMoveBoardEffects, type MoveBoardEffects } from './moveBoardEffects'

export interface MoveConceptEvidence {
  moveNumber: number
  boardTiming: 'before-move'
  boardCoordinates?: {
    timing: 'before-move'; boardSize: number; moveNumber: number
    stonesByColor: { B: string[]; W: string[] }
  }
  globalPriority?: GlobalPriorityEvidence
  boardGroups?: BoardGroupRelations
  moveEffects?: MoveBoardEffects
  candidateOwnDevelopment: Array<Pick<MoveConceptResult['ownDevelopment'][number],
    'kind' | 'status' | 'anchor' | 'groupStones' | 'direction' | 'corridor' | 'pressurePoints' | 'counterEvidence'> & {
    move: string; color: 'B' | 'W'
  }>
  candidateMoveEffects: Array<{ move: string; color: 'B' | 'W'; effects: MoveBoardEffects }>
  entries: Array<{ role: 'played' | 'candidate'; move: string; color: 'B' | 'W'; concepts: MoveConceptResult }>
  prompt: string
}

/** Only root candidates share this board. PV continuations require separate replay. */
export function buildMoveConceptEvidence(input: {
  moveNumber: number
  gameId?: string
  trialBranchHash?: string
  boardSize: number
  boardSnapshot?: Array<{ point: string; color: 'B' | 'W' }>
  moveHistory?: Array<{ point: string; color: 'B' | 'W' }>
  playedMove?: string
  playerColor?: 'B' | 'W'
  analysis?: KataGoMoveAnalysis
}): MoveConceptEvidence {
  const proposed = input.analysis
  const samePoint = (a: string | undefined, b: string | undefined) => Boolean(a && b && a.trim().toUpperCase() === b.trim().toUpperCase())
  // Use one identity gate for every analysis-derived field, not only globalPriority.
  const analysis = proposed?.moveNumber === input.moveNumber && proposed.boardSize === input.boardSize &&
    (!input.gameId || proposed.gameId === input.gameId) &&
    (proposed.trialContext?.active ? proposed.trialContext.branchHash : undefined) === input.trialBranchHash &&
    proposed.currentMove && (proposed.currentMove.moveNumber === undefined || proposed.currentMove.moveNumber === input.moveNumber) &&
    (!input.playerColor || proposed.currentMove.color === input.playerColor) &&
    (!input.playedMove || samePoint(proposed.currentMove.gtp, input.playedMove))
    ? proposed : undefined
  const color = input.playerColor ?? analysis?.currentMove?.color
  const playedMove = input.playedMove ?? analysis?.currentMove?.gtp
  const globalPriority = color && playedMove ? buildGlobalPriorityEvidence({
    ...input, playedMove, playerColor: color, boardTiming: 'before-move', analysis
  }) : undefined
  const boardGroups = color && playedMove ? buildBoardGroupRelations({
    boardSize: input.boardSize, boardSnapshot: input.boardSnapshot, playedMove, playerColor: color
  }) : undefined
  const moveEffects = color && playedMove ? buildMoveBoardEffects({
    boardSize: input.boardSize, boardSnapshot: input.boardSnapshot, playedMove, playerColor: color, moveHistory: input.moveHistory
  }) : undefined
  const candidateMoveEffects: MoveConceptEvidence['candidateMoveEffects'] = []
  const entries: MoveConceptEvidence['entries'] = []
  if (color && playedMove) entries.push({ role: 'played', move: playedMove, color, concepts: recognizeMoveConcepts({
    boardSize: input.boardSize, boardSnapshot: input.boardSnapshot, moveHistory: input.moveHistory, playerColor: color, playedMove
  }) })
  if (color && input.boardSnapshot && analysis) {
    for (const candidate of analysis.before.topMoves.slice(0, 3)) {
      if (candidate.move === playedMove) continue
      candidateMoveEffects.push({ move: candidate.move, color, effects: buildMoveBoardEffects({
        boardSize: input.boardSize, boardSnapshot: input.boardSnapshot, playedMove: candidate.move,
        playerColor: color, moveHistory: input.moveHistory
      }) })
      entries.push({ role: 'candidate', move: candidate.move, color, concepts: recognizeMoveConcepts({
        boardSize: input.boardSize, boardSnapshot: input.boardSnapshot, moveHistory: input.moveHistory, playerColor: color, playedMove: candidate.move
      }) })
    }
  }
  // Project only already-recognized root candidates on this before-move board.
  // Keep compact purpose facts ahead of effects/graphs; PV continuations never enter here.
  const candidateOwnDevelopment: MoveConceptEvidence['candidateOwnDevelopment'] = entries
    .filter(entry => entry.role === 'candidate')
    .flatMap(entry => entry.concepts.ownDevelopment.slice(0, 2).map(candidate => ({
      move: entry.move, color: entry.color, kind: candidate.kind, status: candidate.status,
      anchor: candidate.anchor, groupStones: candidate.groupStones, direction: candidate.direction,
      corridor: candidate.corridor, pressurePoints: candidate.pressurePoints,
      counterEvidence: candidate.counterEvidence
    })))
  return {
    // The complete coordinate inventory and global comparison survive verbose effects/graph truncation.
    boardCoordinates: boardGroups?.status === 'observed' ? {
      timing: 'before-move', boardSize: input.boardSize, moveNumber: input.moveNumber,
      stonesByColor: boardGroups.positionFacts.stonesByColor
    } : undefined,
    globalPriority,
    candidateOwnDevelopment,
    moveEffects,
    candidateMoveEffects,
    boardGroups,
    moveNumber: input.moveNumber,
    boardTiming: 'before-move',
    prompt: entries.length ? entries.map((entry) => `${entry.role === 'played' ? '实战/当前手' : 'AI根候选'} ${entry.color} ${entry.move}（第${input.moveNumber}手落子前）\n${formatMoveConceptsForPrompt(entry.concepts)}`).join('\n\n')
      : '缺少当前手颜色或落子前棋盘证据，不能确定跳、拆、飞攻或飞压等术语。',
    entries
  }
}
