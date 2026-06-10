import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('real teaching eval is wired but not forced into default CI', () => {
  const packageJson = JSON.parse(read('package.json'))
  assert.equal(packageJson.scripts['eval:real-teaching'], 'node scripts/eval_real_teaching.mjs')
  assert.equal(packageJson.scripts['eval:real-teaching:strict'], 'node scripts/eval_real_teaching.mjs --strict')
  assert.match(packageJson.scripts['check:deep-teacher-quality'], /eval:real-teaching:strict/)
  assert.doesNotMatch(packageJson.scripts['check:teacher-quality'], /eval:real-teaching/)
})

test('real teaching eval uses real KataGo and real LLM configuration', () => {
  const script = read('scripts/eval_real_teaching.mjs')
  assert.match(script, /GOAGENT_REAL_EVAL/)
  assert.match(script, /GOAGENT_KATAGO_BIN/)
  assert.match(script, /GOAGENT_KATAGO_CONFIG/)
  assert.match(script, /GOAGENT_KATAGO_MODEL/)
  assert.match(script, /GOAGENT_LLM_BASE_URL/)
  assert.match(script, /GOAGENT_LLM_API_KEY|OPENAI_API_KEY/)
  assert.match(script, /chat\/completions/)
  assert.match(script, /katagoBin, \['analysis'/)
})

test('persistent KataGo engine pool can be enabled without removing spawn fallback', () => {
  const persistent = read('src/main/services/katagoPersistentEngine.ts')
  const katago = read('src/main/services/katago.ts')
  assert.match(persistent, /queryKataGoPersistentBatch/)
  assert.match(persistent, /GOAGENT_KATAGO_ENGINE_POOL/)
  assert.match(persistent, /cancelPersistentKataGoAnalysis/)
  assert.match(katago, /persistentKataGoEngineEnabled/)
  assert.match(katago, /queryKataGoPersistentBatch/)
  assert.match(katago, /child = spawn\(command\[0\], command\.slice\(1\)/)
  assert.match(katago, /Local KataGo analysis failed in opt-in slow-machine mode; falling back to Zhizi cloud/)
})

test('real teaching fixtures exist', () => {
  assert.ok(existsSync(join(root, 'tests', 'fixtures', 'real-teaching', 'current-move', 'corner-approach-real-001.json')))
})
