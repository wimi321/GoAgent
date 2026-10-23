import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash, randomInt } from 'node:crypto'
import { resolve } from 'node:path'

export function readRecords(path) {
  const text = readFileSync(path, 'utf8').trim()
  if (!text) return []
  if (path.endsWith('.jsonl')) return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
  const value = JSON.parse(text)
  return Array.isArray(value) ? value : value.cases ?? value.positions ?? value.evidence ?? value.records ?? []
}

export function gtpToSgf(point, size) {
  if (/^pass$/i.test(String(point)) || point === '') return ''
  const match = /^([A-HJ-Z])(\d+)$/i.exec(String(point))
  assert.ok(match, `Invalid GTP point: ${point}`)
  const col = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'.indexOf(match[1].toUpperCase())
  const row = size - Number(match[2])
  assert.ok(col >= 0 && col < size && row >= 0 && row < size, 'Point outside board')
  return String.fromCharCode(97 + col, 97 + row)
}

export function anonymousSgf(record, engine = {}) {
  const size = Number(record.board_size)
  assert.ok(Number.isInteger(size) && size >= 2 && size <= 25, 'Invalid board size')
  const komi = Number(engine.komi_used ?? record.komi ?? 7.5)
  assert.ok(Number.isFinite(komi) && Math.abs(komi) <= 100, 'Invalid komi')
  const rawRules = engine.rules_used ?? record.rules
  const rules = rawRules == null ? null : String(rawRules).trim()
  assert.ok(!rules || /^[a-zA-Z0-9 _-]{1,60}$/.test(rules), 'Unsupported rules string')
  const moves = [...record.moves_before, record.played_move]
  const render = ([color, point]) => {
    assert.ok(color === 'B' || color === 'W', 'Invalid stone color')
    return `${color}[${gtpToSgf(point, size)}]`
  }
  const setups = ['B', 'W'].map(color => {
    const points = (record.initial_stones ?? []).filter(stone => stone[0] === color).map(stone => gtpToSgf(stone[1], size))
    assert.ok(points.every(Boolean), 'Initial stones cannot pass')
    return points.length ? `A${color}${points.map(point => `[${point}]`).join('')}` : ''
  }).join('')
  const sgf = `(;SZ[${size}]KM[${komi}]${rules ? `RU[${rules}]` : ''}${setups}${moves.map(move => `;${render(move)}`).join('')})`
  assertAnonymousSgf(sgf)
  return { sgf, moveNumber: moves.length, boardSize: size, komi, rules, rulesOrigin: engine.rules_used != null ? 'engine' : record.rules != null ? 'record' : 'absent' }
}

export function assertAnonymousSgf(sgf) {
  const properties = [...sgf.matchAll(/([A-Z]+)\[/g)].map(match => match[1])
  assert.ok(properties.every(key => ['SZ', 'KM', 'RU', 'AB', 'AW', 'B', 'W'].includes(key)), 'SGF contains prohibited metadata')
  assert.ok(!/\b(?:GTL|feedback|weak.?labels?|source|comment)\b/i.test(sgf), 'SGF contains prohibited text')
}

export function prepareCases(cases, records, engines, directory) {
  const dataById = new Map(records.map(item => [item.sample_id ?? item.id, item]))
  const engineById = new Map(engines.map(item => [item.sample_id ?? item.local_case_id ?? item.localCaseId ?? item.id, item]))
  const shuffled = [...cases]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = randomInt(index + 1)
    ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
  }
  return shuffled.map((item, index) => {
    const localCaseId = item.id ?? item.sample_id
    const record = dataById.get(localCaseId)
    assert.ok(record, `Missing local record: ${localCaseId}`)
    // Anonymous engine evidence has an independent shuffled ID namespace. Match full history, never array order or position-N.
    const matchingEngine = engineById.get(localCaseId) ?? engines.find(engine => {
      const pre = engine.positions?.pre
      return pre && pre.boardXSize === record.board_size && JSON.stringify(pre.moves) === JSON.stringify(record.moves_before) && JSON.stringify(pre.initialStones ?? []) === JSON.stringify(record.initial_stones ?? [])
    })
    assert.ok(!engines.length || matchingEngine, 'No engine evidence matches this complete source history')
    const pre = matchingEngine?.positions?.pre ?? matchingEngine?.requests?.pre
    if (pre) {
      assert.equal(pre.boardXSize, record.board_size, 'Engine evidence board size mismatch')
      assert.deepEqual(pre.moves, record.moves_before, 'Engine evidence before history mismatch')
      assert.deepEqual(pre.initialStones ?? [], record.initial_stones ?? [], 'Engine evidence setup mismatch')
      const post = matchingEngine?.positions?.post ?? matchingEngine?.requests?.post
      if (post) assert.deepEqual(post.moves, [...record.moves_before, record.played_move], 'Engine evidence played move mismatch')
    }
    const fixture = anonymousSgf(record, pre ? { rules_used: pre.rules, komi_used: pre.komi } : matchingEngine)
    assert.equal(fixture.moveNumber, item.moveNumber ?? fixture.moveNumber, 'Case/history move number mismatch')
    const id = `position-${index + 1}`
    return { id, localCaseId, filePath: resolve(directory, `${id}.sgf`), ...fixture, sha256: createHash('sha256').update(fixture.sgf).digest('hex') }
  })
}

export const teacherPrompt = '请讲解当前这一手：先说明落点和局部棋形事实，再解释它与周围棋子的关系、目的、风险和可验证的后续。结合实际棋盘截图和 KataGo 数据；证据不足时明确保留判断。用自然中文讲给中级成年棋友，避免堆术语。本轮只分析当前手，请不要更新学生档案或训练配置。'

export function teacherRequest(fixture, gameId, variant, promptOverride = teacherPrompt) {
  return { runId: `commentary-eval-${variant}-${fixture.id}`, mode: 'current-move', toolPolicy: 'auto', prompt: promptOverride, gameId, moveNumber: fixture.moveNumber, coachLevel: 'intermediate', studentAgeRange: 'adult', teacherStyle: 'rigorous' }
}

export function assertSafeBoundary(value, localCases, records) {
  const strings = []
  function visit(item, depth = 0) {
    assert.ok(depth < 40, 'Boundary nesting is too deep')
    if (typeof item === 'string') {
      strings.push(item)
      try { const parsed = JSON.parse(item); if (typeof parsed === 'object' && parsed !== null) visit(parsed, depth + 1) } catch (error) { if (error?.code === 'ERR_ASSERTION') throw error }
    } else if (Array.isArray(item)) item.forEach(child => visit(child, depth + 1))
    else if (item && typeof item === 'object') for (const [key, child] of Object.entries(item)) {
      if (['localCaseId', 'sample_id', 'comment', 'labels', 'feedback', 'source_game_key', 'weakLabels'].includes(key)) assert.ok(child == null || child === '' || (Array.isArray(child) && !child.length), 'Prohibited populated field at external boundary')
      visit(child, depth + 1)
    }
  }
  visit(value)
  for (const item of localCases) assert.ok(!strings.some(text => text.includes(item.localCaseId)), 'Original case ID leaked')
  for (const record of records) {
    if (typeof record.comment === 'string' && record.comment.trim()) {
      const comment = record.comment.trim()
      const escaped = JSON.stringify(comment).slice(1, -1)
      assert.ok(!strings.some(text => text === comment || (comment.length > 12 && (text.includes(comment) || text.includes(escaped)))), 'Original commentary leaked')
    }
    for (const key of ['source_game_key', 'game_sha256', 'file_sha256']) {
      if (typeof record[key] === 'string' && record[key].length > 6) assert.ok(!strings.some(text => text.includes(record[key])), 'Source identifier leaked')
    }
  }
}

export function validateFreshPrefetch(analysis) {
  assert.equal(analysis?.runtimeEvidence?.cacheStatus, 'written', 'Prefetched analysis must be freshly computed')
  assert.match(analysis.runtimeEvidence.cacheReason ?? '', /cache lookup bypassed/, 'Prefetched analysis must explicitly bypass derived-analysis cache lookup')
}

export function validatePipelineEvidence(payload, fixture) {
  const analysis = payload.analysis
  assert.equal(analysis?.moveNumber, fixture.moveNumber, 'Analysis move number mismatch')
  assert.equal(analysis?.boardSize, fixture.boardSize, 'Analysis board size mismatch')
  assert.ok(Number.isFinite(analysis?.before?.winrate) && Number.isFinite(analysis?.before?.scoreLead), 'Invalid KataGo root evidence')
  assert.ok(analysis.before.topMoves?.length > 0, 'Missing KataGo candidates')
  assert.ok(payload.result?.markdown?.trim(), 'Teacher returned no markdown')
  const vision = payload.result.visionEvidence
  assert.ok(vision?.attached && vision.imageCount > 0 && vision.images?.some(image => image.valid), 'Missing valid teacher image evidence')
  assert.ok(vision.images.some(image => image.valid && image.moveNumber === fixture.moveNumber && image.role === 'current-board'), 'Teacher image does not represent the requested move')
  const logs = payload.result.toolLogs ?? []
  assert.ok(!logs.some(log => log.status === 'done' && ['studentProfile.write', 'settings.update', 'settings.write', 'configuration.write'].includes(log.name)), 'Training/profile configuration write invalidates paired evaluation')
  for (const name of ['katago.analyzePosition', 'board.captureTeachingImage']) assert.ok(logs.some(log => log.name === name && log.status === 'done'), `Missing successful ${name}`)
  assert.ok(logs.some(log => ['knowledge.matchPosition', 'knowledge.searchLocal'].includes(log.name) && log.status === 'done'), 'Missing successful knowledge evidence')
}

export function validateMockCapture(requests, expected) {
  const messages = requests.flatMap(item => item.body.messages ?? [])
  for (const name of ['sgf_readGameRecord', 'knowledge_matchPosition', 'katago_analyzePosition', 'board_captureTeachingImage']) {
    const matching = messages.filter(message => message.role === 'tool' && message.tool_call_id === `eval_${name}`)
    assert.ok(matching.some(message => {
      try { return JSON.parse(message.content).ok === true } catch {
        // Production compactToolResult retains the envelope prefix and truncates large payload tails.
        return /^\s*\{\s*"ok"\s*:\s*true\s*[,}]/.test(message.content) && /\[tool result truncated: \d+ chars omitted\]$/.test(message.content.trim())
      }
    }), `No successful production ${name} result captured`)
  }
  if (expected) {
    const board = messages.find(message => message.role === 'tool' && message.tool_call_id === 'eval_board_captureTeachingImage')
    const images = JSON.parse(board.content).result.images
    assert.ok(images.some(image => image.gameId === expected.gameId && image.moveNumber === expected.moveNumber), 'Captured board tool image does not match the requested game and move')
    if (expected.requireConceptEvidence) {
      const contents = messages.filter(message => message.role === 'tool' && message.tool_call_id === 'eval_knowledge_matchPosition').map(message => message.content)
      const evidence = contents.map(content => extractCompactJsonField(content, 'moveConceptEvidence')).find(Boolean)
      assert.equal(evidence?.moveNumber, expected.moveNumber, 'Complete concept evidence did not enter the provider for the requested move')
      assert.equal(evidence.boardTiming, 'before-move')
      assert.ok(evidence.prompt?.trim() && evidence.entries?.some(entry => entry.role === 'played'), 'Missing complete played-move concept evidence')
    }
  }
  assert.ok(messages.some(message => Array.isArray(message.content) && message.content.some(part => part.type === 'image_url' && /^data:image\//.test(part.image_url?.url ?? ''))), 'No actual image_url entered the provider messages')
}

export function extractCompactJsonField(content, name) {
  const match = new RegExp(`"${name}"\\s*:\\s*\\{`).exec(content)
  if (!match) return null
  const start = content.indexOf('{', match.index)
  let depth = 0, quoted = false, escaped = false
  for (let index = start; index < content.length; index++) {
    const char = content[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) {
      try { return JSON.parse(content.slice(start, index + 1)) } catch { return null }
    }
  }
  return null
}

export function parseStoredResult(text) {
  try { return JSON.parse(text) } catch { return { success: false, invalidArtifact: true } }
}

export function semanticProfile(profile) {
  if (!profile) return null
  const { createdAt, updatedAt, ...stable } = profile
  return stable
}

export function canResume(previous, identity) {
  return previous?.success === true && JSON.stringify(previous.identity) === JSON.stringify(identity)
}

export function replayResearchBoard(size, initialStones, moves) {
  // Research snapshots are flattened bottom row first. GTP row 1 maps to offset 0.
  const board = Array(size * size).fill(0)
  function indexFor(point) {
    if (point === '' || /^pass$/i.test(point)) return null
    gtpToSgf(point, size)
    return (Number(point.slice(1)) - 1) * size + 'ABCDEFGHJKLMNOPQRSTUVWXYZ'.indexOf(point[0].toUpperCase())
  }
  const adjacent = index => {
    const x = index % size, y = Math.floor(index / size)
    return [x > 0 ? index - 1 : -1, x + 1 < size ? index + 1 : -1, y > 0 ? index - size : -1, y + 1 < size ? index + size : -1].filter(index => index >= 0)
  }
  function group(start) {
    const stones = new Set([start]), liberties = new Set(), todo = [start]
    while (todo.length) for (const next of adjacent(todo.pop())) {
      if (board[next] === 0) liberties.add(next)
      else if (board[next] === board[start] && !stones.has(next)) { stones.add(next); todo.push(next) }
    }
    return { stones, liberties }
  }
  for (const [color, point] of initialStones) {
    const index = indexFor(point)
    assert.notEqual(index, null, 'Setup stone cannot pass')
    assert.equal(board[index], 0, 'Duplicate setup point')
    board[index] = color === 'B' ? 1 : -1
  }
  for (const [color, point] of moves) {
    const index = indexFor(point)
    if (index === null) continue
    const stone = color === 'B' ? 1 : -1
    assert.equal(board[index], 0, 'History plays on an occupied point')
    board[index] = stone
    for (const next of adjacent(index)) if (board[next] === -stone) {
      const opponent = group(next)
      if (!opponent.liberties.size) for (const captured of opponent.stones) board[captured] = 0
    }
    assert.ok(group(index).liberties.size > 0, 'Suicide history is outside this Japanese-rule evaluation')
  }
  return board
}

export function validateImportedRecord(imported, source) {
  assert.equal(imported.boardSize, source.board_size)
  const expected = [...source.moves_before, source.played_move]
  assert.deepEqual(imported.moves.map(move => [move.color, move.gtp]), expected, 'Imported full move history differs from source')
  for (const move of imported.moves) {
    const coordinate = gtpToSgf(move.gtp, imported.boardSize)
    assert.equal(move.row, coordinate ? coordinate.charCodeAt(1) - 97 : null, 'Imported move row mismatch')
    assert.equal(move.col, coordinate ? coordinate.charCodeAt(0) - 97 : null, 'Imported move column mismatch')
  }
  const setup = (imported.initialStones ?? []).map(stone => [stone.color, stone.point])
  assert.deepEqual([...setup].sort(), [...source.initial_stones].sort(), 'Imported AB/AW differ from source')
  for (const stone of imported.initialStones ?? []) {
    const coordinate = gtpToSgf(stone.point, imported.boardSize)
    assert.equal(stone.row, coordinate.charCodeAt(1) - 97)
    assert.equal(stone.col, coordinate.charCodeAt(0) - 97)
  }
  const before = replayResearchBoard(imported.boardSize, setup, expected.slice(0, -1))
  const after = replayResearchBoard(imported.boardSize, setup, expected)
  assert.deepEqual(before, source.board_before, 'Replayed before board differs from research snapshot')
  assert.deepEqual(after, source.board_after, 'Replayed after board differs from research snapshot')
  return { before, after, verified: true }
}

export async function connectCdp(port, timeoutMs = 600_000) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`)
  assert.ok(response.ok, 'Cannot list CDP pages')
  const pages = await response.json()
  const page = pages.find(item => item.type === 'page' && item.webSocketDebuggerUrl && !/devtools/i.test(item.url ?? ''))
  assert.ok(page, 'No application renderer CDP page')
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  const pending = new Map()
  let id = 0
  await new Promise((resolveOpen, reject) => { socket.onopen = resolveOpen; socket.onerror = () => reject(new Error('CDP connection failed')) })
  socket.onmessage = event => {
    const message = JSON.parse(event.data)
    const item = pending.get(message.id)
    if (!item) return
    pending.delete(message.id)
    clearTimeout(item.timer)
    if (message.error) item.reject(new Error(message.error.message))
    else item.resolve(message.result)
  }
  socket.onclose = () => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('CDP closed')) }; pending.clear() }
  return {
    async evaluate(expression) {
      const result = await new Promise((resolveValue, reject) => {
        const requestId = ++id
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('CDP evaluation timed out')) }, timeoutMs)
        pending.set(requestId, { resolve: resolveValue, reject, timer })
        socket.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }))
      })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      return result.result?.value
    },
    close() { socket.close() }
  }
}
