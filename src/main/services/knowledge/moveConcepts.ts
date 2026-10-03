import { buildOwnDevelopment, type OwnDevelopmentCandidate } from '../teacher/ownDevelopment'
/** A deliberately conservative, board-only concept experiment.
 * Geometry is observed; purpose is a hypothesis. No score here is calibrated confidence.
 */
export type ConceptColor = 'B' | 'W'
export type MoveGeometryKind = 'connected' | 'diagonal' | 'one-space-jump' | 'two-space-jump' | 'three-space-jump' | 'small-knight' | 'large-knight'
export interface MoveConceptInput {
  boardSize: number
  /** Complete position BEFORE the move; absence means unknown, not an empty board. */
  boardSnapshot?: Array<{ point: string; color: ConceptColor }>
  playedMove: string
  playerColor: ConceptColor
  /** Already played moves, ending BEFORE this move. Pass is allowed. */
  moveHistory?: Array<{ point: string; color: ConceptColor }>
  /** Optional external assessments. These must not be generated from liberty counts alone. */
  groupAssessments?: Array<{ stones: string[]; color: ConceptColor; status: 'unsettled' | 'settled' | 'unknown'; source: string; evidence: string[] }>
  /** KataGo ownership uses row-major order, top row first. Explicit perspective is required. */
  engineFeatures?: { ownership?: number[]; ownershipPerspective?: 'black' | 'white'; source?: string }
}
export interface MoveGeometryEvidence {
  kind: MoveGeometryKind
  label: string
  anchor: string
  move: string
  offset: { dx: number; dy: number }
  status: 'observed' | 'blocked'
  interveningPoints: string[]
  blockers: string[]
  wording: string
}
export interface MoveIntentHypothesis {
  kind: 'side-extension' | 'escape' | 'attack' | 'press'
  status: 'hypothesis'
  evidence: string[]
  counterEvidence: string[]
  wording: string
}
export interface MoveConceptResult {
  status: 'observed' | 'ambiguous' | 'abstained'
  geometry: MoveGeometryEvidence[]
  ownDevelopment: OwnDevelopmentCandidate[]
  primaryFriendlyGeometry?: MoveGeometryEvidence
  relationCandidates: MoveRelationCandidate[]
  relations: Array<{ kind: 'enemy-contact' | 'enemy-position' | 'between-enemies' | 'ownership-at-move'; points: string[]; evidence: string; offset?: { dx: number; dy: number }; value?: number }>
  intents: MoveIntentHypothesis[]
  wording: string
  limitations: string[]
}
export interface MoveRelationCandidate {
  kind: 'attachment-under' | 'contact-press' | 'cap' | 'diagonal-contact' | 'corner-entry' | 'knight-pressure' | 'corner-enclosure' | 'shoulder-probe'
  status: 'candidate'
  geometryStatus: 'observed'
  enemyAnchor?: string
  friendlyAnchor?: string
  supportingFriendPoints: string[]
  emptyPoints: string[]
  side?: 'left' | 'right' | 'bottom' | 'top'
  offset: { dx: number; dy: number }
  evidence: string[]
  counterEvidence: string[]
  wording: string
  purposeHypothesis: { status: 'hypothesis'; wording: string }
}

const COLUMNS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
const SHAPES: Record<string, [MoveGeometryKind, string]> = {
  '0,1': ['connected', '相邻连接'], '1,1': ['diagonal', '尖'],
  '0,2': ['one-space-jump', '一间跳'], '0,3': ['two-space-jump', '二间跳'],
  '0,4': ['three-space-jump', '三间跳'], '1,2': ['small-knight', '小飞'], '1,3': ['large-knight', '大飞']
}
type Point = { x: number; y: number; point: string }
function parsePoint(raw: string, size: number): Point | undefined {
  const point = raw.trim().toUpperCase()
  const match = /^([A-HJ-Z])([1-9]\d?)$/.exec(point)
  if (!match) return undefined
  const x = COLUMNS.indexOf(match[1]); const y = Number(match[2]) - 1
  return x >= 0 && x < size && y >= 0 && y < size ? { x, y, point } : undefined
}
function name(x: number, y: number): string { return `${COLUMNS[x]}${y + 1}` }
function distance(a: Point, b: Point): number { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) }
function edge(p: Point, size: number): number { return Math.min(p.x, p.y, size - 1 - p.x, size - 1 - p.y) }
function fail(reason: string): MoveConceptResult {
  return { status: 'abstained', geometry: [], ownDevelopment: [], relationCandidates: [], relations: [], intents: [], wording: '现有证据不足以命名这手棋的棋形或意图。', limitations: [reason] }
}

/** A local edge frame prevents corner edge-switches from changing inward/outward. */
function nearbySides(p: Point, size: number) {
  const sides = [
    { side: 'left' as const, depth: p.x, nx: 1, ny: 0 },
    { side: 'right' as const, depth: size - 1 - p.x, nx: -1, ny: 0 },
    { side: 'bottom' as const, depth: p.y, nx: 0, ny: 1 },
    { side: 'top' as const, depth: size - 1 - p.y, nx: 0, ny: -1 }
  ]
  const minimum = Math.min(...sides.map((s) => s.depth))
  // Ties lack a unique side direction. Targets must be within the fourth line.
  return minimum <= 3 ? sides.filter((s) => s.depth === minimum) : []
}

function recognizeRelations(input: MoveConceptInput, move: Point, enemies: Point[], board: Map<string, ConceptColor>, geometry: MoveGeometryEvidence[]): MoveRelationCandidate[] {
  const candidates: MoveRelationCandidate[] = []
  const observed = geometry.filter((g) => g.status === 'observed')
  const add = (kind: MoveRelationCandidate['kind'], enemy: Point, support: string[], emptyPoints: string[], wording: string, purpose: string, evidence: string[], side?: MoveRelationCandidate['side'], friendlyFocus = false) => {
    candidates.push({ kind, status: 'candidate', geometryStatus: 'observed', ...(friendlyFocus ? { friendlyAnchor: enemy.point } : { enemyAnchor: enemy.point }),
      supportingFriendPoints: support, emptyPoints, side, offset: { dx: move.x - enemy.x, dy: move.y - enemy.y },
      evidence, counterEvidence: ['形状关系不证明限制、封锁或防守已经成功；仍需验证敌方应对与后续变化。'], wording,
      purposeHypothesis: { status: 'hypothesis', wording: purpose } })
  }
  for (const enemy of enemies) {
    const dx = move.x - enemy.x; const dy = move.y - enemy.y
    const contact = Math.abs(dx) + Math.abs(dy) === 1
    const diagonalSupports = observed.filter((g) => g.kind === 'diagonal').filter((g) => {
      const anchor = parsePoint(g.anchor, input.boardSize)!
      // The contact is ahead of the diagonal, not on its back side.
      return edge(anchor, input.boardSize) <= 3 && (move.x - anchor.x) * (enemy.x - move.x) + (move.y - anchor.y) * (enemy.y - move.y) > 0
    })
    if (contact && diagonalSupports.length) {
      const cornerStar = input.boardSize === 19 && diagonalSupports.some((g) => {
        const anchor = parsePoint(g.anchor, 19)!
        if (![3, 15].includes(anchor.x) || ![3, 15].includes(anchor.y)) return false
        const ex = anchor.x === 3 ? enemy.x : 18 - enemy.x
        const ey = anchor.y === 3 ? enemy.y : 18 - enemy.y
        return (ex === 2 && ey === 5) || (ex === 5 && ey === 2)
      })
      add('diagonal-contact', enemy, diagonalSupports.map((g) => g.anchor), [],
      `${move.point}相对己棋${diagonalSupports.map((g) => g.anchor).join('、')}成尖，并正交接触前方敌棋${enemy.point}，可检查是否应称尖顶。`,
      cornerStar ? `可能借尖顶限制挂角子${enemy.point}向角部发展；不证明守角已经成功，具体应对仍需验证。` : `可能借尖顶向敌棋${enemy.point}施压；是否有效及是否兼有守角作用仍需读后续。`, ['己方尖的伸出方向与敌方正交接触方向一致。'])
      // Same-side spacing is context, never an invented continuation or forced reply.
      const frames = nearbySides(enemy, input.boardSize)
      if (frames.length === 1) {
        const frame = frames[0]
        for (const other of enemies) {
          const ddx = other.x - enemy.x; const ddy = other.y - enemy.y
          if (ddx * frame.nx + ddy * frame.ny !== 0 || Math.abs(ddx * frame.ny - ddy * frame.nx) !== 3) continue
          const outward = board.get(name(other.x + Math.sign(ddx) * 2, other.y + Math.sign(ddy) * 2)) === input.playerColor
          const corridor = [1, 2].map((i) => name(enemy.x + Math.sign(ddx) * i, enemy.y + Math.sign(ddy) * i))
          if (!outward || corridor.some((p) => board.has(p))) continue
          const candidate = candidates[candidates.length - 1]
          candidate.evidence.push(`敌棋${enemy.point}与${other.point}沿同侧相隔三格，中间${corridor.join('、')}为空；${other.point}沿该方向再两格有己棋${name(other.x + Math.sign(ddx) * 2, other.y + Math.sign(ddy) * 2)}。`)
          candidate.purposeHypothesis.wording += ` 结合${other.point}及其外侧己棋配置，对方沿边展开空间可能受限；未指定应手，不判断其只能如何拆边。`
        }
      }
    }
    const sides = nearbySides(enemy, input.boardSize)
    if (sides.length !== 1) continue
    const frame = sides[0]
    const inward = dx * frame.nx + dy * frame.ny
    const tangent = dx * frame.ny - dy * frame.nx
    const supports = observed.map((g) => g.anchor)
    if (contact && tangent === 0 && inward === -1 && supports.length) add('attachment-under', enemy, supports, [],
      `${move.point}从${frame.side === 'right' ? '右' : frame.side === 'left' ? '左' : frame.side === 'top' ? '上' : '下'}边线一侧接触敌棋${enemy.point}，可作为托的关系候选。`,
      `可能通过托${enemy.point}争取角边空间、限制对方进入；不能据此断定已经防住进角。`, ['敌棋有唯一邻近边线；落点沿同一边线法向低一路接触。'], frame.side)
    const closeSupports = observed.filter((g) => ['connected', 'one-space-jump'].includes(g.kind) &&
      g.offset.dx * frame.nx + g.offset.dy * frame.ny === 0)
    if (contact && tangent === 0 && inward === 1 && closeSupports.length) add('contact-press', enemy, closeSupports.map((g) => g.anchor), closeSupports.flatMap((g) => g.interveningPoints),
      `${move.point}在敌棋${enemy.point}朝中腹的一侧直接接触，与己棋${closeSupports.map((g) => g.anchor).join('、')}有沿边近距离关系，可检查是否应称靠压。`,
      `可能压低${enemy.point}、限制其向中腹发展；实际效果需验证应对。`, ['落点沿敌棋邻近边线的法向高一路，形成正交接触。', '己方支持沿同一深度相邻或空一间；中间走廊没有棋子阻挡。'], frame.side)
    if (inward === 1 && Math.abs(tangent) === 1) {
      const shoulderSupports = observed.filter((g) => ['one-space-jump', 'two-space-jump'].includes(g.kind) &&
        g.offset.dx * frame.nx + g.offset.dy * frame.ny === 0 &&
        (g.offset.dx * frame.ny - g.offset.dy * frame.nx) * tangent > 0)
      if (shoulderSupports.length) {
        const partners = [...board].filter(([, color]) => color === input.playerColor).map(([p]) => parsePoint(p, input.boardSize)!).filter((p) =>
          distance(p, move) <= 5 && Math.abs((p.x - move.x) * frame.nx + (p.y - move.y) * frame.ny) <= 1 &&
          ((p.x - move.x) * frame.ny - (p.y - move.y) * frame.nx) * tangent > 0)
        add('shoulder-probe', enemy, shoulderSupports.map((g) => g.anchor), shoulderSupports.flatMap((g) => g.interveningPoints),
          `${move.point}斜邻敌棋${enemy.point}，沿其邻近边线高一路并向另一侧展开，与己棋${shoulderSupports.map((g) => g.anchor).join('、')}有开放沿边关系，可检查是否应称尖冲。`,
          `可能借此向另一侧扩张空间${partners.length ? `，与该侧己棋${partners.map((p) => p.point).join('、')}配合` : ''}；扩张或配合是否有效仍需验证后续。`,
          ['落点对敌斜邻，沿同一边线法向高一路；己方沿边支持位于展开的来向，走廊为空。', ...(partners.length ? [`展开侧五格内、相近深度有己棋${partners.map((p) => p.point).join('、')}；这只是配置事实。`] : [])], frame.side)
      }
    }
    if (tangent === 0 && inward === 2 && supports.length) {
      const middle = name(enemy.x + frame.nx, enemy.y + frame.ny)
      if (!board.has(middle)) add('cap', enemy, supports, [middle],
        `${move.point}在敌棋${enemy.point}朝中腹的正前方空一格，形成镇的关系候选。`,
        `可能限制${enemy.point}向中腹跳起，并为己棋争取出头空间；不能断言对方无法跳出。`, [`${enemy.point}到${move.point}沿同一边线法向，中间${middle}为空。`], frame.side)
    }
    // Enemy and friendly endpoints straddle the knight's tangential level.
    if (inward === 2 && Math.abs(tangent) === 1) {
      const supports = observed.filter((g) => g.kind === 'small-knight').filter((g) => {
        const anchor = parsePoint(g.anchor, input.boardSize)!
        return (anchor.x - enemy.x) * frame.nx + (anchor.y - enemy.y) * frame.ny === 0 &&
          anchor.x === enemy.x + 2 * (dx - 2 * frame.nx) && anchor.y === enemy.y + 2 * (dy - 2 * frame.ny)
      })
      const middle = name(enemy.x + dx - 2 * frame.nx, enemy.y + dy - 2 * frame.ny)
      const front = name(move.x - frame.nx, move.y - frame.ny)
      if (supports.length && !board.has(middle) && !board.has(front)) add('knight-pressure', enemy, supports.map((g) => g.anchor), [middle, front],
        `${move.point}与己棋${supports.map((g) => g.anchor).join('、')}成小飞，位于敌棋${enemy.point}朝中腹的一侧，可作为小飞限制的候选。`,
      `可能限制敌棋${enemy.point}向外发展；封锁能否成立仍需验证后续应对。`, ['敌棋与己方小飞锚点沿边错开两格；落点处于两者之间的切向高度并向中腹展开。', `${middle}、${front}为空，是局部空间证据，并非已验证的逃出走廊。`], frame.side)
    }
  }
  // Small-knight enclosure of a friendly 3-4 corner, with no enemy in the local corner box.
  if (input.boardSize === 19) for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const cx = sx === 1 ? 0 : 18; const cy = sy === 1 ? 0 : 18
    for (const [ax, ay, mx, my] of [[3, 2, 2, 4], [2, 3, 4, 2]]) {
      if (move.x !== cx + mx * sx || move.y !== cy + my * sy) continue
      const anchor = parsePoint(name(cx + ax * sx, cy + ay * sy), 19)!
      if (board.get(anchor.point) !== input.playerColor || enemies.some((p) => (p.x - cx) * sx <= 5 && (p.y - cy) * sy <= 5)) continue
      const emptyPoints: string[] = []
      for (let x = Math.min(anchor.x, move.x); x <= Math.max(anchor.x, move.x); x++) for (let y = Math.min(anchor.y, move.y); y <= Math.max(anchor.y, move.y); y++) {
        const point = name(x, y)
        if (point !== move.point && !board.has(point)) emptyPoints.push(point)
      }
      add('corner-enclosure', anchor, [anchor.point], emptyPoints,
        `${move.point}与同角己方小目${anchor.point}成小飞，构成小飞守角的配置候选。`,
        '可能加固己方角部、争取角地；不证明角地已确定，也不判断本手是否比其他大场更急。',
        [`己方${anchor.point}位于同角第三、第四路；落点为第三、第五路的小飞配置。`, '同角六路范围内没有敌棋；这是局部配置事实，不是守角成功的验证。'], undefined, true)
    }
  }
  // Exact three-three below an enemy star. Smaller boards need separate corner rules.
  if (input.boardSize === 19) for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const cx = sx === 1 ? 0 : 18; const cy = sy === 1 ? 0 : 18
    if (move.x !== cx + 2 * sx || move.y !== cy + 2 * sy) continue
    const star = enemies.find((p) => p.x === cx + 3 * sx && p.y === cy + 3 * sy)
    if (!star) continue
    const history = input.moveHistory ?? []
    const [approach, pincer] = history.slice(-2)
    const a = approach && parsePoint(approach.point, 19); const p = pincer && parsePoint(pincer.point, 19)
    const approachShape = a && [[5, 2], [2, 5]].some(([x, y]) => a.x === cx + x * sx && a.y === cy + y * sy)
    const pincerShape = a && p && ((a.x === cx + 5 * sx && p.x === cx + 7 * sx && a.y === cy + 2 * sy && p.y === a.y) ||
      (a.y === cy + 5 * sy && p.y === cy + 7 * sy && a.x === cx + 2 * sx && p.x === a.x))
    const afterPincer = approachShape && pincerShape && approach.color === input.playerColor && pincer.color !== input.playerColor && board.get(a!.point) === approach.color && board.get(p!.point) === pincer.color
    add('corner-entry', star, afterPincer ? [a!.point] : [], [],
      `${move.point}是敌方星位${star.point}下的三三点，${afterPincer ? '最近两手为己方挂角、敌方夹击，可按被夹后点三三理解' : '可按点三三进入角部理解'}。`,
      '可能在角部争取根据地或转换；是否活棋及转换是否有利需验证后续。', [`落点在该角两条边各第三路；同角第四路星位${star.point}属于敌方。`, ...(afterPincer ? [`历史对应己方${a!.point}挂角、敌方${p!.point}夹击。`] : ['缺少匹配的最近挂角、夹击历史，不断言被夹后点角。'])])
  }
  const priority: MoveRelationCandidate['kind'][] = ['corner-entry', 'diagonal-contact', 'attachment-under', 'contact-press', 'cap', 'knight-pressure', 'shoulder-probe', 'corner-enclosure']
  return candidates.sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind) || (a.enemyAnchor ?? a.friendlyAnchor ?? '').localeCompare(b.enemyAnchor ?? b.friendlyAnchor ?? ''))
}

export function recognizeMoveConcepts(input: MoveConceptInput): MoveConceptResult {
  if (!Number.isInteger(input.boardSize) || input.boardSize < 2 || input.boardSize > COLUMNS.length) return fail('棋盘尺寸无效。')
  const move = parsePoint(input.playedMove, input.boardSize)
  if (!move) return fail('落点无效或为停着。')
  if (!input.boardSnapshot) return fail('缺少完整落子前棋盘。')
  const board = new Map<string, ConceptColor>()
  for (const stone of input.boardSnapshot) {
    const point = parsePoint(stone.point, input.boardSize)
    if (!point || (stone.color !== 'B' && stone.color !== 'W')) return fail('棋盘包含无效棋子。')
    if (board.has(point.point)) return fail('棋盘包含重复落点，无法确定局面。')
    board.set(point.point, stone.color)
  }
  if (input.playerColor !== 'B' && input.playerColor !== 'W') return fail('落子颜色无效。')
  if (board.has(move.point)) return fail('落点已被占用；必须提供落子前棋盘。')
  const friends: Point[] = []; const enemies: Point[] = []
  for (const [point, color] of board) (color === input.playerColor ? friends : enemies).push(parsePoint(point, input.boardSize)!)
  const geometry: MoveGeometryEvidence[] = []
  for (const anchor of friends) {
    const dx = move.x - anchor.x; const dy = move.y - anchor.y
    const axes = [Math.abs(dx), Math.abs(dy)].sort((a, b) => a - b)
    const shape = SHAPES[axes.join(',')]
    if (!shape) continue
    const interveningPoints: string[] = []
    // Only straight jumps have a unique intervening corridor. Knight paths are not invented.
    if (axes[0] === 0) {
      for (let i = 1; i < axes[1]; i++) interveningPoints.push(name(anchor.x + Math.sign(dx) * i, anchor.y + Math.sign(dy) * i))
    }
    const blockers = interveningPoints.filter((point) => board.has(point))
    const status = blockers.length ? 'blocked' : 'observed'
    geometry.push({ kind: shape[0], label: shape[1], anchor: anchor.point, move: move.point, offset: { dx, dy }, status,
      interveningPoints, blockers,
      wording: status === 'blocked' ? `${move.point}与己棋${anchor.point}的坐标间隔对应${shape[1]}，但中间已有${blockers.join('、')}，不能按完整${shape[1]}讲解。` : `相对己棋${anchor.point}，${move.point}具有${shape[1]}的几何关系。` })
  }
  geometry.sort((a, b) => a.anchor.localeCompare(b.anchor))
  const ownDevelopment = buildOwnDevelopment(input)
  const developed = ownDevelopment.find(d => d.kind === 'own-development')
  // Prefer a clear frontier jump only when all competing anchors belong to one real string.
  const sameString = developed && geometry.filter(g => g.status === 'observed').every(g => developed.groupStones.includes(g.anchor))
  const primaryFriendlyGeometry = sameString ? geometry.find(g => g.anchor === developed.anchor && g.status === 'observed') : undefined
  const relationCandidates = recognizeRelations(input, move, enemies, board, geometry)
  if (developed) for (const candidate of relationCandidates) {
    candidate.counterEvidence.push(`自身发展竞争解释：${developed.wording}；对敌形状不能单独确定整手主要目的。`)
    candidate.purposeHypothesis.wording += ' 同时须比较附近己串的发展需求，不能仅凭该形状优先认定攻击或封锁对方。'
  }
  const relations: MoveConceptResult['relations'] = []
  const contacts = enemies.filter((p) => Math.abs(p.x - move.x) + Math.abs(p.y - move.y) === 1)
  if (contacts.length) relations.push({ kind: 'enemy-contact', points: contacts.map((p) => p.point), evidence: `落点与敌棋${contacts.map((p) => p.point).join('、')}直接相邻；相邻本身不证明攻击或压迫。` })
  for (const enemy of enemies.filter((p) => distance(p, move) <= 2).sort((a, b) => a.point.localeCompare(b.point))) {
    const offset = { dx: move.x - enemy.x, dy: move.y - enemy.y }
    relations.push({ kind: 'enemy-position', points: [enemy.point], offset,
      evidence: `${move.point}相对敌棋${enemy.point}的坐标差为dx=${offset.dx}、dy=${offset.dy}；这是一项位置事实，不能单凭间隔确定战术效果。` })
  }
  const oppositeEnemies = enemies.filter((p) => distance(p, move) <= 2).filter((p) => enemies.some((other) => other.x === 2 * move.x - p.x && other.y === 2 * move.y - p.y))
  if (oppositeEnemies.length) relations.push({ kind: 'between-enemies', points: oppositeEnemies.map((p) => p.point), evidence: '落点位于对称的两侧敌棋之间；这不足以证明分断、夹击或可逃出。' })
  const limitations = ['几何关系不等于战术目的；气数和ownership均不能单独证明棋块死活。', '未验证本手合法性、自杀、劫争或后续变化。']
  const ownership = input.engineFeatures?.ownership
  if (ownership) {
    if (ownership.length === input.boardSize * input.boardSize && ownership.every((value) => Number.isFinite(value) && value >= -1 && value <= 1) && ['black', 'white'].includes(input.engineFeatures?.ownershipPerspective ?? '')) {
      const value = ownership[(input.boardSize - 1 - move.y) * input.boardSize + move.x]
      relations.push({ kind: 'ownership-at-move', points: [move.point], value, evidence: `${input.engineFeatures?.source || '外部引擎'}预测落点ownership=${value}（正值视角=${input.engineFeatures?.ownershipPerspective}）；只表示区域归属预测，不作为死活或意图判据。` })
    } else limitations.push('ownership尺寸、取值或视角不完整，已忽略。')
  }
  const observed = geometry.filter((g) => g.status === 'observed')
  const intents: MoveIntentHypothesis[] = []
  // A side extension needs an open straight relation parallel to a nearby edge.
  if (observed.length === 1 && observed[0].interveningPoints.length > 0) {
    const anchor = parsePoint(observed[0].anchor, input.boardSize)!
    const sideDepth = Math.min(3, Math.floor(input.boardSize / 4))
    const horizontalDepth = Math.min(move.y, input.boardSize - 1 - move.y)
    const verticalDepth = Math.min(move.x, input.boardSize - 1 - move.x)
    const parallelSide = (anchor.y === move.y && horizontalDepth <= sideDepth && edge(anchor, input.boardSize) === horizontalDepth && edge(move, input.boardSize) === horizontalDepth) ||
      (anchor.x === move.x && verticalDepth <= sideDepth && edge(anchor, input.boardSize) === verticalDepth && edge(move, input.boardSize) === verticalDepth)
    const ux = Math.sign(move.x - anchor.x); const uy = Math.sign(move.y - anchor.y)
    const length = distance(anchor, move)
    const projection = (p: Point) => (p.x - anchor.x) * ux + (p.y - anchor.y) * uy
    const inExpansionBand = (p: Point) => projection(p) >= 0 && projection(p) <= length + 1 && Math.abs((p.x - anchor.x) * uy - (p.y - anchor.y) * ux) <= 3
    const endpointContact = (p: Point) => Math.abs(p.x - anchor.x) + Math.abs(p.y - anchor.y) === 1 || Math.abs(p.x - move.x) + Math.abs(p.y - move.y) === 1
    const behind = enemies.filter((p) => projection(p) < 0 && distance(p, anchor) <= 3)
    if (parallelSide && !enemies.some((p) => inExpansionBand(p) || endpointContact(p))) intents.push({ kind: 'side-extension', status: 'hypothesis', evidence: [`与唯一己棋锚点${anchor.point}沿边平行展开，中间${observed[0].interveningPoints.join('、')}未被占用。`, '展开区间及相邻三格带内没有敌棋，两个端点没有敌方直接接触。'], counterEvidence: ['尚未确认该棋块的根据地、势力方向或最佳拆边距离。', ...(behind.length ? [`锚点背侧仍有敌棋${behind.map((p) => p.point).join('、')}；其压力和后续侵消尚未验证。`] : [])], wording: '这手有沿边展开、争取区域的可能，可作为拆边候选理解；不能仅凭间隔确定是拆或已扩张成空。' })
  }
  for (const assessment of input.groupAssessments ?? []) {
    if (assessment.status !== 'unsettled' || !assessment.source.trim() || !assessment.evidence.length || !assessment.stones.length) continue
    const targets = assessment.stones.map((raw) => parsePoint(raw, input.boardSize))
    if (targets.some((p) => !p || board.get(p.point) !== assessment.color)) { limitations.push('外部棋块评估与当前棋盘不一致，已忽略。'); continue }
    const nearby = (targets as Point[]).filter((p) => distance(p, move) <= 2)
    if (!nearby.length) continue
    const provenance = `外部评估${assessment.source}标记${assessment.stones.join('、')}尚未安定：${assessment.evidence.join('；')}`
    if (assessment.color === input.playerColor && nearby.some((p) => edge(move, input.boardSize) > edge(p, input.boardSize))) {
      intents.push({ kind: 'escape', status: 'hypothesis', evidence: [provenance, '落点朝更远离边线的方向发展。'], counterEvidence: ['尚未验证逃出路线、连通性和敌方封锁。'], wording: '结合外部棋块评估，这手可能有向中腹出头的意图；是否属于有效逃出还需读后续。' })
    } else if (assessment.color !== input.playerColor) {
      intents.push({ kind: 'attack', status: 'hypothesis', evidence: [provenance, '落点位于该敌棋附近。'], counterEvidence: ['靠近敌棋也可能是防守、连接或官子；尚未验证威胁。'], wording: '这手靠近外部评估尚未安定的敌棋，可能形成压力；攻击目的仍待后续验证。' })
      if (contacts.some((p) => assessment.stones.map((s) => s.trim().toUpperCase()).includes(p.point) && edge(move, input.boardSize) > edge(p, input.boardSize))) {
        intents.push({ kind: 'press', status: 'hypothesis', evidence: [provenance, '与敌棋直接相邻，落点比敌棋更靠近中腹。'], counterEvidence: ['尚未验证能否限制敌棋向中腹发展，不能仅凭接触命名为压。'], wording: '这手在敌棋朝中腹的一侧接触，可能限制其出头；是否称为压仍需验证后续。' })
      }
    }
  }
  const status = observed.length > 1 ? 'ambiguous' : geometry.length || relationCandidates.length || relations.length || intents.length ? 'observed' : 'abstained'
  if (observed.length > 1) limitations.push('存在多个己棋锚点，保留全部相对几何关系，不按最近锚点给整手命名。')
  const enemyFacts = relations.filter((r) => r.kind === 'enemy-contact' || r.kind === 'enemy-position')
  const wording = developed ? `${primaryFriendlyGeometry?.wording ?? ''} ${developed.wording} ${relationCandidates.map(r => r.wording).join(' ')}`.trim() : relationCandidates.length ? relationCandidates.map((r) => r.wording).join(' ') : enemyFacts.length ? enemyFacts.map((r) => r.evidence).join(' ') : observed.length > 1 ? `这手与多个己棋存在不同或重复的几何关系（${observed.map((g) => `${g.anchor}：${g.label}`).join('；')}）；尚不能据此给整手确定术语。` : observed[0]?.wording || geometry[0]?.wording || relations[0]?.evidence || '现有证据不足以命名这手棋的棋形或意图。'
  return { status, ownDevelopment, primaryFriendlyGeometry, geometry, relationCandidates, relations, intents, wording, limitations }
}

/** Preserve competing anchors and counter-evidence when supplying this experiment to an LLM. */
export function formatMoveConceptsForPrompt(result: MoveConceptResult): string {
  return [
    '保守落子概念证据：几何只是相对关系；hypothesis不是确定术语，不可升级为定论。',
    '先核对本手发展的己方真实棋串，再比较自身发展与对敌关系；形状事实不能独自确定主体目的。多锚点事实全部保留，独立棋串不能混为同串。candidate是术语候选，形状事实不证明目的或效果已经实现。',
    `识别状态：${result.status}。${result.wording}`,
    ...result.ownDevelopment.map(i => `自身发展[${i.kind}/${i.status}] 锚点=${i.anchor}，己串={${i.groupStones.join('、')}}：${i.wording}\n支持：${i.evidence.join('；')}\n反证/未验证：${i.counterEvidence.join('；')}`),
    ...result.relationCandidates.map((r) => `术语[${r.kind}/${r.status}] ${r.enemyAnchor ? `敌棋=${r.enemyAnchor}` : `己方角部锚点=${r.friendlyAnchor}`}，己方支持=${r.supportingFriendPoints.join('、') || '无'}：${r.wording}\n形状[${r.geometryStatus}]：${r.evidence.join('；')}\n目的[${r.purposeHypothesis.status}]：${r.purposeHypothesis.wording}\n反证/未验证：${r.counterEvidence.join('；')}`),
    ...result.geometry.map((g) => `几何[${g.status}] 锚点=${g.anchor}，落点=${g.move}，dx=${g.offset.dx}，dy=${g.offset.dy}：${g.wording}${g.blockers.length ? ` 阻挡=${g.blockers.join('、')}` : ''}`),
    ...result.relations.map((r) => `关系[${r.kind}] ${r.evidence}`),
    ...result.intents.map((i) => `意图[${i.kind}/${i.status}] ${i.wording}\n支持：${i.evidence.join('；')}\n反证/未验证：${i.counterEvidence.join('；')}`),
    `限制：${result.limitations.join('；')}`
  ].join('\n')
}
