#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs'
import { resolve, join, dirname, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { fixtureBoards } from './build_commentary_blind_review.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const hash = text => createHash('sha256').update(text).digest('hex')
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const columns = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'
const within = (parent, child) => { const path = relative(parent, child); return path !== '' && !path.startsWith('..') && !isAbsolute(path) }

function boardSvg(entry, phase) {
  const step = 22, offset = 32, end = offset + (entry.boardSize - 1) * step, extent = end + 32
  const locate = point => [offset + columns.indexOf(point[0]) * step, offset + (entry.boardSize - Number(point.slice(1))) * step]
  let svg = `<svg viewBox="0 0 ${extent} ${extent}" role="img" aria-label="第 ${entry.moveNumber} 手${phase === 'before' ? '落子前' : '落子后'}棋盘"><rect width="100%" height="100%" rx="10" fill="#e7c793"/>`
  for (let i = 0; i < entry.boardSize; i++) {
    const p = offset + i * step
    svg += `<path d="M${offset},${p}H${end} M${p},${offset}V${end}" stroke="#684d2e" stroke-width=".7"/><text x="${p}" y="19" text-anchor="middle" font-size="10">${columns[i]}</text><text x="16" y="${p + 3}" text-anchor="middle" font-size="10">${entry.boardSize - i}</text>`
  }
  for (const stone of entry[phase]) {
    const [x, y] = locate(stone.point)
    svg += `<circle cx="${x}" cy="${y}" r="9.8" fill="${stone.color === 'B' ? '#20201f' : '#fffdf8'}" stroke="#39332c"/>`
  }
  if (!/^pass$/i.test(entry.playedMove)) {
    const [x, y] = locate(entry.playedMove)
    svg += `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#d82d3e" stroke-width="2.7"/>`
  }
  return svg + '</svg>'
}

export function reviewHtml(data) {
  const cards = data.cases.map((entry, index) => `<article data-review-id="${escape(entry.id)}"><h2>${index + 1}. 第 ${entry.moveNumber} 手 · ${entry.playerColor === 'B' ? '黑' : '白'} ${escape(/^pass$/i.test(entry.playedMove) ? '停着' : entry.playedMove)}</h2><div class="position"><div><div class="toggle" role="group" aria-label="选择棋盘时点"><button type="button" data-phase="before" aria-pressed="true">落子前</button><button type="button" data-phase="after" aria-pressed="false">落子后</button></div><div data-board="before">${boardSvg(entry, 'before')}</div><div data-board="after" hidden>${boardSvg(entry, 'after')}</div><p class="muted">红圈标记本手落点。</p></div><div class="answer"><h3>讲解原文</h3><pre>${escape(entry.markdown)}</pre><details><summary>留下反馈（可选）</summary><label>讲解准确性<select data-key="geometryCorrect"><option value="">未填写</option>${['正确', '有轻微问题', '有明显问题', '不确定'].map(value => `<option>${escape(value)}</option>`).join('')}</select></label><label>备注<textarea data-key="notes" rows="3" maxlength="8192" placeholder="哪里讲得好，或哪里需要修正"></textarea></label></details></div></div></article>`).join('')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>围棋短讲解预览</title><style>
body{margin:0;background:#f5f6f4;color:#25302a;font:16px/1.7 system-ui,sans-serif}main{max-width:1050px;margin:auto;padding:24px}h1{margin:0;font-size:28px}h2{font-size:20px;margin-top:0}h3{font-size:17px;margin-top:0}article{background:white;border:1px solid #d6ddd4;border-radius:14px;padding:22px;margin:24px 0}.position{display:grid;grid-template-columns:minmax(250px,400px) minmax(0,1fr);gap:26px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin-top:0}label{display:block;margin:12px 0}select,textarea{display:block;width:100%;box-sizing:border-box;padding:8px;border:1px solid #aab8ae;border-radius:6px;font:inherit}button{background:#245c40;color:white;border:0;padding:10px 16px;border-radius:7px;font:inherit;cursor:pointer;margin:4px 4px 4px 0}button[aria-pressed=false]{background:#e0e8e1;color:#245c40}button:disabled{opacity:.6}svg{width:100%;height:auto}.muted{font-size:13px;color:#59675e}[hidden]{display:none!important}summary{cursor:pointer}#save-status{font-size:14px}@media(max-width:760px){.position{grid-template-columns:1fr}main{padding:12px}article{padding:14px}.toggle{margin-bottom:8px}}
</style></head><body><main><header><h1>围棋短讲解预览</h1><p>GPT-6 Luna 实际输出 · ${data.cases.length} 个局面</p><p>对照棋盘看本手讲解，点击“落子后”查看变化。</p><button type="button" id="save-project" disabled>保存反馈到项目</button><p id="save-status" role="status" aria-live="polite">正在读取已保存的反馈…</p></header>${cards}</main><script>
const key=${JSON.stringify(`goagent-short-preview-${data.reviewSetId}`)};
const sections=[...document.querySelectorAll('[data-review-id]')];const fields=['geometryCorrect','notes'];const status=document.getElementById('save-status');const button=document.getElementById('save-project');let saved={},loaded=false;const edited=new Set();
try{const parsed=JSON.parse(localStorage.getItem(key)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))saved=parsed}catch{}
function persist(){try{localStorage.setItem(key,JSON.stringify(saved));return true}catch{return false}}
function render(section){section.querySelectorAll('[data-key]').forEach(el=>{el.value=typeof saved[section.dataset.reviewId]?.[el.dataset.key]==='string'?saved[section.dataset.reviewId][el.dataset.key]:''})}
function feedback(){return {schemaVersion:1,cases:sections.map(section=>{const entry={id:section.dataset.reviewId};section.querySelectorAll('[data-key]').forEach(el=>entry[el.dataset.key]=el.value);return entry})}}
function draftStatus(){status.textContent=(persist()?'浏览器已暂存反馈。':'浏览器暂存失败。')+(loaded?'有修改时请保存到项目。':'正在读取项目反馈…')}
sections.forEach(section=>{render(section);section.querySelectorAll('[data-key]').forEach(el=>el.addEventListener('input',()=>{const id=section.dataset.reviewId;edited.add(id);saved[id]??={};saved[id][el.dataset.key]=el.value;draftStatus()}))});
document.querySelectorAll('[data-phase]').forEach(toggle=>toggle.addEventListener('click',()=>{const article=toggle.closest('article');article.querySelectorAll('[data-board]').forEach(board=>board.hidden=board.dataset.board!==toggle.dataset.phase);article.querySelectorAll('[data-phase]').forEach(item=>item.setAttribute('aria-pressed',String(item===toggle)))}));
button.addEventListener('click',async()=>{button.disabled=true;status.textContent='正在保存…';try{const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(feedback())});const result=await response.json();if(!response.ok||!result.ok)throw Error('保存未完成');persist();status.textContent='反馈已保存到项目。'}catch{status.textContent='尚未保存到项目，请确认预览服务可用后重试。'}finally{button.disabled=false}});
async function restore(){try{const response=await fetch('/api/feedback');if(!response.ok)throw Error('读取失败');const value=await response.json();if(value.schemaVersion!==1||!Array.isArray(value.cases))throw Error('反馈格式错误');const byId=new Map(value.cases.map(entry=>[entry.id,entry]));sections.forEach(section=>{const id=section.dataset.reviewId;if(edited.has(id)||Object.hasOwn(saved,id)||!byId.has(id))return;saved[id]={};for(const field of fields)if(typeof byId.get(id)[field]==='string')saved[id][field]=byId.get(id)[field];render(section)});loaded=true;button.disabled=false;draftStatus()}catch{status.textContent='项目反馈暂时无法读取；浏览器草稿已恢复，重新打开预览后可保存。'}}restore();
</script></body></html>`
}

export function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) { console.log('node scripts/build_commentary_short_preview.mjs [--ids position-19,position-20,position-8,position-16] [--result-dir PATH (repeatable)] [--out .tmp/commentary-short-preview]'); return }
  const options = new Map()
  for (let i = 0; i < args.length; i += 2) {
    assert.ok(['--ids', '--result-dir', '--out', '--manifest', '--source'].includes(args[i]), `Unknown option ${args[i]}`)
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), `Missing ${args[i]} value`)
    assert.ok(args[i] === '--result-dir' || !options.has(args[i]), `Duplicate ${args[i]}`)
    options.set(args[i], [...(options.get(args[i]) ?? []), args[i + 1]])
  }
  const option = (name, fallback) => options.get(name)?.[0] ?? fallback
  const ids = option('--ids', 'position-19,position-20,position-8,position-16').split(',')
  assert.ok(ids.length >= 1 && ids.length <= 6 && new Set(ids).size === ids.length && ids.every(id => /^position-[1-9]\d*$/.test(id)), 'Select 1–6 unique position IDs')
  const manifestPath = resolve(root, option('--manifest', '.tmp/commentary-live-v5/fixtures/manifest.json'))
  const sourcePath = resolve(root, option('--source', '.tmp/concept-review-round2/cases.json'))
  const resultDirs = (options.get('--result-dir') ?? ['.tmp/commentary-short-preview-results/candidate', '.tmp/commentary-live-v5/candidate']).map(path => resolve(root, path))
  const output = resolve(root, option('--out', '.tmp/commentary-short-preview'))
  const temporary = resolve(root, '.tmp')
  assert.ok(within(temporary, output), 'Output must be a child of repository .tmp')
  for (const input of [dirname(manifestPath), dirname(sourcePath), ...resultDirs]) assert.ok(output !== input && !within(output, input) && !within(input, output), 'Output must be separate from inputs')
  let ancestor = output
  while (!existsSync(ancestor)) ancestor = dirname(ancestor)
  assert.ok(realpathSync(ancestor) === realpathSync(temporary) || within(realpathSync(temporary), realpathSync(ancestor)), 'Output ancestor escapes .tmp')
  const fixtures = read(manifestPath).cases
  const source = new Map(read(sourcePath).cases.map(entry => [entry.id, entry]))
  const cases = ids.map(id => {
    const fixture = fixtures.find(entry => entry.id === id)
    assert.ok(fixture, `Unknown fixture ${id}`)
    const resultPath = resultDirs.map(dir => join(dir, `${id}.json`)).find(existsSync)
    assert.ok(resultPath, `Result not ready: ${id}`)
    const result = read(resultPath)
    assert.equal(result.success, true, `Unsuccessful result ${id}`)
    assert.equal(result.id, id)
    assert.equal(result.model, 'gpt-6-luna')
    assert.equal(result.provider, 'codex-app-server')
    assert.equal(result.variant, 'candidate')
    assert.equal(result.identity?.fixtureHash, fixture.sha256)
    assert.equal(result.request?.moveNumber, fixture.moveNumber)
    assert.ok(typeof result.result?.markdown === 'string' && result.result.markdown.trim(), `Missing original commentary ${id}`)
    assert.equal(result.boardVerification?.verified, true)
    const fixturePath = resolve(fixture.filePath)
    assert.ok(within(dirname(manifestPath), fixturePath), 'Fixture outside manifest directory')
    const original = source.get(fixture.localCaseId)
    assert.ok(original, `Missing source ${id}`)
    const boards = fixtureBoards(fixture, original, readFileSync(fixturePath, 'utf8'))
    for (const phase of ['before', 'after']) {
      const flat = Array(boards.boardSize ** 2).fill(0)
      for (const stone of boards[phase]) flat[(Number(stone.point.slice(1)) - 1) * boards.boardSize + columns.indexOf(stone.point[0])] = stone.color === 'B' ? 1 : -1
      assert.deepEqual(result.boardVerification[phase], flat, `Result board differs from fixture ${id}`)
    }
    return { id, ...boards, markdown: result.result.markdown }
  })
  const data = { schemaVersion: 1, model: 'gpt-6-luna', reviewSetId: hash(output.toLowerCase()).slice(0, 24), cases }
  for (const name of ['cases.json', 'review.html', 'feedback.json']) {
    const path = join(output, name)
    assert.ok(!existsSync(path) || realpathSync(path).toLowerCase() === path.toLowerCase(), 'Linked output files unsupported')
  }
  if (existsSync(join(output, 'cases.json'))) {
    for (const previous of read(join(output, 'cases.json')).cases) assert.deepEqual(cases.find(entry => entry.id === previous.id), previous, 'Existing preview changed; use a new --out directory')
  }
  if (existsSync(join(output, 'feedback.json'))) assert.ok(read(join(output, 'feedback.json')).cases.every(entry => ids.includes(entry.id)), 'Existing feedback would be omitted; use a new --out directory')
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, 'cases.json'), JSON.stringify(data, null, 2) + '\n')
  writeFileSync(join(output, 'review.html'), reviewHtml(data))
  console.log(JSON.stringify({ output, cases: ids }))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
