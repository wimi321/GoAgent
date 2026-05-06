#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

const root = process.cwd()
const fixtureRoot = join(root, 'tests', 'fixtures', 'real-teaching')
const strict = process.argv.includes('--strict') || process.env.GOMENTOR_REAL_EVAL_STRICT === '1'
const enabled = strict || process.env.GOMENTOR_REAL_EVAL === '1'

function walkJson(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walkJson(path)
    return entry.isFile() && entry.name.endsWith('.json') ? [path] : []
  })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function validationErrors(fixture, path) {
  const errors = []
  if (!fixture.id) errors.push('missing id')
  if (!fixture.sgf && !fixture.sgfPath) errors.push('missing sgf or sgfPath')
  if (!Number.isInteger(fixture.moveNumber)) errors.push('missing integer moveNumber')
  if (!fixture.expected) errors.push('missing expected block')
  for (const key of ['allowedBestMoves', 'forbiddenMoves', 'expectedShapes', 'forbiddenShapes', 'mustMention', 'mustNotMention']) {
    if (fixture.expected?.[key] && !Array.isArray(fixture.expected[key])) errors.push(`${key} must be an array`)
  }
  return errors.map((error) => `${path}: ${error}`)
}

function envConfig() {
  const config = {
    katagoBin: process.env.GOMENTOR_KATAGO_BIN || process.env.KATAGO_BIN || '',
    katagoConfig: process.env.GOMENTOR_KATAGO_CONFIG || process.env.KATAGO_CONFIG || '',
    katagoModel: process.env.GOMENTOR_KATAGO_MODEL || process.env.KATAGO_MODEL || '',
    llmBaseUrl: process.env.GOMENTOR_LLM_BASE_URL || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    llmApiKey: process.env.GOMENTOR_LLM_API_KEY || process.env.OPENAI_API_KEY || '',
    llmModel: process.env.GOMENTOR_LLM_MODEL || process.env.LLM_MODEL || 'gpt-5-mini',
    visits: Number(process.env.GOMENTOR_REAL_EVAL_VISITS || 800),
    maxFixtures: Number(process.env.GOMENTOR_REAL_EVAL_MAX_FIXTURES || 0)
  }
  return config
}

function missingConfig(config) {
  const missing = []
  if (!config.katagoBin) missing.push('GOMENTOR_KATAGO_BIN')
  if (!config.katagoConfig) missing.push('GOMENTOR_KATAGO_CONFIG')
  if (!config.katagoModel) missing.push('GOMENTOR_KATAGO_MODEL')
  if (!config.llmApiKey) missing.push('GOMENTOR_LLM_API_KEY or OPENAI_API_KEY')
  if (!config.llmModel) missing.push('GOMENTOR_LLM_MODEL')
  return missing
}

function sgfText(fixture) {
  if (fixture.sgf) return fixture.sgf
  return readFileSync(join(root, fixture.sgfPath), 'utf8')
}

const GTP_COLUMNS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'

function sgfToGtp(raw, size) {
  const value = String(raw ?? '').trim().toLowerCase()
  if (!value || value === 'tt' || value.length < 2) return 'pass'
  const x = value.charCodeAt(0) - 97
  const yFromTop = value.charCodeAt(1) - 97
  if (x < 0 || yFromTop < 0 || x >= size || yFromTop >= size) return 'pass'
  return `${GTP_COLUMNS[x]}${size - yFromTop}`
}

function parseSgf(input) {
  const rootText = input.slice(0, Math.min(input.indexOf(';', 2) > 0 ? input.indexOf(';', 2) : input.length, input.length))
  const size = Number((input.match(/SZ\[(\d+)\]/)?.[1]) ?? 19)
  const komi = Number((input.match(/KM\[([^\]]+)\]/)?.[1]) ?? 7.5)
  const initialStones = []
  for (const prop of ['AB', 'AW']) {
    const color = prop === 'AB' ? 'B' : 'W'
    const regex = new RegExp(`${prop}((?:\\[[^\\]]*\\])+ )?`, 'g')
    // Simpler, robust enough for eval fixtures: scan all AB/AW property values.
    for (const match of input.matchAll(new RegExp(`${prop}((?:\\[[^\\]]*\\])+)`, 'g'))) {
      for (const point of match[1].matchAll(/\[([^\]]*)\]/g)) {
        const move = sgfToGtp(point[1], size)
        if (move !== 'pass') initialStones.push([color, move])
      }
    }
  }
  const moves = []
  const moveRegex = /;\s*([BW])\[([^\]]*)\]/g
  for (const match of input.matchAll(moveRegex)) {
    moves.push([match[1], sgfToGtp(match[2], size)])
  }
  return { size, komi: Number.isFinite(komi) ? komi : 7.5, moves, initialStones, rootText }
}

function sideToMove(moves, positionMoveNumber) {
  const next = moves[positionMoveNumber]
  if (next) return next[0]
  const previous = moves[positionMoveNumber - 1]
  return previous ? (previous[0] === 'B' ? 'W' : 'B') : 'B'
}

function blackWinrate(raw, side) {
  const percent = Number(raw ?? 0.5) <= 1.00001 ? Number(raw ?? 0.5) * 100 : Number(raw ?? 50)
  return Math.max(0, Math.min(100, side === 'B' ? percent : 100 - percent))
}

function blackScore(raw, side) {
  const score = Number(raw ?? 0)
  return side === 'B' ? score : -score
}

function playerWinrate(black, color) {
  return color === 'B' ? black : 100 - black
}

function playerScore(blackScoreLead, color) {
  return color === 'B' ? blackScoreLead : -blackScoreLead
}

function buildPayload({ id, game, moveNumber, maxVisits, allowActual = false }) {
  const beforeMoves = game.moves.slice(0, Math.max(0, moveNumber - 1))
  const current = game.moves[moveNumber - 1]
  const payload = {
    id,
    moves: beforeMoves,
    initialStones: game.initialStones,
    rules: 'Chinese',
    komi: game.komi,
    boardXSize: game.size,
    boardYSize: game.size,
    maxVisits,
    includePVVisits: true,
    overrideSettings: { reportAnalysisWinratesAs: 'SIDETOMOVE' }
  }
  if (allowActual && current && current[1] !== 'pass') {
    payload.allowMoves = [{ player: current[0], moves: [current[1]], untilDepth: 1 }]
  }
  return payload
}

async function runKataGo(config, game, fixture) {
  const moveNumber = fixture.moveNumber
  const actual = game.moves[moveNumber - 1]
  if (!actual) throw new Error(`moveNumber ${moveNumber} is outside SGF move list`)
  const beforeId = `${fixture.id}:before`
  const actualId = `${fixture.id}:actual`
  const queries = [
    buildPayload({ id: beforeId, game, moveNumber, maxVisits: config.visits }),
    buildPayload({ id: actualId, game, moveNumber, maxVisits: Math.max(config.visits, 1200), allowActual: true })
  ]
  const responses = await runKataGoProcess(config, queries)
  const before = responses.get(beforeId)
  const forced = responses.get(actualId)
  if (!before?.rootInfo || !Array.isArray(before.moveInfos)) throw new Error(`KataGo missing before response for ${fixture.id}`)
  const beforeSide = sideToMove(game.moves, moveNumber - 1)
  const topMoves = before.moveInfos.slice(0, 8).map((move, index) => ({
    move: move.move ?? '',
    winrate: blackWinrate(move.winrate, beforeSide),
    scoreLead: blackScore(move.scoreLead ?? move.scoreMean, beforeSide),
    visits: Number(move.visits ?? 0),
    order: Number(move.order ?? index),
    pv: Array.isArray(move.pv) ? move.pv.slice(0, 12) : []
  }))
  const forcedSide = actual[0]
  const forcedCandidate = (forced?.moveInfos ?? []).map((move, index) => ({
    move: move.move ?? '',
    winrate: blackWinrate(move.winrate, forcedSide),
    scoreLead: blackScore(move.scoreLead ?? move.scoreMean, forcedSide),
    visits: Number(move.visits ?? 0),
    order: Number(move.order ?? index),
    pv: Array.isArray(move.pv) ? move.pv.slice(0, 12) : []
  })).find((move) => normalizeMove(move.move) === normalizeMove(actual[1]))
  const best = topMoves[0]
  const actualValue = forcedCandidate ?? topMoves.find((move) => normalizeMove(move.move) === normalizeMove(actual[1]))
  const winrateLoss = best && actualValue ? Math.max(0, playerWinrate(best.winrate, actual[0]) - playerWinrate(actualValue.winrate, actual[0])) : 0
  const scoreLoss = best && actualValue ? Math.max(0, playerScore(best.scoreLead, actual[0]) - playerScore(actualValue.scoreLead, actual[0])) : 0
  return {
    moveNumber,
    actualMove: actual[1],
    color: actual[0],
    topMoves,
    bestMove: best?.move,
    winrateLoss: round(winrateLoss, 2),
    scoreLoss: round(scoreLoss, 2),
    actualCandidate: actualValue,
    knownCoordinates: knownCoordinates(actual[1], topMoves)
  }
}

function runKataGoProcess(config, queries) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.katagoBin, ['analysis', '-config', config.katagoConfig, '-model', config.katagoModel], { stdio: ['pipe', 'pipe', 'pipe'] })
    const expected = new Set(queries.map((query) => query.id))
    const results = new Map()
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`KataGo timeout; received ${results.size}/${expected.size}`))
    }, Math.max(120_000, queries.length * 30_000))
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      while (stdout.includes('\n')) {
        const index = stdout.indexOf('\n')
        const line = stdout.slice(0, index).trim()
        stdout = stdout.slice(index + 1)
        if (!line) continue
        let parsed
        try {
          parsed = JSON.parse(line)
        } catch (error) {
          clearTimeout(timer)
          child.kill()
          reject(new Error(`Unable to parse KataGo response: ${String(error)} ${line.slice(0, 200)}`))
          return
        }
        if (parsed.id && !parsed.isDuringSearch) results.set(parsed.id, parsed)
        if (results.size >= expected.size) {
          clearTimeout(timer)
          child.kill()
          resolve(results)
          return
        }
      }
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', (code) => {
      if (results.size >= expected.size) return
      clearTimeout(timer)
      reject(new Error(stderr.trim() || `KataGo exited with ${code}; received ${results.size}/${expected.size}`))
    })
    for (const query of queries) child.stdin.write(`${JSON.stringify(query)}\n`)
    child.stdin.end()
  })
}

async function callLlm(config, fixture, evidence) {
  const body = {
    model: config.llmModel,
    messages: [
      {
        role: 'system',
        content: [
          '你是 GoMentor 的围棋老师质量评测模式。',
          '只能依据用户给出的 KataGo evidence 讲解。',
          '不得编造坐标、胜率、目差、PV、定式名、死活结论。',
          '如果提到棋盘坐标，只能使用 evidence.knownCoordinates 中已经列出的坐标；其他棋盘坐标一律不要写。',
          '没有证据支持的变化图，不要用 C6、D5 这类棋盘坐标表达；改用“这个方向”“靠住”“压低”“A 点/B 点”这样的非坐标说法。',
          '自动评分会把任何 evidence.knownCoordinates 之外的棋盘坐标判为失败。',
          '请输出 JSON，字段为 markdown、claims。claims 每项含 type、text、evidenceRefs。'
        ].join('\n')
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: '请给学生解释这一手，保持证据优先。',
          student: fixture.student ?? { level: 'intermediate', ageRange: 'adult', style: 'balanced' },
          evidence
        }, null, 2)
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_completion_tokens: 1400
  }
  const llmOutput = await requestTeachingJson(config, body)
  const unsupported = unsupportedCoordinates(llmOutput, evidence)
  if (unsupported.length === 0) return llmOutput

  const repairBody = {
    ...body,
    messages: [
      ...body.messages,
      {
        role: 'assistant',
        content: JSON.stringify(llmOutput)
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: '上一次输出包含 evidence.knownCoordinates 之外的棋盘坐标，请重写 JSON。',
          unsupportedCoordinates: unsupported,
          allowedCoordinates: evidence.knownCoordinates,
          instruction: '删除或改写所有 unsupportedCoordinates。不要新增任何棋盘坐标。仍然保留 KataGo 证据引用和自然讲解。'
        }, null, 2)
      }
    ]
  }
  return requestTeachingJson(config, repairBody)
}

async function requestTeachingJson(config, body) {
  const response = await fetch(`${config.llmBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.llmApiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000)
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`LLM request failed: ${response.status} ${text.slice(0, 400)}`)
  }
  const json = await response.json()
  const content = json.choices?.[0]?.message?.content ?? json.output_text ?? ''
  if (!content) throw new Error('LLM did not return content')
  try {
    const parsed = JSON.parse(content)
    return {
      markdown: typeof parsed.markdown === 'string' ? parsed.markdown : content,
      claims: Array.isArray(parsed.claims) ? parsed.claims : []
    }
  } catch {
    return { markdown: content, claims: [] }
  }
}

function unsupportedCoordinates(llmOutput, evidence) {
  const known = new Set((evidence.knownCoordinates ?? []).map(normalizeMove))
  const text = `${llmOutput.markdown}\n${JSON.stringify(llmOutput.claims)}`
  return Array.from(new Set(text.match(/\b[A-HJ-T](?:1[0-9]|[1-9])\b/gi) ?? []))
    .map(normalizeMove)
    .filter((move) => !known.has(move))
}

function scoreFixture(fixture, evidence, llmOutput) {
  const expected = fixture.expected ?? {}
  const text = `${llmOutput.markdown}\n${JSON.stringify(llmOutput.claims)}`
  const failures = []
  const mentions = expected.mustMention ?? []
  const missingMentions = mentions.filter((item) => !text.includes(item))
  if (missingMentions.length) failures.push(`missing mentions: ${missingMentions.join(', ')}`)
  const forbiddenMentions = (expected.mustNotMention ?? []).filter((item) => text.includes(item))
  if (forbiddenMentions.length) failures.push(`forbidden mentions: ${forbiddenMentions.join(', ')}`)

  const coordinates = Array.from(new Set(text.match(/\b[A-HJ-T](?:1[0-9]|[1-9])\b/gi) ?? [])).map(normalizeMove)
  const unsupported = coordinates.filter((move) => !evidence.knownCoordinates.includes(move))
  if (unsupported.length) failures.push(`unsupported coordinates: ${unsupported.join(', ')}`)

  const allowedBest = (expected.allowedBestMoves ?? []).map(normalizeMove)
  if (allowedBest.length && evidence.bestMove && !allowedBest.includes(normalizeMove(evidence.bestMove))) {
    failures.push(`engine best move ${evidence.bestMove} not in allowedBestMoves ${allowedBest.join(', ')}`)
  }
  const forbiddenMoves = (expected.forbiddenMoves ?? []).map(normalizeMove)
  if (forbiddenMoves.some((move) => coordinates.includes(move))) {
    failures.push(`forbidden move mentioned: ${forbiddenMoves.filter((move) => coordinates.includes(move)).join(', ')}`)
  }
  for (const phrase of ['唯一', '必杀', '必死', '绝对']) {
    if ((expected.mustNotMention ?? []).includes(phrase) && text.includes(phrase)) failures.push(`overclaim phrase: ${phrase}`)
  }
  const claimEvidenceMissing = (llmOutput.claims ?? []).filter((claim) => !Array.isArray(claim.evidenceRefs) || claim.evidenceRefs.length === 0)
  if (claimEvidenceMissing.length) failures.push(`claims missing evidenceRefs: ${claimEvidenceMissing.length}`)
  return {
    ok: failures.length === 0,
    failures,
    unsupportedCoordinates: unsupported.length,
    missingMentions: missingMentions.length,
    forbiddenMentions: forbiddenMentions.length,
    claimEvidenceMissing: claimEvidenceMissing.length
  }
}

function normalizeMove(move) {
  return String(move ?? '').trim().toUpperCase()
}

function knownCoordinates(actualMove, topMoves) {
  const set = new Set([normalizeMove(actualMove)])
  for (const move of topMoves) {
    set.add(normalizeMove(move.move))
    for (const pvMove of move.pv ?? []) set.add(normalizeMove(pvMove))
  }
  return Array.from(set).filter(Boolean)
}

function round(value, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

async function main() {
  const fixtureFiles = walkJson(fixtureRoot)
  const fixtures = fixtureFiles.map((path) => ({ path, fixture: readJson(path) }))
  const errors = fixtures.flatMap(({ path, fixture }) => validationErrors(fixture, path))
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exit(1)
  }
  const config = envConfig()
  const missing = missingConfig(config)
  if (!enabled || missing.length) {
    const summary = {
      skipped: true,
      reason: !enabled ? 'Set GOMENTOR_REAL_EVAL=1 or pass --strict to run real KataGo + real LLM evaluation.' : `Missing config: ${missing.join(', ')}`,
      fixtureCount: fixtures.length,
      strict
    }
    console.log(JSON.stringify(summary, null, 2))
    if (strict) process.exit(1)
    return
  }
  const selected = config.maxFixtures > 0 ? fixtures.slice(0, config.maxFixtures) : fixtures
  const results = []
  for (const { path, fixture } of selected) {
    const game = parseSgf(sgfText(fixture))
    const evidence = await runKataGo(config, game, fixture)
    const llmOutput = await callLlm(config, fixture, evidence)
    const score = scoreFixture(fixture, evidence, llmOutput)
    results.push({ id: fixture.id, path, ok: score.ok, score, evidence: { bestMove: evidence.bestMove, actualMove: evidence.actualMove, winrateLoss: evidence.winrateLoss, scoreLoss: evidence.scoreLoss } })
  }
  const failed = results.filter((item) => !item.ok)
  const summary = {
    skipped: false,
    fixtureCount: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    coordinateHallucinationCount: results.reduce((sum, item) => sum + item.score.unsupportedCoordinates, 0),
    missingMentionCount: results.reduce((sum, item) => sum + item.score.missingMentions, 0),
    forbiddenMentionCount: results.reduce((sum, item) => sum + item.score.forbiddenMentions, 0),
    claimEvidenceMissingCount: results.reduce((sum, item) => sum + item.score.claimEvidenceMissing, 0),
    results
  }
  console.log(JSON.stringify(summary, null, 2))
  if (failed.length) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
