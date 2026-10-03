import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadConceptModule } from './lib/concept_modules.mjs'

const { recognizeMoveConcepts } = await loadConceptModule('src/main/services/knowledge/moveConcepts.ts')
const baselineCommit = 'a5c801c'
const { recognizeShapes } = await loadConceptModule('src/main/services/knowledge/shapeRecognitionEngine.ts', baselineCommit)
const dataPath = process.argv[2] ?? '.tmp/concept-data/comments.jsonl'
const output = process.argv[3] ?? '.tmp/concept-review'
// A later round can retain the original sample identities despite changed concepts.
const pinnedCases = process.argv[4] ? JSON.parse(readFileSync(process.argv[4], 'utf8')).cases : undefined
const pinnedIds = pinnedCases && new Set(pinnedCases.map((entry) => entry.id))
const priorFeedback = process.argv[5] ? JSON.parse(readFileSync(process.argv[5], 'utf8')).cases : []
const priorById = new Map(priorFeedback.map((entry) => [entry.id, entry]))
if (!existsSync(dataPath)) throw new Error('先运行 python scripts/experiments/prepare_comment_concepts.py --games 1000')
const rows = readFileSync(dataPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
const columns = 'ABCDEFGHJKLMNOPQRST'
const cases = []
const counts = { positions: 0, abstained: 0, ambiguous: 0, observed: 0, extensionHypotheses: 0 }
const buckets = new Map()
const games = new Set()
for (const row of rows.filter((row) => row.split === 'test')) {
  const boardSnapshot = row.board_before.flatMap((value, index) => value ? [{ color: value === 1 ? 'B' : 'W', point: `${columns[index % 19]}${Math.floor(index / 19) + 1}` }] : [])
  const [playerColor, playedMove] = row.played_move
  const moveHistory = row.moves_before.map(([color, point]) => ({ color, point }))
  const concepts = recognizeMoveConcepts({ boardSize: 19, boardSnapshot, playedMove, playerColor, moveHistory })
  counts.positions++
  counts[concepts.status]++
  if (concepts.intents.some((intent) => intent.kind === 'side-extension')) counts.extensionHypotheses++
  const observed = concepts.geometry.filter((geometry) => geometry.status === 'observed')
  const bucket = concepts.intents.some((intent) => intent.kind === 'side-extension') ? 'side-extension' : concepts.status === 'ambiguous' ? 'ambiguous' : observed[0]?.kind
  if (pinnedIds) {
    if (!pinnedIds.has(row.sample_id)) continue
  } else {
    if (!['side-extension', 'ambiguous', 'one-space-jump', 'small-knight', 'diagonal', 'two-space-jump', 'large-knight'].includes(bucket)) continue
    if ((buckets.get(bucket) ?? 0) >= 3 || games.has(row.source_game_key ?? row.game_sha256)) continue
  }
  buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
  games.add(row.source_game_key ?? row.game_sha256)
  const moveNumber = row.moves_after.length
  const legacy = recognizeShapes({ boardSize: 19, boardSnapshot, playedMove, playerColor, moveNumber, totalMoves: row.moves_after.length, recentMoves: [], maxResults: 4 })
  cases.push({ id: row.sample_id, gameId: row.game_id, moveNumber, playerColor, playedMove, boardSnapshot, moveHistory, initialStones: row.initial_stones, bucket,
    weakMentions: Object.keys(row.labels).filter((key) => row.labels[key]), concepts,
    legacy: legacy.map((shape) => ({ shapeType: shape.shapeType, wording: shape.recognition, evidence: shape.evidence, safeWording: shape.safeWording })),
    review: { geometryCorrect: null, intendedTerm: '', intentionCorrect: null, useful: null, notes: '' } })
}
if (pinnedCases) {
  const order = new Map(pinnedCases.map((entry, index) => [entry.id, index]))
  cases.sort((a, b) => order.get(a.id) - order.get(b.id))
  if (cases.length !== pinnedCases.length) throw new Error('Pinned review cases missing from the data')
}
mkdirSync(output, { recursive: true })
writeFileSync(join(output, 'cases.json'), JSON.stringify({ baselineCommit, warning: '自动词语标签不是围棋真值。以下是概念层候选措辞，不是最终LLM解说。', counts, cases }, null, 2))
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
function boardSvg(entry) {
  const step = 22, offset = 32, size = 19, end = offset + (size - 1) * step
  let svg = `<svg viewBox="0 0 460 460" role="img" aria-label="${entry.id}落子前棋盘，红圈标记本手"><rect width="460" height="460" rx="10" fill="#e7c793"/>`
  for (let i = 0; i < size; i++) {
    const point = offset + i * step
    svg += `<path d="M${offset},${point}H${end} M${point},${offset}V${end}" stroke="#684d2e" stroke-width=".7"/><text x="${point}" y="19" text-anchor="middle" font-size="10">${columns[i]}</text><text x="16" y="${point + 3}" text-anchor="middle" font-size="10">${size-i}</text>`
  }
  const point = (gtp) => [offset + columns.indexOf(gtp[0]) * step, offset + (19 - Number(gtp.slice(1))) * step]
  for (const stone of entry.boardSnapshot) {
    const [x, y] = point(stone.point)
    svg += `<circle cx="${x}" cy="${y}" r="9.8" fill="${stone.color === 'B' ? '#20201f' : '#fffdf8'}" stroke="#39332c"/>`
  }
  for (const anchor of entry.concepts.geometry.filter((g) => g.status === 'observed')) {
    const [x, y] = point(anchor.anchor)
    svg += `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#42b9fc" stroke-width="2"/>`
  }
  for (const target of new Set((entry.concepts.relationCandidates ?? []).flatMap((candidate) => candidate.enemyAnchor ? [candidate.enemyAnchor] : []))) {
    const [x, y] = point(target)
    svg += `<rect x="${x-6}" y="${y-6}" width="12" height="12" fill="none" stroke="#cc7700" stroke-width="2"/>`
  }
  const [x, y] = point(entry.playedMove)
  svg += `<circle cx="${x}" cy="${y}" r="10.5" fill="none" stroke="#d82d3e" stroke-width="2.6"/><path d="M${x-4},${y}H${x+4} M${x},${y-4}V${y+4}" stroke="#d82d3e" stroke-width="2"/>`
  return svg + '</svg>'
}
const cards = cases.map((entry, index) => {
  const prior = priorById.get(entry.id)
  const previous = pinnedCases?.find((old) => old.id === entry.id)
  const candidates = entry.concepts.relationCandidates ?? []
  const history = entry.moveHistory.slice(-4).map((move) => `${move.color} ${move.point}`).join(' → ')
  return `<article id="case-${index}"><div>${boardSvg(entry)}<p class="legend">落子前局面 · 红圈：本手 ${entry.playerColor} ${escape(entry.playedMove)} · 蓝圈：己棋锚点 · 橙框：敌方目标</p><p class="muted">最近实战：${escape(history || '无')}。初始摆子 ${entry.initialStones?.length ?? 0} 个；手数不含摆子。</p></div><section><h2>${index+1}. ${escape(entry.id)} · 第 ${entry.moveNumber} 手</h2><p class="tag">${escape(entry.bucket)} · <a href="https://github.com/AndreHe02/go/blob/ad7c6bfab21fcd59650db28efe57df0d4531317d/data/annotations/${entry.gameId}.sgf">原棋谱</a></p>
    ${prior ? `<details><summary>你对第一版的反馈</summary><p>${escape(prior.intendedTerm)}</p><p>${escape(prior.notes)}</p><p class="muted">第一版评价：${escape(prior.geometryCorrect)}；${escape(prior.useful)}。这些反馈用于修改，不计入第二版独立准确率。</p></details>` : ''}
    ${previous && prior ? `<p class="muted">第一版：${escape(previous.concepts.wording)}</p>` : ''}
    <h3>${pinnedCases ? '第二版：关系与目的候选' : '分层概念候选'}</h3><p>${escape(entry.concepts.wording)}</p>
    ${candidates.map((candidate) => `${candidate.purposeHypothesis ? `<p class="muted">目的假设：${escape(candidate.purposeHypothesis.wording)}</p>` : ''}`).join('')}
    ${entry.concepts.intents.map((intent) => `<p>${escape(intent.wording)}</p>`).join('')}
    <details><summary>关系证据和仍待验证的地方</summary><ul>${entry.concepts.relations.map((relation) => `<li>${escape(relation.evidence)}</li>`).join('')}${candidates.flatMap((candidate) => [...candidate.evidence, ...candidate.counterEvidence]).map((text) => `<li>${escape(text)}</li>`).join('')}${entry.concepts.geometry.map((g) => `<li>${escape(g.wording)}</li>`).join('')}${entry.concepts.intents.flatMap((intent) => intent.counterEvidence).map((text) => `<li>${escape(text)}</li>`).join('')}</ul></details>
    <details><summary>原局部规则输出</summary>${entry.legacy.length ? entry.legacy.map((shape) => `<p>${escape(shape.safeWording)}：${escape(shape.wording)}</p>`).join('') : '<p>没有匹配。这里没有候选评价数据，不能据此比较完整解说。</p>'}</details>
    <p class="muted">原评论提及：${escape(entry.weakMentions.join(', ') || '没有实验标签')}。这不是本手正确术语。</p><label>本版关系术语 <select data-key="geometryCorrect"><option value="">未审</option><option>正确</option><option>错误</option><option>过度保守</option></select></label><label>你会怎么讲 <input data-key="intendedTerm" placeholder="例如：托高挂的一子／镇住出头方向"></label><label>目的解释有帮助吗 <select data-key="useful"><option value="">未审</option><option>有帮助</option><option>太保守，没有解释目的</option><option>有误导</option></select></label><label>纠正或理由 <textarea data-key="notes" rows="2"></textarea></label></section></article>`
}).join('')
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>围棋概念人工审阅</title><style>body{margin:0;background:#f5f6f4;color:#25302a;font:16px/1.65 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:26px}header{margin-bottom:28px}h1{margin:0}h2{font-size:21px}h3{font-size:16px;margin:16px 0 5px}article{background:white;border:1px solid #d6ddd4;border-radius:14px;padding:22px;display:grid;grid-template-columns:minmax(270px,440px) 1fr;gap:26px;margin-bottom:22px}svg{width:100%;height:auto}p{margin:8px 0}.muted,.legend,.tag{font-size:13px;color:#59675e}label{display:block;margin:10px 0}input,select,textarea{display:block;width:100%;box-sizing:border-box;padding:8px;border:1px solid #b2beb4;border-radius:6px;font:inherit}button{background:#245c40;color:white;border:0;padding:10px 20px;border-radius:8px;font:inherit;cursor:pointer}a{color:#245c40}details{font-size:14px}@media(max-width:760px){article{grid-template-columns:1fr;padding:15px}main{padding:14px}}</style><main><header><h1>围棋概念人工审阅</h1><p>共 ${cases.length} 个不同棋谱的测试局面。请判断：与具体敌棋或角部的关系术语是否正确、目的解释是否有帮助。前6例用于修正；后15例仍待独立审阅。</p><p>这里展示真实概念函数的输出，尚未验证最终 LLM 解说质量。研究数据按整盘隔离；评论标签仅用于抽样。反馈自动保存到本浏览器，也可以下载后交给 Codex。</p><button id="export">下载审阅反馈</button></header>${cards}</main><script>const cases=${JSON.stringify(cases.map(({ id, review }) => ({ id, review }))).replaceAll('<', '\\u003c')};const key='goagent-concept-review-v1';let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}document.querySelectorAll('article').forEach((card,i)=>{card.querySelectorAll('[data-key]').forEach(el=>{el.value=saved[cases[i].id]?.[el.dataset.key]||'';el.addEventListener('input',()=>{saved[cases[i].id]??={};saved[cases[i].id][el.dataset.key]=el.value;try{localStorage.setItem(key,JSON.stringify(saved))}catch{}})})});document.getElementById('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({schemaVersion:1,cases:cases.map(c=>({id:c.id,...saved[c.id]}))},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='goagent-concept-feedback.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});</script></html>`
const projectSaveScript = `<script>
const exportButton = document.getElementById('export');
exportButton.textContent = '下载 JSON 备份';
const saveButton = document.createElement('button');
saveButton.id = 'save-project'; saveButton.textContent = '保存反馈到项目'; saveButton.style.marginRight = '10px';
exportButton.before(saveButton);
const saveStatus = document.createElement('p'); saveStatus.id = 'save-status'; saveStatus.setAttribute('role','status'); saveStatus.setAttribute('aria-live','polite');
exportButton.after(saveStatus);
function currentFeedback() {
  return cases.map((entry,i)=>{
    const result={id:entry.id};
    document.getElementById('case-'+i).querySelectorAll('[data-key]').forEach(el=>result[el.dataset.key]=el.value);
    return result;
  }).filter(entry=>Object.entries(entry).some(([field,value])=>field!=='id' && value.trim()));
}
function draftStatus() {
  const count=currentFeedback().length;
  let stored=false; try{localStorage.setItem(key,JSON.stringify(saved));stored=true}catch{}
  saveStatus.textContent=count ? '已填写 '+count+' 局；'+(stored?'浏览器已暂存。':'浏览器暂存失败。')+'请点“保存反馈到项目”提交当前修改。' : '尚未填写反馈。';
}
draftStatus();
document.querySelectorAll('[data-key]').forEach(el=>el.addEventListener('input',draftStatus));
saveButton.addEventListener('click',async()=>{
  const feedback=currentFeedback();
  if(!feedback.length){saveStatus.textContent='请先填写至少一局反馈。';return}
  saveButton.disabled=true; saveStatus.textContent='正在保存到项目…';
  try{
    const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schemaVersion:1,cases:feedback})});
    const result=await response.json(); if(!response.ok || !result.ok)throw new Error(result.error||'保存服务未就绪');
    saveStatus.textContent='已保存 '+result.savedCases+' 局到项目。Codex 可以直接读取，无需下载或上传文件。';
  }catch(error){saveStatus.textContent='尚未保存到项目：'+error.message+'。你的填写仍在本页面，可用“下载 JSON 备份”。'}
  finally{saveButton.disabled=false}
});
fetch('/api/feedback').then(async response=>{
  if(!response.ok)return; const feedback=await response.json();
  if(!Array.isArray(feedback.cases))return;
  const lookup=new Map(feedback.cases.map(entry=>[entry.id,entry]));
  cases.forEach((entry,i)=>{
    if(Object.hasOwn(saved,entry.id)||!lookup.has(entry.id))return;
    const stored=lookup.get(entry.id);saved[entry.id]={};
    document.getElementById('case-'+i).querySelectorAll('[data-key]').forEach(el=>{el.value=typeof stored[el.dataset.key]==='string'?stored[el.dataset.key]:'';saved[entry.id][el.dataset.key]=el.value});
  });
  draftStatus();
  if(feedback.cases.length)saveStatus.textContent='项目已有 '+feedback.cases.length+' 局反馈，当前页面填写 '+currentFeedback().length+' 局；有修改时请再点“保存反馈到项目”。';
}).catch(()=>{});
</script>`
writeFileSync(join(output, 'review.html'), html
  .replace('<title>', '<link rel="icon" href="data:,"><title>')
  .replace('反馈自动保存到本浏览器，也可以下载后交给 Codex。', '填写时自动暂存在本浏览器；点“保存反馈到项目”后，Codex 可直接读取。下载 JSON 仅用于备份。')
  .replace('</html>', projectSaveScript + '</html>'))
console.log(JSON.stringify({ output, counts, reviewCases: cases.length, note: 'Coverage and abstention only; no expert semantic accuracy claimed.' }))
