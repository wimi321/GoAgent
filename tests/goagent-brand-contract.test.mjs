import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

function trackedTextFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer' })
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((file) => existsSync(join(root, file)))
    .filter((file) => {
      const body = readFileSync(join(root, file))
      return !body.includes(0)
    })
}

test('GoAgent brand identity is the only current product identity', () => {
  const forbiddenParts = ['Go' + 'Mentor', 'go' + 'mentor', 'Kata' + 'Sensei', 'kata' + 'sensei', 'GO' + 'MENTOR', 'KATA' + 'SENSEI']
  const forbidden = new RegExp(`\\b(?:${forbiddenParts.join('|')})\\b`)
  const offenders = []
  for (const file of trackedTextFiles()) {
    const body = read(file)
    if (forbidden.test(body)) offenders.push(file)
  }
  assert.deepEqual(offenders, [])
})

test('package, preload API, and public docs use GoAgent identity', () => {
  const packageJson = JSON.parse(read('package.json'))
  assert.equal(packageJson.name, 'goagent')
  assert.equal(packageJson.build.appId, 'com.goagent.desktop')
  assert.equal(packageJson.build.productName, 'GoAgent')
  assert.equal(packageJson.build.publish.repo, 'GoAgent')

  const preload = read('src/preload/index.ts')
  assert.match(preload, /exposeInMainWorld\('goagent'/)
  assert.doesNotMatch(preload, new RegExp('go' + 'mentor'))

  const brand = read('src/shared/brand.ts')
  assert.match(brand, /BRAND_DISPLAY_NAME/)
  assert.match(brand, /围棋智能体/)

  const readme = read('README.md')
  assert.match(readme, /GoAgent · 围棋智能体/)
  assert.match(readme, /目标是打造全球领先的围棋智能体/)
})
