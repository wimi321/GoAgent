#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const fixtureRoot = join(root, 'tests', 'fixtures', 'engine-silver')
function walk(dir) { if (!existsSync(dir)) return []; return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => { const path = join(dir, entry.name); return entry.isDirectory() ? walk(path) : entry.isFile() && entry.name.endsWith('.json') ? [path] : [] }) }
function validateFixture(fixture, file) {
  const errors = []
  if (!fixture.id) errors.push('missing id')
  if (!fixture.sgf && !fixture.gameId) errors.push('missing sgf or gameId')
  if (!Number.isInteger(fixture.moveNumber) && !fixture.moveRange) errors.push('missing moveNumber or moveRange')
  if (!fixture.expected) errors.push('missing expected block')
  if (fixture.expected) {
    for (const key of ['allowedBestMoves', 'forbiddenMoves', 'expectedShapes', 'forbiddenShapes', 'mustMention', 'mustNotMention']) {
      if (fixture.expected[key] && !Array.isArray(fixture.expected[key])) errors.push(`${key} must be an array`)
    }
  }
  if (fixture.engine && typeof fixture.engine.visits !== 'number') errors.push('engine.visits must be numeric when present')
  return errors.map((error) => `${file}: ${error}`)
}
if (!existsSync(fixtureRoot)) mkdirSync(fixtureRoot, { recursive: true })
const files = walk(fixtureRoot)
if (files.length === 0) {
  writeFileSync(join(fixtureRoot, 'README.example.json'), JSON.stringify({ id: 'example-engine-silver-fixture', sgf: '(;GM[1]FF[4]SZ[19];B[pd];W[dd])', moveNumber: 2, engine: { visits: 5000 }, expected: { allowedBestMoves: [], forbiddenMoves: [], expectedShapes: [], forbiddenShapes: [], mustMention: [], mustNotMention: ['唯一', '必杀', '必败'] } }, null, 2))
  console.log(JSON.stringify({ fixtureCount: 0, note: 'No engine-silver fixtures yet; wrote README.example.json template.' }, null, 2))
  process.exit(0)
}
const seen = new Set(); const errors = []
for (const file of files) { const fixture = JSON.parse(readFileSync(file, 'utf8')); if (seen.has(fixture.id)) errors.push(`${file}: duplicate fixture id ${fixture.id}`); seen.add(fixture.id); errors.push(...validateFixture(fixture, file)) }
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(JSON.stringify({ fixtureCount: files.length, mode: 'silver-oracle-schema', note: 'Runtime high-visit KataGo scoring can be enabled on release CI with bundled assets.' }, null, 2))
