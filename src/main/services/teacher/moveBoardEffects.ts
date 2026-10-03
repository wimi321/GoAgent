/** Immediate board transitions, not life/death judgements or history-aware legality. */
type Color = 'B' | 'W'
type Stone = { point: string; color: Color }
export interface EffectChain {
  id: string
  color: Color
  stoneCount: number
  neighboringStones: string[]
  liberties: string[]
}
interface FullChain { id: string; color: Color; stones: string[]; liberties: string[] }
export interface KoConnectionEvidence {
  kind: 'ko-connection'
  status: 'observed-structure'
  connectedSingleton: string
  otherFriendlyChainIds: string[]
  opponentProbe: { color: Color; move: string; capturedStones: string[]; resultingChain: EffectChain }
  structuralRecapture: { color: Color; move: string; capturedStones: string[]; restoresBeforeBoard: true }
  wording: string
  limitations: string[]
}
export interface MoveBoardEffects {
  /** Keep the useful explanation before verbose chain inventories in tool serialization. */
  prompt: string
  status: 'observed' | 'abstained'
  boardTiming: 'before-move'
  legality: 'board-only-not-history-verified'
  actual?: {
    color: Color
    move: string
    adjacentFriendlyChains: EffectChain[]
    adjacentEnemyChains: EffectChain[]
    capturedStones: string[]
    mergedFriendlyChainIds: string[]
    resultingChain: EffectChain
    libertyChanges: Array<{ beforeChainId: string; before: string[]; after: string[]; lost: string[]; gained: string[] }>
  }
  koConnection?: KoConnectionEvidence
  limitations: string[]
}
const COLUMNS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
const LIMITATIONS = [
  '这里只验证占点、提子、自杀及正交串变化；未结合完整棋谱和规则验证劫禁、超级劫或轮次合法性。',
  '气数与连接事实不证明棋块死活、弱龙补强、整龙已活或本手目的；这些判断需要独立证据。'
]
function parse(raw: unknown, size: number): string | undefined {
  if (typeof raw !== 'string') return undefined
  const match = /^([A-HJ-Z])([1-9]\d?)$/.exec(raw.trim().toUpperCase())
  if (!match || COLUMNS.indexOf(match[1]) >= size || Number(match[2]) > size) return undefined
  return `${match[1]}${Number(match[2])}`
}
function neighbors(point: string, size: number): string[] {
  const x = COLUMNS.indexOf(point[0]); const y = Number(point.slice(1)) - 1
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .filter(([a, b]) => a >= 0 && a < size && b >= 0 && b < size)
    .map(([a, b]) => `${COLUMNS[a]}${b + 1}`)
}
function ordered(points: Iterable<string>): string[] {
  return [...points].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)) || COLUMNS.indexOf(a[0]) - COLUMNS.indexOf(b[0]))
}
function chainAt(board: Map<string, Color>, point: string, size: number): FullChain {
  const color = board.get(point)!
  const stones = new Set<string>(); const liberties = new Set<string>(); const pending = [point]
  while (pending.length) {
    const p = pending.pop()!
    if (stones.has(p)) continue
    stones.add(p)
    for (const q of neighbors(p, size)) {
      if (!board.has(q)) liberties.add(q)
      else if (board.get(q) === color && !stones.has(q)) pending.push(q)
    }
  }
  const sorted = ordered(stones)
  return { id: `${color}:${sorted[0]}`, color, stones: sorted, liberties: ordered(liberties) }
}
function adjacentChains(board: Map<string, Color>, point: string, size: number): FullChain[] {
  const found = new Map<string, FullChain>()
  for (const q of neighbors(point, size)) if (board.has(q)) {
    const chain = chainAt(board, q, size); found.set(chain.id, chain)
  }
  return [...found.values()]
}
function compact(chain: FullChain, move: string, size: number): EffectChain {
  const adjacent = new Set(neighbors(move, size))
  return { id: chain.id, color: chain.color, stoneCount: chain.stones.length,
    neighboringStones: chain.stones.filter((point) => adjacent.has(point)), liberties: chain.liberties }
}
/** Repetition is deliberately ignored: a ko recapture is a structural probe, not a legal PV. */
function simulate(board: Map<string, Color>, point: string, color: Color, size: number):
  { board: Map<string, Color>; captured: string[]; chain: FullChain } | undefined {
  if (board.has(point)) return undefined
  const next = new Map(board); next.set(point, color)
  const captured = new Set<string>()
  for (const chain of adjacentChains(next, point, size)) if (chain.color !== color && !chain.liberties.length) {
    for (const stone of chain.stones) { next.delete(stone); captured.add(stone) }
  }
  const chain = chainAt(next, point, size)
  if (!chain.liberties.length) return undefined
  return { board: next, captured: ordered(captured), chain }
}
function sameBoard(a: Map<string, Color>, b: Map<string, Color>): boolean {
  return a.size === b.size && [...a].every(([point, color]) => b.get(point) === color)
}
function abstain(reason: string): MoveBoardEffects {
  return { prompt: `落子效果证据弃权：${reason}`, status: 'abstained', boardTiming: 'before-move',
    legality: 'board-only-not-history-verified', limitations: [...LIMITATIONS, reason] }
}

export function buildMoveBoardEffects(input: {
  boardSize: number
  boardSnapshot?: Stone[]
  playerColor: Color
  playedMove: string
  /** Accepted for callers; partial history cannot establish rule-aware repetition legality. */
  moveHistory?: Stone[]
}): MoveBoardEffects {
  const size = input.boardSize
  if (!Number.isInteger(size) || size < 2 || size > COLUMNS.length) return abstain('棋盘尺寸无效。')
  if (!Array.isArray(input.boardSnapshot)) return abstain('缺少完整落子前棋盘。')
  if (input.playerColor !== 'B' && input.playerColor !== 'W') return abstain('落子颜色无效。')
  const move = parse(input.playedMove, size)
  if (!move) return abstain('落点无效或为停着。')
  const board = new Map<string, Color>()
  for (const stone of input.boardSnapshot) {
    const point = parse(stone?.point, size)
    if (!point || (stone.color !== 'B' && stone.color !== 'W')) return abstain('棋盘包含无效棋子。')
    if (board.has(point)) return abstain('棋盘包含重复或冲突落点。')
    board.set(point, stone.color)
  }
  if (board.has(move)) return abstain('落点已被占用；必须提供落子前棋盘。')
  const checked = new Set<string>()
  for (const point of board.keys()) if (!checked.has(point)) {
    const chain = chainAt(board, point, size)
    if (!chain.liberties.length) return abstain('落子前棋盘含无气串，无法可靠模拟。')
    for (const stone of chain.stones) checked.add(stone)
  }
  const adjacent = adjacentChains(board, move, size)
  const friends = adjacent.filter((chain) => chain.color === input.playerColor)
  const enemies = adjacent.filter((chain) => chain.color !== input.playerColor)
  const actual = simulate(board, move, input.playerColor, size)
  if (!actual) return abstain('落子在不允许自杀的局部模拟中无气；无法确认本手效果。')
  let koConnection: KoConnectionEvidence | undefined
  // A connection needs two genuinely different strings, not multiple neighbors of one string.
  if (friends.length >= 2 && actual.captured.length === 0) {
    const opponent: Color = input.playerColor === 'B' ? 'W' : 'B'
    const probe = simulate(board, move, opponent, size)
    if (probe?.captured.length === 1 && probe.chain.stones.length === 1 && probe.chain.liberties.length === 1) {
      const target = probe.captured[0]
      const singleton = friends.find((chain) => chain.stones.length === 1 && chain.stones[0] === target &&
        chain.liberties.length === 1 && chain.liberties[0] === move)
      const recapture = singleton && probe.chain.liberties[0] === target ? simulate(probe.board, target, input.playerColor, size) : undefined
      if (recapture?.captured.length === 1 && recapture.captured[0] === move && sameBoard(recapture.board, board)) {
        const other = friends.filter((chain) => chain.id !== singleton!.id)
        koConnection = {
          kind: 'ko-connection', status: 'observed-structure', connectedSingleton: target,
          otherFriendlyChainIds: other.map((chain) => chain.id),
          opponentProbe: { color: opponent, move, capturedStones: probe.captured, resultingChain: compact(probe.chain, target, size) },
          structuralRecapture: { color: input.playerColor, move: target, capturedStones: recapture.captured, restoresBeforeBoard: true },
          wording: `${input.playerColor}${move}把仅剩${move}一气的单子${target}与其它己方正交串连接，可称粘劫，消除这里的单子劫争结构。`,
          limitations: ['对手占点与回提只是在落子前棋盘上的反事实结构探测，不是实战后应手，也不是立即合法回提或必然变化。',
            '回提模拟忽略重复局面禁令；完整恢复原盘只证明劫循环形状，不证明劫争价值、单片劫分类或整块棋的死活。']
        }
      }
    }
  }
  const merged = friends.length >= 2 ? friends.map((chain) => chain.id) : []
  const libertyChanges = friends.map((chain) => ({ beforeChainId: chain.id, before: chain.liberties, after: actual.chain.liberties,
    lost: chain.liberties.filter((point) => !actual.chain.liberties.includes(point)),
    gained: actual.chain.liberties.filter((point) => !chain.liberties.includes(point)) }))
  const prompt = [
    `落子即时效果（完整落子前棋盘，局部模拟）：实际${input.playerColor}${move}；${actual.captured.length ? `提掉${actual.captured.join('、')}` : '没有提子'}。`,
    ...(koConnection ? [`结构[ko-connection] ${koConnection.wording}`, ...koConnection.limitations] : []),
    `落点相邻己方真实串：${friends.map((chain) => `${chain.id}(${chain.stones.length}子)，相邻棋子={${compact(chain, move, size).neighboringStones.join('、')}}，原气={${chain.liberties.join('、')}}`).join('；') || '无'}。`,
    merged.length ? `本手连接${merged.length}个此前分开的己方正交串；这些是连接事实，不能直接解释为弱龙补强。` : '本手没有合并多个此前分开的己方正交串。',
    `落子后所在串${actual.chain.stones.length}子，气={${actual.chain.liberties.join('、')}}。`, ...LIMITATIONS
  ].join('\n')
  return { prompt, status: 'observed', boardTiming: 'before-move', legality: 'board-only-not-history-verified',
    koConnection, actual: { color: input.playerColor, move, adjacentFriendlyChains: friends.map((chain) => compact(chain, move, size)),
      adjacentEnemyChains: enemies.map((chain) => compact(chain, move, size)), capturedStones: actual.captured,
      mergedFriendlyChainIds: merged, resultingChain: compact(actual.chain, move, size), libertyChanges }, limitations: LIMITATIONS.slice() }
}
