export interface OwnDevelopmentCandidate {
  kind: 'own-development' | 'side-extension'
  status: 'hypothesis'
  groupStones: string[]
  anchor: string
  move: string
  geometry: 'jump' | 'knight'
  direction: 'inward' | 'along-side'
  pressurePoints: string[]
  contactPressurePoints: string[]
  corridor: string[]
  evidence: string[]
  counterEvidence: string[]
  wording: string
}
const COLS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
type P = { point: string; x: number; y: number }
/** Position facts only: development is not an assessment that a group is weak or alive. */
export function buildOwnDevelopment(input: { boardSize: number; boardSnapshot?: Array<{point: string; color: 'B' | 'W'}>; playedMove: string; playerColor: 'B' | 'W' }): OwnDevelopmentCandidate[] {
  const size = input.boardSize
  const parse = (raw: string): P | undefined => {
    const m = /^([A-HJ-Z])([1-9]\d?)$/.exec(raw.trim().toUpperCase())
    if (!m) return undefined
    const x = COLS.indexOf(m[1]); const y = Number(m[2]) - 1
    return x >= 0 && x < size && y >= 0 && y < size ? { point: `${COLS[x]}${y + 1}`, x, y } : undefined
  }
  if (!Number.isInteger(size) || size < 2 || size > COLS.length || !input.boardSnapshot || !['B', 'W'].includes(input.playerColor)) return []
  const move = parse(input.playedMove); if (!move) return []
  const board = new Map<string, 'B' | 'W'>(); const friends: P[] = []; const enemies: P[] = []
  for (const stone of input.boardSnapshot) {
    const p = parse(stone.point)
    if (!p || !['B', 'W'].includes(stone.color) || board.has(p.point)) return []
    board.set(p.point, stone.color); (stone.color === input.playerColor ? friends : enemies).push(p)
  }
  if (board.has(move.point)) return []
  const dist = (a: P, b: P) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
  const touch = (a: P, b: P) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
  const groups: P[][] = []; const visited = new Set<string>()
  for (const seed of friends) {
    if (visited.has(seed.point)) continue
    const group = [seed]; visited.add(seed.point)
    for (let i = 0; i < group.length; i++) for (const p of friends) if (!visited.has(p.point) && touch(group[i], p)) { visited.add(p.point); group.push(p) }
    groups.push(group)
  }
  const result: OwnDevelopmentCandidate[] = []
  for (const group of groups) for (const anchor of group) {
    const dx = move.x - anchor.x; const dy = move.y - anchor.y
    const axes = [Math.abs(dx), Math.abs(dy)].sort((a, b) => a - b)
    const jump = axes[0] === 0 && axes[1] >= 2 && axes[1] <= 4
    const knight = axes[0] === 1 && axes[1] >= 2 && axes[1] <= 3
    if (!jump && !knight) continue
    const corridor: string[] = []
    if (jump) for (let i = 1; i < axes[1]; i++) corridor.push(`${COLS[anchor.x + Math.sign(dx) * i]}${anchor.y + Math.sign(dy) * i + 1}`)
    if (corridor.some(p => board.has(p))) continue
    // Knight shapes have no unique corridor. Require at least one open monotone route.
    const route = (x: number, y: number): boolean => {
      if (x === move.x && y === move.y) return true
      for (const [nx, ny] of [[x + Math.sign(move.x - x), y], [x, y + Math.sign(move.y - y)]]) {
        if (nx === x && ny === y) continue
        if (!board.has(`${COLS[nx]}${ny + 1}`) && route(nx, ny)) return true
      }
      return false
    }
    if (knight && !route(anchor.x, anchor.y)) continue
    const pressure = enemies.filter(p => group.some(a => dist(a, p) <= 4))
    const contacts = pressure.filter(p => group.some(a => touch(a, p)))
    const frames = [{depth:anchor.x,nx:1,ny:0},{depth:size-1-anchor.x,nx:-1,ny:0},{depth:anchor.y,nx:0,ny:1},{depth:size-1-anchor.y,nx:0,ny:-1}]
    const min = Math.min(...frames.map(f => f.depth))
    if (min > 3) continue
    for (const f of frames.filter(f => f.depth === min)) {
      const inward = dx*f.nx + dy*f.ny; const tangent = dx*f.ny - dy*f.nx
      const along = inward === 0 && jump
      const toward = inward > 0 && inward >= Math.abs(tangent)
      const ux = along ? Math.sign(dx) : dx; const uy = along ? Math.sign(dy) : dy
      const projection = (p: P) => (p.x-anchor.x)*ux + (p.y-anchor.y)*uy
      if (group.some(p => projection(p) > 0)) continue // the anchor must be this real string's frontier
      const tangentEscape = along && contacts.length >= 2 && pressure.filter(p => dist(p, anchor) <= 2).every(p => projection(p) < projection(move))
      const inwardDevelopment = toward && pressure.length >= 2 && pressure.some(p => projection(p) < 0)
      if (!along && !inwardDevelopment) continue
      const pressuredDevelopment = tangentEscape || inwardDevelopment
      const endpointEnemies = enemies.filter(p => dist(p, move) <= 2)
      const evidence = [`己方真实正交串={${group.map(p=>p.point).sort().join('、')}}；${anchor.point}是本次展开方向的前端。`, `${move.point}相对${anchor.point}为${jump?'开放直跳':'飞的几何关系'}，${along?'沿邻近边线展开':'向邻近边线的中腹一侧展开'}${corridor.length?`；中间${corridor.join('、')}为空`:''}。`]
      if (pressure.length) evidence.push(`该串四格内敌棋=${pressure.map(p=>p.point).sort().join('、')}；其中直接接触敌棋=${contacts.map(p=>p.point).sort().join('、')||'无'}，只是压力配置事实。`)
      if (tangentEscape) evidence.push('落点沿边越过锚点两格内敌方压迫点的前沿；边距不变也可能构成自身出头。')
      result.push({ kind: pressuredDevelopment?'own-development':'side-extension', status:'hypothesis', groupStones:group.map(p=>p.point).sort(), anchor:anchor.point, move:move.point, geometry:jump?'jump':'knight', direction:along?'along-side':'inward', pressurePoints:pressure.map(p=>p.point).sort(), contactPressurePoints:contacts.map(p=>p.point).sort(), corridor, evidence,
        counterEvidence:['没有评估棋块死活、根据地或唯一逃路；未验证连接和对手封锁应对。', ...(endpointEnemies.length?[`落点附近仍有敌棋${endpointEnemies.map(p=>p.point).sort().join('、')}，发展空间和拆边距离仍有竞争。`]:[])],
        wording:pressuredDevelopment?`${move.point}从己串${group.map(p=>p.point).sort().join('、')}的${anchor.point}一端${along?'沿边跳出':'向中腹发展'}，可先检查自身出头、争取发展空间的意图；不证明已逃出或安定。`:`${move.point}相对己串前端${anchor.point}沿边开放直跳，可作为拆边、展开自身的候选；不证明已安定或成空。` })
      if (along && pressuredDevelopment) {
        const development = result[result.length - 1]
        result.push({ ...development, kind: 'side-extension', wording: `${move.point}相对己串前端${anchor.point}沿边开放直跳，也可检查拆边、展开自身的意图；近终点敌棋仍需处理，不证明已安定或成空。` })
      }
    }
  }
  return result.sort((a,b)=>(a.kind==='own-development'?0:1)-(b.kind==='own-development'?0:1)||(a.geometry==='jump'?0:1)-(b.geometry==='jump'?0:1)||a.anchor.localeCompare(b.anchor))
}
