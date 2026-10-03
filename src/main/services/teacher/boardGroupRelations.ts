import { buildOwnDevelopment, type OwnDevelopmentCandidate } from './ownDevelopment'
/** Board facts and explainable regional intentions, never tactical or life/death verdicts. */
type Color = 'B' | 'W'
type Stone = { point: string; color: Color }
type Point = { point: string; x: number; y: number }
export interface ConnectedBoardGroup {
  id: string
  color: Color
  stones: string[]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  emptyAdjacentPoints: string[]
}
export interface PotentialBoardLink {
  color: Color
  groups: [string, string]
  endpoints: [string, string]
  kind: 'diagonal' | 'jump' | 'knight'
  emptyPath: string[]
  status: 'potential-not-connected'
}
export interface RegionalIntent {
  kind: 'contest-head' | 'separate-contact'
  status: 'hypothesis'
  targetGroups: string[]
  targetStones: string[]
  friendlySupport: string[]
  evidence: string[]
  limitations: string[]
  wording: string
}
export interface BoardGroupRelations {
  status: 'observed' | 'abstained'
  positionFacts: {
    timing: 'before-move'
    stonesByColor: { B: string[]; W: string[] }
    connectedGroups: ConnectedBoardGroup[]
    potentialLinks: PotentialBoardLink[]
  }
  ownDevelopment: OwnDevelopmentCandidate[]
  regionIntents: RegionalIntent[]
  prompt: string
  limitations: string[]
}
const COLUMNS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
const LIMITATIONS = ['正交连通串不等于战略整龙；潜在联系不等于已经连接。', '意图候选只描述可核对的方向和配置，不证明分割、封锁已经成功，不判断死活或唯一逃路。']
function parse(raw: unknown, size: number): Point | undefined {
  if (typeof raw !== 'string') return undefined
  const point = raw.trim().toUpperCase(); const match = /^([A-HJ-Z])([1-9]\d?)$/.exec(point)
  if (!match) return undefined
  const x = COLUMNS.indexOf(match[1]); const y = Number(match[2]) - 1
  return x >= 0 && x < size && y >= 0 && y < size ? { point, x, y } : undefined
}
const name = (x: number, y: number) => `${COLUMNS[x]}${y + 1}`
const distance = (a: Point, b: Point) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
const compare = (a: Point, b: Point) => a.y - b.y || a.x - b.x
function neighbors(p: Point, size: number): Point[] {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy, point: name(p.x + dx, p.y + dy) }))
    .filter((q) => q.x >= 0 && q.x < size && q.y >= 0 && q.y < size)
}
function abstain(reason: string): BoardGroupRelations {
  return { status: 'abstained', positionFacts: { timing: 'before-move', stonesByColor: { B: [], W: [] }, connectedGroups: [], potentialLinks: [] }, ownDevelopment: [], regionIntents: [], limitations: [...LIMITATIONS, reason], prompt: `棋块/区域证据弃权：${reason}` }
}
/** A single monotone shortest empty path is an observed route, not a guaranteed connection. */
function emptyPath(a: Point, b: Point, board: Map<string, Color>): string[] | undefined {
  const visit = (p: Point, path: string[]): string[] | undefined => {
    if (p.point === b.point) return path
    for (const [dx, dy] of [[Math.sign(b.x - p.x), 0], [0, Math.sign(b.y - p.y)]]) {
      if (!dx && !dy) continue
      const q = { x: p.x + dx, y: p.y + dy, point: name(p.x + dx, p.y + dy) }
      if (q.point !== b.point && board.has(q.point)) continue
      const result = visit(q, q.point === b.point ? path : [...path, q.point])
      if (result) return result
    }
    return undefined
  }
  return visit(a, [])
}
function linkKind(a: Point, b: Point): PotentialBoardLink['kind'] | undefined {
  const [low, high] = [Math.abs(a.x - b.x), Math.abs(a.y - b.y)].sort((x, y) => x - y)
  if (low === 1 && high === 1) return 'diagonal'
  if (low === 0 && (high === 2 || high === 3)) return 'jump'
  if (low === 1 && (high === 2 || high === 3)) return 'knight'
  return undefined
}

export function buildBoardGroupRelations(input: { boardSize: number; boardSnapshot?: Stone[]; playerColor: Color; playedMove: string }): BoardGroupRelations {
  const size = input.boardSize
  if (!Number.isInteger(size) || size < 2 || size > COLUMNS.length) return abstain('棋盘尺寸无效。')
  if (!Array.isArray(input.boardSnapshot)) return abstain('缺少完整落子前棋盘。')
  if (input.playerColor !== 'B' && input.playerColor !== 'W') return abstain('实际落子颜色无效。')
  const move = parse(input.playedMove, size)
  if (!move) return abstain('落点无效或为停着。')
  const board = new Map<string, Color>(); const points = new Map<string, Point>()
  for (const stone of input.boardSnapshot) {
    const p = parse(stone?.point, size)
    if (!p || (stone.color !== 'B' && stone.color !== 'W')) return abstain('棋盘包含无效棋子。')
    if (board.has(p.point)) return abstain('棋盘包含重复或冲突落点。')
    board.set(p.point, stone.color); points.set(p.point, p)
  }
  if (board.has(move.point)) return abstain('落点已被占用；需要落子前棋盘。')
  const ordered = [...points.values()].sort(compare)
  const stonesByColor: { B: string[]; W: string[] } = { B: [], W: [] }
  for (const p of ordered) stonesByColor[board.get(p.point)!].push(p.point)
  const connectedGroups: ConnectedBoardGroup[] = []; const visited = new Set<string>()
  for (const first of ordered) {
    if (visited.has(first.point)) continue
    const color = board.get(first.point)!; const pending = [first]; const group: Point[] = []; const empty = new Set<string>()
    visited.add(first.point)
    while (pending.length) {
      const p = pending.pop()!; group.push(p)
      for (const q of neighbors(p, size)) {
        if (!board.has(q.point)) empty.add(q.point)
        else if (board.get(q.point) === color && !visited.has(q.point)) { visited.add(q.point); pending.push(q) }
      }
    }
    group.sort(compare)
    connectedGroups.push({ id: `${color}:${group[0].point}`, color, stones: group.map((p) => p.point),
      bounds: { minX: Math.min(...group.map((p) => p.x)), maxX: Math.max(...group.map((p) => p.x)), minY: Math.min(...group.map((p) => p.y)), maxY: Math.max(...group.map((p) => p.y)) },
      emptyAdjacentPoints: [...empty].sort((a, b) => compare(points.get(a) ?? parse(a, size)!, points.get(b) ?? parse(b, size)!)) })
  }
  const potentialLinks: PotentialBoardLink[] = []
  for (let i = 0; i < connectedGroups.length; i++) for (let j = i + 1; j < connectedGroups.length; j++) {
    const a = connectedGroups[i]; const b = connectedGroups[j]
    if (a.color !== b.color) continue
    // Preserve one shortest representative per pair; never merge the real groups.
    const candidates = a.stones.flatMap((x) => b.stones.map((y) => ({ a: points.get(x)!, b: points.get(y)! })))
      .filter(({ a, b }) => linkKind(a, b)).sort((x, y) => distance(x.a, x.b) - distance(y.a, y.b) || compare(x.a, y.a) || compare(x.b, y.b))
    for (const pair of candidates) {
      const path = emptyPath(pair.a, pair.b, board)
      if (!path) continue
      potentialLinks.push({ color: a.color, groups: [a.id, b.id], endpoints: [pair.a.point, pair.b.point], kind: linkKind(pair.a, pair.b)!, emptyPath: path, status: 'potential-not-connected' }); break
    }
  }
  const ownDevelopment = buildOwnDevelopment(input)
  const enemy: Color = input.playerColor === 'B' ? 'W' : 'B'
  const enemyGroups = connectedGroups.filter((g) => g.color === enemy)
  const friendlyPoints = stonesByColor[input.playerColor].map((p) => points.get(p)!)
  const support = friendlyPoints.filter((p) => distance(p, move) <= 4 &&
    (Math.abs(p.x - move.x) + Math.abs(p.y - move.y) === 1 || linkKind(p, move)) && emptyPath(p, move, board))
  const regionIntents: RegionalIntent[] = []
  const groupById = new Map(connectedGroups.map((g) => [g.id, g]))
  // A regional index is deliberately narrower than the full analogy graph.
  // Only close diagonal / one-space jumps participate; weak knights and wider
  // jumps remain context and cannot transitively turn half a board into a target.
  const strongRegionalLinks = potentialLinks.filter((link) => {
    const a = points.get(link.endpoints[0])!; const b = points.get(link.endpoints[1])!
    return link.kind === 'diagonal' || (link.kind === 'jump' && distance(a, b) === 2)
  })
  const localEnemyGroups = enemyGroups.filter((group) => group.stones.some((stone) => distance(points.get(stone)!, move) <= 6))
  const localGroupIds = new Set(localEnemyGroups.map((group) => group.id))
  const clusterVisited = new Set<string>()
  for (const seed of localEnemyGroups) {
    if (clusterVisited.has(seed.id)) continue
    const ids = new Set([seed.id]); const pending = [seed.id]; clusterVisited.add(seed.id)
    while (pending.length) {
      const id = pending.pop()!
      for (const link of strongRegionalLinks.filter((l) => l.color === enemy && l.groups.includes(id))) {
        const other = link.groups.find((x) => x !== id)!
        if (localGroupIds.has(other) && !ids.has(other)) { ids.add(other); pending.push(other); clusterVisited.add(other) }
      }
    }
    const targets = [...ids].flatMap((id) => groupById.get(id)!.stones).map((p) => points.get(p)!)
    if (targets.length < 2) continue
    const edges = [
      { label: '左边', depth: Math.min(...targets.map((p) => p.x)), nx: 1, ny: 0 },
      { label: '右边', depth: Math.min(...targets.map((p) => size - 1 - p.x)), nx: -1, ny: 0 },
      { label: '下边', depth: Math.min(...targets.map((p) => p.y)), nx: 0, ny: 1 },
      { label: '上边', depth: Math.min(...targets.map((p) => size - 1 - p.y)), nx: 0, ny: -1 }
    ].sort((a, b) => a.depth - b.depth)
    if (edges[0].depth > 3 || edges[0].depth === edges[1].depth) continue
    const frame = edges[0]; const normal = (p: Point) => p.x * frame.nx + p.y * frame.ny
    const tangent = (p: Point) => p.x * frame.ny - p.y * frame.nx
    const front = Math.max(...targets.map(normal)); const advance = normal(move) - front
    const frontTargets = targets.filter((p) => normal(p) === front)
    const nearbyFront = frontTargets.find((p) => distance(p, move) <= 3 && Math.abs(tangent(p) - tangent(move)) <= 2 && emptyPath(p, move, board))
    if (!nearbyFront || advance < 1 || advance > 3) continue
    const frontSupports = support.filter((p) => normal(p) >= front - 1)
    const left = frontSupports.filter((p) => tangent(p) < tangent(nearbyFront)); const right = frontSupports.filter((p) => tangent(p) > tangent(nearbyFront))
    if (!left.length || !right.length) continue
    const supports = [...left, ...right].map((p) => p.point)
    regionIntents.push({ kind: 'contest-head', status: 'hypothesis', targetGroups: [...ids], targetStones: targets.sort(compare).map((p) => p.point), friendlySupport: supports,
      evidence: [`敌方这一片棋最靠近${frame.label}，其向中腹前沿包括${frontTargets.map((p) => p.point).join('、')}。`, `${move.point}位于该前沿朝中腹方向${advance}格，近前沿${nearbyFront.point}；两侧己棋${supports.join('、')}有近距离开放几何支持。`, `前沿到落点存在空路径${emptyPath(nearbyFront, move, board)!.join('、')}，仅为一条可见路线。`],
      limitations: [...LIMITATIONS, '区域索引只纳入有棋子距落点六格内的真实串，以尖/空一间跳作强邻接；其它弱联系仅作上下文。这不是已确认整条龙，对手其它出头和联络路线仍需验证。'],
      wording: `${move.point}结合两侧己棋配置，可能争夺敌方${targets.map((p) => p.point).join('、')}这一片棋向中腹的头部位置，带有限制出头/封锁的意图；实际效果待验证。` })
  }
  // Wider regional contact, not restricted to an exact symmetric pair of stones.
  const separations: Array<RegionalIntent & { rank: number; directionKey: string }> = []
  if (support.length) for (let i = 0; i < enemyGroups.length; i++) for (let j = i + 1; j < enemyGroups.length; j++) {
    const a = enemyGroups[i]; const b = enemyGroups[j]
    if (potentialLinks.some((l) => l.groups.includes(a.id) && l.groups.includes(b.id))) continue
    const pairs = a.stones.flatMap((x) => b.stones.map((y) => ({ a: points.get(x)!, b: points.get(y)! })))
    for (const pair of pairs) {
      const da = distance(pair.a, move); const db = distance(pair.b, move); const span = distance(pair.a, pair.b)
      if (Math.min(da, db) > 2 || Math.max(da, db) > 7 || span < 3 || span > 8) continue
      const dx = pair.b.x - pair.a.x; const dy = pair.b.y - pair.a.y; const length2 = dx * dx + dy * dy
      const t = ((move.x - pair.a.x) * dx + (move.y - pair.a.y) * dy) / length2
      const off = Math.abs((move.x - pair.a.x) * dy - (move.y - pair.a.y) * dx) / Math.sqrt(length2)
      if (t < 0.12 || t > 0.88 || off > 1.2) continue
      if (!emptyPath(pair.a, move, board) || !emptyPath(move, pair.b, board)) continue
      const near = da <= db ? pair.a : pair.b; const far = da <= db ? pair.b : pair.a
      const nearGroup = da <= db ? a.id : b.id
      separations.push({ kind: 'separate-contact', status: 'hypothesis', targetGroups: [a.id, b.id], targetStones: [...a.stones, ...b.stones], friendlySupport: support.map((p) => p.point), rank: da + db + off,
        directionKey: `${nearGroup}:${Math.sign(far.x - near.x)},${Math.sign(far.y - near.y)}`,
        evidence: [`敌棋${pair.a.point}与${pair.b.point}属于不同正交连通串。`, `${move.point}处于两串代表点的联络方向之间，投影比例${t.toFixed(2)}、偏离约${off.toFixed(2)}格；附近己棋${support.map((p) => p.point).join('、')}有开放几何支持。`, '双方代表点到落点各有空路径；这是区域方向证据，不是原来已连接或必然可连接的证明。'],
        limitations: [...LIMITATIONS, '两区域仍可能经其它方向联络；当前几何不能验证分断，也没有证明联络本来是其最佳计划。'],
        wording: `${move.point}位于敌棋${pair.a.point}与${pair.b.point}这一侧区域的联络方向之间，可能有分割两片棋联系的意图；是否有效需检查敌方应对。` })
      break
    }
  }
  const representedDirections = new Set<string>()
  for (const { rank: _rank, directionKey, ...intent } of separations.sort((a, b) => a.rank - b.rank)) {
    if (regionIntents.length >= 3) break
    if (representedDirections.has(directionKey)) continue
    representedDirections.add(directionKey)
    regionIntents.push(intent)
  }
  const limitedIntents = regionIntents.slice(0, 3)
  // Full coordinate facts remain structured and complete; prompt focuses on useful groups.
  const related = connectedGroups.filter((g) => g.stones.some((p) => distance(points.get(p)!, move) <= 7))
  const other = connectedGroups.filter((g) => !related.includes(g))
  const lines = ['棋块/区域证据（来自完整落子前坐标，非图片猜测）；工具文本可能截断尾部图明细，不能把收到的图当作穷尽。', ...LIMITATIONS,
    `实际${input.playerColor}落点=${move.point}。`,
    ...ownDevelopment.map((i) => `自身发展[${i.kind}/hypothesis] ${i.wording}\n支持事实：${i.evidence.join('；')}\n反证/未验证：${i.counterEvidence.join('；')}`),
    ...limitedIntents.map((i) => `区域意图[${i.kind}/hypothesis] ${i.wording}\n支持事实：${i.evidence.join('；')}\n未验证：${i.limitations.join('；')}`),
    `相关正交串：${related.map((g) => `${g.id}={${g.stones.join('、')}}`).join('；') || '无'}`,
    `相关潜在联系（不合并串）：${potentialLinks.filter((l) => related.some((g) => l.groups.includes(g.id))).map((l) => `${l.endpoints.join('↔')} ${l.kind}，一条空路径=${l.emptyPath.join('、')}`).join('；') || '无'}`,
    `其它区域范围：${other.map((g) => `${g.id} ${name(g.bounds.minX, g.bounds.minY)}—${name(g.bounds.maxX, g.bounds.maxY)}(${g.stones.length}子)`).join('；') || '无'}`]
  // Omit verbose graph context first. Hypotheses/facts are never fabricated to fill the budget.
  let prompt = lines.join('\n')
  if (prompt.length > 6000) prompt = [...lines.slice(0, 4 + ownDevelopment.length + limitedIntents.length), `相关串范围：${related.map((g) => `${g.id} ${g.stones.length}子 ${name(g.bounds.minX, g.bounds.minY)}—${name(g.bounds.maxX, g.bounds.maxY)}`).join('；')}`, '详细坐标与潜在联系保留于positionFacts，摘要未穷尽。'].join('\n').slice(0, 6000)
  // Preserve the actionable summary and source coordinate list before verbose
  // graph details when normal tool serialization imposes a text-size limit.
  return { status: 'observed', ownDevelopment, regionIntents: limitedIntents, prompt, limitations: [...LIMITATIONS],
    positionFacts: { timing: 'before-move', stonesByColor, connectedGroups, potentialLinks } }
}
