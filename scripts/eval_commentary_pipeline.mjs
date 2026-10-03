#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { readRecords, prepareCases, assertAnonymousSgf, assertSafeBoundary, teacherRequest, connectCdp, validatePipelineEvidence, validateMockCapture, canResume, validateImportedRecord, parseStoredResult, semanticProfile } from './lib/commentary_eval.mjs'

const args = process.argv.slice(2)
function option(name, fallback) {
  const at = args.indexOf(`--${name}`)
  return at < 0 ? fallback : args[at + 1]
}
const mode = args.includes('--prepare') ? 'prepare' : args.includes('--real') ? 'real' : args.includes('--mock') ? 'mock' : 'help'
const directory = resolve(option('out', '.tmp/commentary-live'))
const fixturesDir = join(directory, 'fixtures')
const manifestPath = join(fixturesDir, 'manifest.json')
const variant = option('variant', 'candidate')
const phase = args.includes('--diagnostic') ? 'diagnostic' : 'formal'
const prefetchedMaxVisits = Number(option('visits', '96'))
assert.ok(Number.isInteger(prefetchedMaxVisits) && prefetchedMaxVisits >= 40 && prefetchedMaxVisits <= 3000, 'visits must be an integer between 40 and 3000')
assert.ok(['candidate', 'baseline'].includes(variant), 'variant must be candidate or baseline')
assert.ok(!(args.includes('--resume') && args.includes('--new-run')), 'Use --resume or --new-run, not both')
const casesPath = resolve(option('cases', '.tmp/concept-review-round2/cases.json'))
const dataPath = resolve(option('data', '.tmp/concept-data/comments.jsonl'))
const enginePath = option('engine', '')
const promptFile = option('prompt-file', '')
const promptOverride = promptFile ? readFileSync(resolve(promptFile), 'utf8').trim() : undefined
assert.ok(!promptFile || (promptOverride && promptOverride.length <= 4096), 'Prompt override must be nonempty and at most 4096 characters')
const digest = value => createHash('sha256').update(value).digest('hex')

async function mockServer() {
  const captured = []
  let current = null
  const server = createServer((req, res) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try {
        if (req.url?.endsWith('/models')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ data: [{ id: 'commentary-eval-mock' }] })); return }
        const body = JSON.parse(raw || '{}')
        captured.push({ position: current?.id ?? 'probe', body })
        const messages = body.messages ?? []
        const names = new Set((body.tools ?? []).map(tool => tool.function.name))
        const tools = messages.filter(message => message.role === 'tool')
        const needed = current ? [
          ['sgf_readGameRecord', { gameId: current.gameId, maxMoves: current.moveNumber }],
          ['knowledge_matchPosition', { moveNumber: current.moveNumber, maxResults: 4 }],
          ['katago_analyzePosition', { gameId: current.gameId, moveNumber: current.moveNumber, maxVisits: 96 }],
          ['board_captureTeachingImage', { moveNumber: current.moveNumber }]
        ].filter(([name]) => names.has(name) && !tools.some(tool => tool.name === name || tool.tool_call_id === `eval_${name}`)) : []
        const calls = needed.map(([name, input]) => ({ id: `eval_${name}`, type: 'function', function: { name, arguments: JSON.stringify(input) } }))
        if (!current && names.has('readiness_check')) calls.push({ id: 'eval_readiness_check', type: 'function', function: { name: 'readiness_check', arguments: '{"value":"goagent"}' } })
        const probeText = JSON.stringify(messages).includes('BLUE') ? 'BLUE' : 'OK'
        const message = calls.length ? { role: 'assistant', content: '', tool_calls: calls } : { role: 'assistant', content: current ? `当前第${current.moveNumber}手的讲解应以棋谱、棋盘截图与 KataGo 候选证据为依据。先核对落点与局部气数，再比较实战手和候选点；局部目的及后续仍需结合变化验证，不能仅凭术语断言。` : probeText }
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream' })
          const delta = calls.length ? { tool_calls: calls.map((call, index) => ({ index, ...call })) } : { content: message.content }
          res.end(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: calls.length ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`)
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ choices: [{ message, finish_reason: calls.length ? 'tool_calls' : 'stop' }] }))
        }
      } catch { res.writeHead(500); res.end('Mock request rejected') }
    })
  })
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
  return { captured, endpoint: `http://127.0.0.1:${server.address().port}/v1`, setCase(value) { current = value }, close() { return new Promise(resolveClose => server.close(resolveClose)) } }
}

async function main() {
  if (mode === 'help') {
    console.log('Usage: node scripts/eval_commentary_pipeline.mjs --prepare|--mock|--real [--cases PATH] [--data JSONL] [--engine JSON] [--out DIR] [--cdp PORT] [--bundle PATH] [--variant candidate|baseline] [--onlyids position-1,position-2] [--limit 6] [--visits 96] [--resume|--new-run] [--diagnostic] [--continue-on-error] [--model gpt-6-luna]')
    return
  }
  if (mode === 'prepare') {
    const fixtures = prepareCases(readRecords(casesPath), readRecords(dataPath), enginePath ? readRecords(resolve(enginePath)) : [], fixturesDir)
    if (existsSync(manifestPath)) {
      const previous = JSON.parse(readFileSync(manifestPath, 'utf8'))
      const byLocalId = new Map(previous.cases.map(item => [item.localCaseId, item]))
      for (const fixture of fixtures) {
        const prior = byLocalId.get(fixture.localCaseId)
        assert.ok(prior, 'Existing manifest differs from selected cases; use a separate --out directory')
        assert.match(prior.id, /^position-\d+$/, 'Invalid anonymous fixture ID')
        fixture.id = prior.id
        fixture.filePath = join(fixturesDir, `${prior.id}.sgf`)
      }
      fixtures.sort((a, b) => Number(a.id.split('-').at(-1)) - Number(b.id.split('-').at(-1)))
    }
    mkdirSync(fixturesDir, { recursive: true })
    for (const fixture of fixtures) writeFileSync(fixture.filePath, fixture.sgf + '\n')
    const manifest = { schemaVersion: 1, createdAt: new Date().toISOString(), files: fixtures.map(item => item.filePath), cases: fixtures.map(({ sgf, ...item }) => item) }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    console.log(JSON.stringify({ mode, cases: fixtures.length, manifestPath, absentRules: fixtures.filter(item => !item.rules).length }))
    return
  }
  assert.ok(existsSync(manifestPath), 'Run --prepare first')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const manifestIds = new Set(manifest.cases.map(item => item.localCaseId))
  const privateRecords = readRecords(dataPath).filter(item => manifestIds.has(item.sample_id))
  const onlyIds = option('onlyids', '').split(',').filter(Boolean)
  const limit = Number(option('limit', '6'))
  assert.ok(Number.isInteger(limit) && limit > 0, 'limit must be a positive integer')
  let selected = manifest.cases.filter(item => !onlyIds.length || onlyIds.includes(item.id)).slice(0, limit)
  assert.ok(selected.length, 'No cases selected')
  for (const fixture of selected) {
    const sgf = readFileSync(fixture.filePath, 'utf8').trim()
    assertAnonymousSgf(sgf)
    assert.equal(createHash('sha256').update(sgf).digest('hex'), fixture.sha256, 'Anonymous fixture differs from manifest')
  }
  if (mode === 'mock' && args.includes('--boundary-only')) {
    const boundary = selected.map(fixture => ({ id: fixture.id, sgf: readFileSync(fixture.filePath, 'utf8'), request: teacherRequest(fixture, 'anonymous-game-hash', variant) }))
    assertSafeBoundary(boundary, manifest.cases, privateRecords)
    mkdirSync(join(directory, 'mock'), { recursive: true })
    writeFileSync(join(directory, 'mock', 'boundary.json'), JSON.stringify(boundary, null, 2))
    console.log(JSON.stringify({ mode, cases: selected.length, boundaryPassed: true, providerRequestCapture: false, note: 'Fixture/request boundary only. Use mock-provider mode for production provider capture.' }))
    return
  }
  const outputDir = join(directory, mode === 'mock' ? 'mock' : variant)
  mkdirSync(outputDir, { recursive: true })
  const bundlePath = resolve(option('bundle', 'out/main/index.js'))
  assert.ok(variant !== 'baseline' || option('bundle', ''), 'Baseline evaluation requires --bundle pointing to the running baseline main bundle')
  assert.ok(existsSync(bundlePath), 'Application bundle not found')
  const bundleHash = digest(readFileSync(bundlePath))
  const client = await connectCdp(Number(option('cdp', mode === 'mock' ? '9225' : variant === 'baseline' ? '9224' : '9223')))
  let mock = null
  try {
    const runningBuild = await client.evaluate('({bundleHash:window.__goagentCommentaryEvalBuild?.bundleHash})')
    assert.equal(runningBuild?.bundleHash, bundleHash, 'Running application bundle differs from --bundle; use the evaluation bootstrap for loaded-build verification')
    if (mode === 'mock') {
      // Refuse configuration writes unless the existing instance explicitly identifies itself as the isolated mock profile.
      const profileId = await client.evaluate('(async()=>{const d=await window.goagent.getDashboard();return d.settings.activeLlmConnectionId;})()')
      assert.equal(profileId, 'commentary-eval-mock', 'Mock requires an isolated apphome with commentary-eval-mock active profile')
      mock = await mockServer()
      await client.evaluate(`(async()=>{const d=await window.goagent.getDashboard();await window.goagent.updateSettings({activeLlmConnectionId:'commentary-eval-mock',llmBaseUrl:${JSON.stringify(mock.endpoint)},llmModel:'commentary-eval-mock',llmApiKey:'local-eval-dummy',llmConnections:d.settings.llmConnections.map(p=>p.id==='commentary-eval-mock'?{...p,provider:'openai-compatible',authMode:'api-key',endpoint:${JSON.stringify(mock.endpoint)},model:'commentary-eval-mock',enabled:true}:p)});const p=await window.goagent.testLlmSettings({llmBaseUrl:'',llmApiKey:'',llmModel:''});return {ok:p.ok};})()`)
    }
    const expectedModel = mode === 'mock' ? 'commentary-eval-mock' : option('model', 'gpt-6-luna')
    assert.ok(mode === 'mock' || expectedModel === 'gpt-6-luna', 'Real commentary evaluation is fixed to the user-selected gpt-6-luna')
    const state = await client.evaluate(`(async()=>{const d=await window.goagent.getDashboard(); const p=d.settings.llmConnections.find(x=>x.id===d.settings.activeLlmConnectionId); return {ready:d.systemProfile?.llmConnection?.ready,provider:p?.provider,model:p?.model,runtimePath:p?.executablePath,katagoConfig:d.settings.katagoConfig,connectionStatus:d.systemProfile?.llmConnection?.status,settings:{reviewLanguage:d.settings.reviewLanguage,teacherTerminologyDensity:d.settings.teacherTerminologyDensity,teacherExplanationPace:d.settings.teacherExplanationPace,teacherVariationDetail:d.settings.teacherVariationDetail,katagoEngineMode:d.settings.katagoEngineMode,katagoModelPreset:d.settings.katagoModelPreset,katagoAnalysisSpeedMode:d.settings.katagoAnalysisSpeedMode,katagoAnalysisThreads:d.settings.katagoAnalysisThreads,katagoSearchThreadsPerAnalysisThread:d.settings.katagoSearchThreadsPerAnalysisThread}};})()`)
    assert.equal(state.ready, true, 'Application LLM connection is not ready')
    assert.equal(state.provider, mode === 'mock' ? 'openai-compatible' : 'codex-app-server', 'Unexpected provider for evaluation mode')
    assert.equal(state.model, expectedModel, 'Active model does not match requested model')
    assert.ok(state.katagoConfig && existsSync(state.katagoConfig), 'KataGo generated config is missing')
    const engineConfig = readFileSync(state.katagoConfig, 'utf8')
    const configuredHome = [...engineConfig.matchAll(/^\s*homeDataDir\s*=\s*(.*?)\s*$/gm)].at(-1)?.[1]
    const expectedHome = resolve(option('tuning-home', '.tmp/concept-runtime/KataGoData'))
    assert.ok(configuredHome && resolve(configuredHome).toLowerCase() === expectedHome.toLowerCase(), 'KataGo config must explicitly use the evaluation tuning home before any analysis starts')
    await client.evaluate('(async()=>{const r=await window.goagent.importLibrary(); return {imported:r.imported.length};})()')
    const games = await client.evaluate('(async()=>{const d=await window.goagent.getDashboard();return d.games.map(g=>({id:g.id,filePath:g.filePath}));})()')
    const runtimeHash = state.runtimePath && existsSync(state.runtimePath) ? digest(readFileSync(state.runtimePath)) : null
    const engineConfigHash = digest(engineConfig)
    const meta = { schemaVersion: 2, variant, phase, provider: state.provider, model: state.model, bundleHash, runtimeHash, engineConfigHash, evaluatorRetryPolicy: 'Single attempt per selected case; production adapter retries/vision repairs remain part of the normal pipeline.', inferenceSettings: { effort: 'provider-default', temperature: 'provider-default', note: 'Production Codex adapter sets no explicit effort/temperature; paired runs must share the same CLI binary and account config.' }, createdAt: new Date().toISOString(), cases: selected.map(item => item.id), applicationSettings: state.settings, requestSettings: { coachLevel: 'intermediate', studentAgeRange: 'adult', teacherStyle: 'rigorous', toolPolicy: 'auto', prefetchedMaxVisits }, baselineMethod: variant === 'baseline' ? 'External application bundle must be the baseline commit; this script uses identical request settings.' : undefined }
    const runStamp = `${Date.now()}`
    const runDir = join(outputDir, 'runs', runStamp)
    const identities = new Map(selected.map(fixture => [fixture.id, { model: state.model, provider: state.provider, variant, phase, fixtureHash: fixture.sha256, bundleHash, runtimeHash, engineConfigHash, promptHash: digest(teacherRequest(fixture, '', variant, promptOverride).prompt), settingsHash: digest(JSON.stringify({ app: state.settings, request: meta.requestSettings })) }]))
    // Validate existing results before writing any run metadata. Successful results from another setup never count as a resumed case.
    for (const fixture of selected) {
      const path = join(outputDir, `${fixture.id}.json`)
      if (!existsSync(path)) continue
      const previous = parseStoredResult(readFileSync(path, 'utf8'))
      if (args.includes('--resume') && previous.success) assert.ok(canResume(previous, identities.get(fixture.id)), `Resume identity mismatch for ${fixture.id}; choose a separate output directory`)
      else if (previous.success && !args.includes('--new-run')) throw new Error(`Successful result already exists for ${fixture.id}; use --resume, --new-run or a separate output directory`)
    }
    mkdirSync(runDir, { recursive: true })
    writeFileSync(join(runDir, 'run.json'), JSON.stringify(meta, null, 2))
    if (!existsSync(join(outputDir, 'run.json'))) writeFileSync(join(outputDir, 'run.json'), JSON.stringify(meta, null, 2))
    const outcomes = []
    for (const fixture of selected) {
      const resultPath = join(outputDir, `${fixture.id}.json`)
      const identity = identities.get(fixture.id)
      if (args.includes('--resume') && existsSync(resultPath) && canResume(parseStoredResult(readFileSync(resultPath, 'utf8')), identity)) { outcomes.push({ id: fixture.id, success: true, resumed: true }); console.log(`${variant} ${fixture.id}: resumed`); continue }
      if (existsSync(resultPath)) writeFileSync(join(runDir, `${fixture.id}.previous.json`), readFileSync(resultPath))
      const content = readFileSync(fixture.filePath, 'utf8')
      const hash = createHash('sha1').update(content).digest('hex').slice(0, 12)
      const matches = games.filter(game => game.id === hash)
      assert.equal(matches.length, 1, 'Imported anonymous fixture hash must match exactly one game')
      const gameId = matches[0].id
      const imported = await client.evaluate(`window.goagent.getGameRecord(${JSON.stringify(gameId)}).then(r=>({boardSize:r.boardSize,moves:r.moves.map(m=>({color:m.color,gtp:m.gtp,row:m.row,col:m.col,pass:m.pass})),initialStones:r.initialStones}))`)
      assert.equal(imported.boardSize, fixture.boardSize)
      assert.equal(imported.moves.length, fixture.moveNumber)
      const source = privateRecords.find(item => item.sample_id === fixture.localCaseId)
      assert.ok(source, 'Local source record not found')
      const boardVerification = validateImportedRecord(imported, source)
      const request = teacherRequest(fixture, gameId, variant, promptOverride)
      if (phase === 'diagnostic') request.runId += `-diagnostic-${runStamp}`
      const start = Date.now()
      mock?.setCase({ ...fixture, gameId })
      console.log(`${variant} ${fixture.id}: running`)
      let payload
      try {
        payload = await client.evaluate(`(async()=>{const request=${JSON.stringify(request)};let analysis;const progress=[];const dispose=window.goagent.onTeacherRunProgress(p=>{if(p.runId===request.runId)progress.push(p)});try{analysis=await window.goagent.analyzePosition({gameId:request.gameId,moveNumber:request.moveNumber,maxVisits:${prefetchedMaxVisits}});const result=await window.goagent.runTeacherTask({...request,prefetchedAnalysis:analysis});return {analysis,result,progress};}catch(error){return {analysis,progress,pipelineError:String(error)};}finally{dispose();}})()`)
        assert.ok(!payload.pipelineError, payload.pipelineError)
        validatePipelineEvidence(payload, fixture)
        if (mock) {
          const requests = mock.captured.filter(item => item.position === fixture.id)
          writeFileSync(join(runDir, `${fixture.id}.requests.json`), JSON.stringify(requests, null, 2))
          assertSafeBoundary(requests, manifest.cases, privateRecords)
          validateMockCapture(requests, { gameId, moveNumber: fixture.moveNumber, requireConceptEvidence: variant === 'candidate' })
          writeFileSync(join(runDir, `${fixture.id}.boundary.json`), JSON.stringify({ passed: true, capturedRequests: requests.length, scope: 'Production OpenAI-compatible teacher messages and tool outputs; Codex stdio adapter is validated separately by real execution.' }, null, 2))
        }
        const profileHash = digest(JSON.stringify(semanticProfile(payload.result.studentProfile)))
        const artifact = JSON.stringify({ ...meta, id: fixture.id, identity, success: true, elapsedMs: Date.now() - start, request, boardVerification, profileHash, accountCondition: 'Same account and account config is an operational prerequisite; authentication data is not inspected.', ...payload }, null, 2)
        writeFileSync(join(runDir, `${fixture.id}.json`), artifact)
        writeFileSync(resultPath, artifact)
        writeFileSync(join(runDir, `${fixture.id}.md`), payload.result.markdown)
        writeFileSync(join(outputDir, `${fixture.id}.md`), payload.result.markdown)
        outcomes.push({ id: fixture.id, success: true, elapsedMs: Date.now() - start })
        console.log(`${variant} ${fixture.id}: saved`)
      } catch (error) {
        const failed = JSON.stringify({ ...meta, id: fixture.id, identity, success: false, elapsedMs: Date.now() - start, request, ...payload, error: String(error) }, null, 2)
        writeFileSync(join(runDir, `${fixture.id}.json`), failed)
        writeFileSync(resultPath, failed)
        if (mock) writeFileSync(join(runDir, `${fixture.id}.requests.json`), JSON.stringify(mock.captured.filter(item => item.position === fixture.id), null, 2))
        outcomes.push({ id: fixture.id, success: false, elapsedMs: Date.now() - start, error: String(error) })
        console.log(`${variant} ${fixture.id}: failed; artifact saved`)
        if (!args.includes('--continue-on-error')) throw new Error(`${variant} ${fixture.id} failed; see local error artifact`)
      }
    }
    const summary = { ...meta, denominator: selected.length, succeeded: outcomes.filter(item => item.success).length, failed: outcomes.filter(item => !item.success).length, resumed: outcomes.filter(item => item.resumed).length, completedAt: new Date().toISOString(), outcomes }
    writeFileSync(join(runDir, 'summary.json'), JSON.stringify(summary, null, 2))
    if (existsSync(join(outputDir, 'summary.json'))) writeFileSync(join(runDir, 'previous-summary.json'), readFileSync(join(outputDir, 'summary.json')))
    writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2))
    console.log(JSON.stringify({ variant, phase, denominator: summary.denominator, succeeded: summary.succeeded, failed: summary.failed, summaryPath: join(runDir, 'summary.json') }))
    if (summary.failed) process.exitCode = 1
  } finally { client.close(); if (mock) await mock.close() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
