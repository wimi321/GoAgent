#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs'
import { resolve, join, relative, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomInt } from 'node:crypto'

const root = fileURLToPath(new URL('../', import.meta.url))
const hash = value => createHash('sha256').update(value).digest('hex')
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const columns = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
const within = (parent, child) => { const path = relative(parent, child); return path !== '' && !path.startsWith('..') && !isAbsolute(path) }

function secureOutput(output, inputs) {
  const temporary = resolve(root, '.tmp')
  assert.ok(within(temporary, output), 'Output must be a child directory of this repository .tmp, not .tmp itself')
  for (const input of inputs) assert.ok(output !== input && !within(output, input) && !within(input, output), 'Output must be separate from input directories')
  let ancestor = output
  while (!existsSync(ancestor)) ancestor = dirname(ancestor)
  assert.ok(within(realpathSync(temporary), realpathSync(ancestor)) || realpathSync(temporary) === realpathSync(ancestor), 'Output ancestor escapes .tmp through a link')
  if (existsSync(output)) assert.equal(realpathSync(output).toLowerCase(), output.toLowerCase(), 'Linked output directories are unsupported')
}

function point(raw, size) {
  if (/^pass$/i.test(raw)) return null
  const match = /^([A-HJ-Z])([1-9]\d?)$/.exec(raw)
  assert.ok(match, 'Invalid board point')
  const x = columns.indexOf(match[1]); const y = Number(match[2]) - 1
  assert.ok(x < size && y < size, 'Point outside board')
  return [x, y]
}
const key = (x, y) => `${x},${y}`
function neighbors(x, y, size) { return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < size && b < size) }
function group(board, origin, size) {
  const color = board.get(origin); const stones = new Set([origin]); const pending = [origin]; const liberties = new Set()
  while (pending.length) {
    const [x, y] = pending.pop().split(',').map(Number)
    for (const [a, b] of neighbors(x, y, size)) {
      const p = key(a, b)
      if (!board.has(p)) liberties.add(p)
      else if (board.get(p) === color && !stones.has(p)) { stones.add(p); pending.push(p) }
    }
  }
  return { stones, liberties }
}
function play(board, color, coordinate, size) {
  if (!coordinate) return
  const [x, y] = coordinate; const p = key(x, y)
  assert.ok(!board.has(p), 'Replay found occupied move')
  board.set(p, color)
  for (const [a, b] of neighbors(x, y, size)) {
    const q = key(a, b)
    if (board.has(q) && board.get(q) !== color) {
      const enemy = group(board, q, size)
      if (!enemy.liberties.size) for (const stone of enemy.stones) board.delete(stone)
    }
  }
  assert.ok(group(board, p, size).liberties.size, 'Replay found suicide; unsupported fixture rules')
}
function boardList(board) {
  return [...board].map(([p, color]) => { const [x, y] = p.split(',').map(Number); return { point: `${columns[x]}${y + 1}`, color } }).sort((a, b) => a.point.localeCompare(b.point))
}

export function fixtureBoards(fixture, source, sgf) {
  const size = fixture.boardSize
  assert.equal(Number(/SZ\[(\d+)\]/.exec(sgf)?.[1]), size)
  assert.equal(hash(sgf.replace(/\r?\n$/, '')), fixture.sha256, 'Fixture content hash changed')
  assert.ok([...sgf.matchAll(/([A-Z]+)\[/g)].every(match => ['SZ', 'KM', 'RU', 'AB', 'AW', 'B', 'W'].includes(match[1])), 'Nonanonymous SGF metadata')
  const decode = value => value ? [value.charCodeAt(0) - 97, size - 1 - (value.charCodeAt(1) - 97)] : null
  const board = new Map()
  for (const setup of sgf.matchAll(/A([BW])((?:\[[a-y]{2}\])+)/g)) for (const value of setup[2].matchAll(/\[([a-y]{2})\]/g)) {
    const [x, y] = decode(value[1]); assert.ok(x < size && y >= 0, 'Invalid setup stone')
    assert.ok(!board.has(key(x, y)), 'Duplicate setup stone'); board.set(key(x, y), setup[1])
  }
  const moves = [...sgf.matchAll(/;([BW])\[([a-y]{2}|)\]/g)].map(match => [match[1], decode(match[2])])
  assert.equal(moves.length, fixture.moveNumber, 'SGF/history mismatch')
  assert.equal(source.moveNumber, fixture.moveNumber)
  for (const [color, coordinate] of moves.slice(0, -1)) play(board, color, coordinate, size)
  const before = boardList(board)
  assert.ok(Array.isArray(source.boardSnapshot), 'Source has no complete snapshot')
  const snapshot = new Map()
  for (const stone of source.boardSnapshot) {
    assert.ok(['B', 'W'].includes(stone.color)); const [x, y] = point(stone.point, size)
    assert.ok(!snapshot.has(key(x, y)), 'Duplicate snapshot stone'); snapshot.set(key(x, y), stone.color)
  }
  assert.equal(canonical(before), canonical(boardList(snapshot)), 'SGF replay does not equal source before-move snapshot')
  assert.equal(moves.at(-1)?.[0], source.playerColor)
  assert.equal(canonical(moves.at(-1)?.[1]), canonical(point(source.playedMove, size)), 'Played move differs from source')
  play(board, source.playerColor, moves.at(-1)[1], size)
  const recentMoves = moves.slice(0, -1).slice(-8).map(([color, coordinate], index, list) => ({
    moveNumber: moves.length - list.length + index, color,
    point: coordinate ? `${columns[coordinate[0]]}${coordinate[1] + 1}` : 'pass'
  }))
  return { boardSize: size, moveNumber: fixture.moveNumber, playerColor: source.playerColor, playedMove: source.playedMove, before, after: boardList(board), recentMoves }
}

export function validatePair(fixture, candidate, baseline) {
  for (const [name, result] of [['candidate', candidate], ['baseline', baseline]]) {
    assert.equal(result?.success, true, 'Both real results must be successful')
    assert.equal(result.phase, 'formal', 'Only formal evaluations can enter blind review')
    assert.equal(result.variant, name, 'Input result is in the wrong directory')
    assert.equal(result.id, fixture.id)
    assert.equal(result.model, 'gpt-6-luna')
    assert.equal(result.provider, 'codex-app-server', 'Mock and other providers are excluded')
    assert.ok(result.result?.markdown?.trim(), 'Missing complete model commentary')
    assert.equal(result.identity?.fixtureHash, fixture.sha256)
    assert.equal(result.identity?.model, result.model)
    assert.equal(result.identity?.provider, result.provider)
    assert.equal(result.identity?.variant, name)
    assert.equal(result.identity?.phase, 'formal')
    assert.match(result.profileHash ?? '', /^[a-f0-9]{64}$/, 'Missing semantic student profile hash')
    for (const field of ['bundleHash', 'runtimeHash', 'engineConfigHash']) {
      assert.match(result[field] ?? '', /^[a-f0-9]{64}$/, `Missing ${field}`)
      assert.equal(result.identity[field], result[field])
    }
    for (const field of ['promptHash', 'settingsHash']) assert.match(result.identity[field] ?? '', /^[a-f0-9]{64}$/)
    assert.equal(result.request?.moveNumber, fixture.moveNumber)
    assert.equal(result.request?.mode, 'current-move')
    assert.equal(hash(result.request.prompt), result.identity.promptHash)
    assert.equal(hash(JSON.stringify({ app: result.applicationSettings, request: result.requestSettings })), result.identity.settingsHash)
    assert.ok(result.requestSettings && result.applicationSettings && result.inferenceSettings, 'Missing reproducible settings')
    assert.equal(result.analysis?.moveNumber, fixture.moveNumber, 'Analysis move number mismatch')
    assert.equal(result.analysis?.boardSize, fixture.boardSize, 'Analysis board size mismatch')
    assert.equal(result.analysis?.gameId, result.request.gameId, 'Analysis belongs to another game')
    assert.equal(result.boardVerification?.verified, true, 'Missing imported-board verification')
    for (const phase of ['before', 'after']) assert.equal(result.boardVerification[phase]?.length, fixture.boardSize ** 2, 'Incomplete verified board')
  }
  assert.equal(candidate.profileHash, baseline.profileHash, 'Semantic student profile changed between paired runs')
  for (const phase of ['before', 'after']) assert.equal(canonical(candidate.boardVerification[phase]), canonical(baseline.boardVerification[phase]), 'Verified boards differ between paired runs')
  for (const field of ['fixtureHash', 'runtimeHash', 'engineConfigHash', 'promptHash', 'settingsHash']) assert.equal(candidate.identity[field], baseline.identity[field], `Pair ${field} mismatch`)
  for (const field of ['requestSettings', 'applicationSettings', 'inferenceSettings']) assert.equal(canonical(candidate[field]), canonical(baseline[field]), `Pair ${field} mismatch`)
  const cleanRequest = request => Object.fromEntries(Object.entries(request).filter(([name]) => name !== 'runId'))
  assert.equal(canonical(cleanRequest(candidate.request)), canonical(cleanRequest(baseline.request)), 'Pair request mismatch')
}

function verifyReplayEvidence(boards, result) {
  for (const phase of ['before', 'after']) {
    const flat = Array(boards.boardSize ** 2).fill(0)
    for (const stone of boards[phase]) { const [x, y] = point(stone.point, boards.boardSize); flat[y * boards.boardSize + x] = stone.color === 'B' ? 1 : -1 }
    assert.equal(canonical(flat), canonical(result.boardVerification[phase]), 'Verified result board differs from anonymous SGF replay')
  }
}

export function runStatus(result) {
  if (!result || result.phase !== 'formal') return { attempted: false, passed: false, text: '尚无正式运行记录' }
  if (result.model !== 'gpt-6-luna' || result.provider !== 'codex-app-server') return { attempted: false, passed: false, text: '记录不符合本次评测条件' }
  if (result.success === true) return { attempted: true, passed: true, text: '整链验收已通过' }
  if (result.result?.markdown?.trim()) return { attempted: true, passed: false, text: /evaluator interruption|Recovery incomplete|评测中断/i.test(result.error ?? '') ? '讲解已返回，但评测中断、验收证据不完整' : '讲解已返回，但整链验收未通过' }
  return { attempted: true, passed: false, text: '运行或整链验收未通过' }
}

function statusPanel(data) {
  const summary = data.summary ?? { plannedPositions: data.cases.length / 2, completePairs: data.cases.length / 2, unpairedPositions: 0, expectedRuns: data.cases.length, passedRuns: data.cases.length, unpassedRuns: 0, pendingRuns: 0 }
  const failures = (data.positions ?? []).filter(item => item.state !== 'complete').map(item => `<li>${escape(item.id)}：${item.statuses.map(escape).join('；')}。${escape(item.state === 'incompatible' ? '配对条件或棋盘核对未通过' : '缺少完整合格配对')}。</li>`).join('')
  return `<section aria-label="评测覆盖情况"><h2>本轮覆盖情况</h2><p>预定 ${summary.plannedPositions} 局 · 完整配对 ${summary.completePairs} 局 · 未配对 ${summary.unpairedPositions} 局。</p><p>两组运行合计 ${summary.expectedRuns} 份：整链验收通过 ${summary.passedRuns} 份，未通过或评测中断 ${summary.unpassedRuns} 份，尚无合格正式记录 ${summary.pendingRuns} 份。</p><p>下面只评完整配对的讲解。未配对局不计语义准确率，排除失败也不能说明讲解更准确。${summary.completePairs === 0 ? '目前没有完整配对，流水线尚未完成。' : ''}</p>${failures ? `<details open><summary>未配对局状态（不区分两组）</summary><ul>${failures}</ul></details>` : ''}</section>`
}

function boardSvg(entry, stones, phase) {
  const step = 22; const offset = 32; const end = offset + (entry.boardSize - 1) * step; const extent = end + 32
  let svg = `<svg viewBox="0 0 ${extent} ${extent}" role="img" aria-label="第${entry.moveNumber}手${phase === 'before' ? '落子前' : '落子后'}棋盘"><rect width="100%" height="100%" rx="10" fill="#e7c793"/>`
  for (let i = 0; i < entry.boardSize; i++) {
    const p = offset + i * step
    svg += `<path d="M${offset},${p}H${end} M${p},${offset}V${end}" stroke="#684d2e" stroke-width=".7"/><text x="${p}" y="19" text-anchor="middle" font-size="10">${columns[i]}</text><text x="16" y="${p + 3}" text-anchor="middle" font-size="10">${entry.boardSize - i}</text>`
  }
  const locate = raw => { const [x, y] = point(raw, entry.boardSize); return [offset + x * step, offset + (entry.boardSize - 1 - y) * step] }
  for (const stone of stones) { const [x, y] = locate(stone.point); svg += `<circle cx="${x}" cy="${y}" r="9.8" fill="${stone.color === 'B' ? '#20201f' : '#fffdf8'}" stroke="#39332c"/>` }
  if (point(entry.playedMove, entry.boardSize)) { const [x, y] = locate(entry.playedMove); svg += `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#d82d3e" stroke-width="2.7"/>` }
  return svg + '</svg>'
}

export function reviewHtml(publicData) {
  const options = values => `<option value="">未审</option>${values.map(v => `<option>${v}</option>`).join('')}`
  const entries = new Map(publicData.cases.map(entry => [entry.id, entry]))
  const ids = publicData.cases.filter(entry => entry.id.endsWith(':A')).map(entry => entry.id.slice(0, -2))
  const cards = statusPanel(publicData) + ids.map((id, index) => {
    const entry = entries.get(`${id}:A`)
    const panels = ['A', 'B'].map(letter => { const result = entries.get(`${id}:${letter}`); return `<section class="answer" data-review-id="${result.id}"><h3>讲解 ${letter}</h3><details open><summary>完整讲解原文</summary><pre>${escape(result.markdown)}</pre></details><label>事实正确性<select data-key="geometryCorrect">${options(['正确', '轻微问题', '严重错误', '不确定'])}</select></label><label>信息量与帮助<select data-key="useful">${options(['有帮助', '太空泛', '有误导'])}</select></label><label>我会怎么讲<input data-key="intendedTerm" maxlength="1024"></label><label>纠错或理由<textarea data-key="notes" rows="3" maxlength="8192"></textarea></label></section>` }).join('')
    const recent = (entry.recentMoves ?? []).map(move => `第 ${move.moveNumber} 手 ${move.color === 'B' ? '黑' : '白'} ${move.point === 'pass' ? '停着' : move.point}`).join(' → ')
    return `<article><h2>${index + 1}. ${id} · 第 ${entry.moveNumber} 手 · ${entry.playerColor === 'B' ? '黑' : '白'} ${entry.playedMove}</h2><div class="position"><div><div class="toggle" role="group" aria-label="选择棋盘时点"><button type="button" data-phase="before" aria-pressed="true">落子前</button><button type="button" data-phase="after" aria-pressed="false">落子后</button></div><div data-board="before">${boardSvg(entry, entry.before, 'before')}</div><div data-board="after" hidden>${boardSvg(entry, entry.after, 'after')}</div><p class="muted">红圈标记本手；停着无落点圈。</p></div><div><p>请分别评 A、B 两段完整讲解。可以展开或收起原文，棋盘可切换到落子后查看提子结果。</p><h3>落子前最近手顺</h3><p>${escape(recent || '没有此前着手。')}</p></div></div><div class="answers">${panels}</div></article>`
  }).join('')
  const storageKey = `goagent-commentary-blind-v1-${publicData.reviewSetId}`
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>围棋讲解盲评</title><style>body{margin:0;background:#f5f6f4;color:#25302a;font:16px/1.65 system-ui,sans-serif}main{max-width:1280px;margin:auto;padding:24px}h1{margin:0}article{background:white;border:1px solid #d6ddd4;border-radius:14px;padding:22px;margin:24px 0}.position{display:grid;grid-template-columns:minmax(250px,420px) 1fr;gap:24px}.answers{display:grid;grid-template-columns:1fr 1fr;gap:24px}.answer{min-width:0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:#f8f9f6;padding:16px;border-radius:8px}label{display:block;margin:12px 0}input,select,textarea{display:block;width:100%;box-sizing:border-box;padding:8px;border:1px solid #aab8ae;border-radius:6px;font:inherit}button{background:#245c40;color:white;border:0;padding:10px 16px;border-radius:7px;font:inherit;cursor:pointer;margin:4px}button[aria-pressed=false]{background:#e0e8e1;color:#245c40}button:disabled{opacity:.6}svg{width:100%;height:auto}.muted{font-size:13px;color:#59675e}[hidden]{display:none!important}summary{cursor:pointer}@media(max-width:800px){.position,.answers{grid-template-columns:1fr}main{padding:12px}article{padding:14px}}</style><main><header><h1>围棋讲解盲评</h1><p>模型：${publicData.model} · ${ids.length} 局，两段讲解均来自同一模型。</p><p>建议先看还没审过的局面。先对照棋盘判断事实，再看讲解是否解释清楚关系、目的与风险；不必因为术语多就给高分。不确定时可直接标“不确定”。</p><button id="save-project">保存反馈到项目</button><button id="download">下载 JSON 备份</button><p id="save-status" role="status" aria-live="polite"></p></header>${cards}</main><script>
const key=${JSON.stringify(storageKey)};const reviewIds=${JSON.stringify(publicData.cases.map(entry => entry.id))};const fields=['geometryCorrect','useful','intendedTerm','notes'];let saved={};try{const parsed=JSON.parse(localStorage.getItem(key)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))saved=parsed}catch{}
const status=document.getElementById('save-status');const sections=[...document.querySelectorAll('[data-review-id]')];
function persist(){try{localStorage.setItem(key,JSON.stringify(saved));return true}catch{return false}}
function feedback(){return {schemaVersion:1,cases:sections.map(section=>{const entry={id:section.dataset.reviewId};section.querySelectorAll('[data-key]').forEach(el=>entry[el.dataset.key]=el.value);return entry}).filter(entry=>fields.some(field=>entry[field].trim()))}}
function draftStatus(){const count=feedback().cases.length;status.textContent='已填写 '+count+' 段讲解；'+(persist()?'浏览器已暂存。':'浏览器暂存失败。')+'有修改时请保存到项目。'}
sections.forEach(section=>{const id=section.dataset.reviewId;section.querySelectorAll('[data-key]').forEach(el=>{el.value=typeof saved[id]?.[el.dataset.key]==='string'?saved[id][el.dataset.key]:'';el.addEventListener('input',()=>{saved[id]??={};saved[id][el.dataset.key]=el.value;draftStatus()})})});
document.querySelectorAll('[data-phase]').forEach(button=>button.addEventListener('click',()=>{const article=button.closest('article');article.querySelectorAll('[data-board]').forEach(board=>board.hidden=board.dataset.board!==button.dataset.phase);article.querySelectorAll('[data-phase]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)))}));
document.getElementById('save-project').addEventListener('click',async event=>{const value=feedback();if(!value.cases.length){status.textContent='请先填写至少一段讲解的反馈。';return}event.target.disabled=true;status.textContent='正在保存…';try{const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'保存未完成');persist();status.textContent='已保存 '+result.savedCases+' 段反馈到项目。'}catch(error){status.textContent='尚未保存到项目：'+error.message+'。可下载 JSON 备份。'}finally{event.target.disabled=false}});
document.getElementById('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(feedback(),null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='commentary-blind-feedback.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
fetch('/api/feedback').then(async response=>{if(!response.ok)return;const value=await response.json();if(!Array.isArray(value.cases))return;const byId=new Map(value.cases.filter(entry=>reviewIds.includes(entry.id)).map(entry=>[entry.id,entry]));sections.forEach(section=>{const id=section.dataset.reviewId;if(Object.hasOwn(saved,id)||!byId.has(id))return;const entry=byId.get(id);saved[id]={};section.querySelectorAll('[data-key]').forEach(el=>{el.value=typeof entry[el.dataset.key]==='string'?entry[el.dataset.key]:'';saved[id][el.dataset.key]=el.value})});draftStatus()}).catch(()=>{});draftStatus();
</script></html>`
}

export function main(args = process.argv.slice(2)) {
  const option = (name, fallback) => { const at = args.indexOf(`--${name}`); if (at < 0) return fallback; assert.ok(args[at + 1] && !args[at + 1].startsWith('--'), `Missing --${name} value`); return args[at + 1] }
  if (args.includes('--help')) { console.log('node scripts/build_commentary_blind_review.mjs [--input .tmp/commentary-live-v2] [--cases .tmp/concept-review-round2/cases.json] [--out .tmp/commentary-blind-review-v2] [--onlyids position-1,position-2]'); return }
  const input = resolve(root, option('input', '.tmp/commentary-live-v2'))
  const output = resolve(root, option('out', '.tmp/commentary-blind-review-v2'))
  const sourcePath = resolve(root, option('cases', '.tmp/concept-review-round2/cases.json'))
  const privateDirectory = resolve(root, '.tmp/.commentary-blind-private')
  secureOutput(output, [input, dirname(sourcePath), privateDirectory])
  secureOutput(privateDirectory, [input, output, dirname(sourcePath)])
  const mappingPath = join(privateDirectory, `${hash(output.toLowerCase()).slice(0, 24)}.json`)
  const mapping = existsSync(mappingPath) ? read(mappingPath) : { schemaVersion: 1, reviewSetId: hash(output.toLowerCase()).slice(0, 24), pairs: {} }
  assert.equal(mapping.schemaVersion, 1)
  const manifest = read(join(input, 'fixtures/manifest.json'))
  const source = new Map(read(sourcePath).cases.map(entry => [entry.id, entry]))
  const requested = option('onlyids', '').split(',').filter(Boolean)
  assert.ok(requested.every(id => /^position-[1-9]\d*$/.test(id) && manifest.cases.some(item => item.id === id)), 'Unknown anonymous position ID')
  assert.equal(new Set(requested).size, requested.length, 'Duplicate position IDs')
  const selected = requested.length ? requested.map(id => manifest.cases.find(item => item.id === id)) : manifest.cases
  const cases = []; const rejected = []; const positions = []
  let passedRuns = 0; let attemptedRuns = 0
  const artifact = path => { try { return read(path) } catch { return null } }
  for (const fixture of selected) {
    const candidate = artifact(join(input, 'candidate', `${fixture.id}.json`)); const baseline = artifact(join(input, 'baseline', `${fixture.id}.json`))
    const statuses = [runStatus(candidate), runStatus(baseline)]
    passedRuns += statuses.filter(status => status.passed).length
    attemptedRuns += statuses.filter(status => status.attempted).length
    const positionStatus = { id: fixture.id, state: 'unpaired', statuses: statuses.map(status => status.text).sort() }
    positions.push(positionStatus)
    try {
      assert.match(fixture.id, /^position-[1-9]\d*$/)
      validatePair(fixture, candidate, baseline)
      const original = source.get(fixture.localCaseId); assert.ok(original, 'Missing source snapshot')
      assert.ok(within(join(input, 'fixtures'), resolve(fixture.filePath)), 'Fixture outside input fixture directory')
      const boards = fixtureBoards(fixture, original, readFileSync(fixture.filePath, 'utf8'))
      verifyReplayEvidence(boards, candidate); verifyReplayEvidence(boards, baseline)
      const fingerprint = hash(canonical({ fixtureHash: fixture.sha256, candidate: candidate.identity, baseline: baseline.identity, profiles: [candidate.profileHash, baseline.profileHash], texts: [candidate.result.markdown, baseline.result.markdown], boards }))
      const prior = mapping.pairs[fixture.id]
      assert.ok(!prior || prior.fingerprint === fingerprint, 'Pair changed after assignment; use a separate --out directory')
      const a = prior?.a ?? (randomInt(2) ? 'candidate' : 'baseline')
      assert.ok(['candidate', 'baseline'].includes(a))
      mapping.pairs[fixture.id] = { a, fingerprint }
      const texts = a === 'candidate' ? [candidate.result.markdown, baseline.result.markdown] : [baseline.result.markdown, candidate.result.markdown]
      for (const [index, letter] of ['A', 'B'].entries()) cases.push({ id: `${fixture.id}:${letter}`, ...boards, markdown: texts[index], review: { geometryCorrect: '', useful: '', intendedTerm: '', notes: '' } })
      positionStatus.state = 'complete'
    } catch (error) {
      if (statuses.every(status => status.passed)) positionStatus.state = 'incompatible'
      rejected.push({ id: fixture.id, reason: error.message })
    }
  }
  assert.ok(attemptedRuns > 0, 'No formal real records; no review output generated')
  if (existsSync(join(output, 'feedback.json'))) {
    const existing = read(join(output, 'feedback.json'))
    assert.ok(existing.cases.every(entry => cases.some(item => item.id === entry.id)), 'Existing feedback includes omitted pairs; select them too or use a new output directory')
  }
  const summary = { plannedPositions: selected.length, completePairs: cases.length / 2, unpairedPositions: selected.length - cases.length / 2,
    expectedRuns: selected.length * 2, passedRuns, unpassedRuns: attemptedRuns - passedRuns, pendingRuns: selected.length * 2 - attemptedRuns }
  const publicData = { schemaVersion: 1, model: 'gpt-6-luna', reviewSetId: mapping.reviewSetId, summary, positions, cases }
  const json = JSON.stringify(publicData, null, 2)
  for (const id of source.keys()) assert.ok(!json.includes(id), 'Original case identifier in model commentary; cannot publish anonymously')
  assert.ok(!/"(?:variant|localCaseId|labels|weakMentions|feedback|comment)"\s*:/.test(json), 'Private metadata in public cases')
  const html = reviewHtml(publicData)
  mkdirSync(privateDirectory, { recursive: true }); writeFileSync(mappingPath, JSON.stringify(mapping, null, 2) + '\n')
  mkdirSync(output, { recursive: true })
  for (const name of ['cases.json', 'review.html']) assert.ok(!existsSync(join(output, name)) || realpathSync(join(output, name)).toLowerCase() === join(output, name).toLowerCase(), 'Linked output files are unsupported')
  writeFileSync(join(output, 'cases.json'), json + '\n'); writeFileSync(join(output, 'review.html'), html)
  console.log(JSON.stringify({ output, summary, rejected }))
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
