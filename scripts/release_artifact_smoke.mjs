#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const root = process.cwd()
const releaseRoot = join(root, 'release')
const strict = process.env.GOAGENT_RELEASE_ARTIFACT_SMOKE_STRICT === '1'
const packageVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const currentArtifactPrefix = `GoAgent-${packageVersion}-`

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function classify(file) {
  if (!basename(file).startsWith(currentArtifactPrefix)) return ''
  const name = file.replace(/\\/g, '/')
  if (/mac-arm64\.dmg$/.test(name)) return 'mac-arm64-dmg'
  if (/mac-x64\.dmg$/.test(name)) return 'mac-x64-dmg'
  if (/win-x64-nvidia\.exe$/.test(name)) return 'win-nvidia-exe'
  if (/win-x64-nvidia-portable\.7z$/.test(name)) return 'win-nvidia-archive'
  if (/win-x64\.exe$/.test(name)) return 'win-standard-exe'
  if (/win-x64-portable\.zip$/.test(name)) return 'win-standard-zip'
  return ''
}

if (!existsSync(releaseRoot)) {
  console.log(JSON.stringify({ mode: 'no-release-dir', strict, note: 'No release directory yet; artifact smoke will run in release jobs after packaging.' }, null, 2))
  process.exit(strict ? 1 : 0)
}

const files = walk(releaseRoot).filter((file) => statSync(file).isFile())
const found = new Map()
for (const file of files) {
  const key = classify(file)
  if (key) found.set(key, file)
}
const required = ['mac-arm64-dmg', 'mac-x64-dmg', 'win-standard-exe', 'win-standard-zip', 'win-nvidia-exe', 'win-nvidia-archive']
const missing = required.filter((key) => !found.has(key))
const tiny = [...found.entries()].filter(([, file]) => statSync(file).size < 1024 * 1024).map(([key, file]) => `${key}:${file}`)
if (strict && (missing.length || tiny.length)) {
  console.error(JSON.stringify({ missing, tiny }, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ strict, releaseRoot, found: Object.fromEntries(found), missing, tiny }, null, 2))
