import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const root = resolve(process.cwd(), process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? 'release')
const expectedTargets = process.argv
  .filter((arg) => arg.startsWith('--expect='))
  .map((arg) => arg.slice('--expect='.length))
const manifestPaths = []

function walk(directory) {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(path)
    } else if (entry.isFile() && entry.name === 'manifest.json' && path.includes(`${join('data', 'codex')}`)) {
      manifestPaths.push(path)
    }
  }
}

async function sha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

walk(root)
if (!manifestPaths.length) {
  console.error(`[codex-package-smoke] no packaged Codex manifest found below ${root}`)
  process.exit(1)
}

const verifiedTargets = new Set()
const failures = []
const signedTransforms = []

function startsAsExpectedRuntime(executable, target, version) {
  if (target !== `${process.platform}-${process.arch}`) return false
  const result = spawnSync(executable, ['--version'], { encoding: 'utf8' })
  return result.status === 0 && `${result.stdout ?? ''}${result.stderr ?? ''}`.includes(version)
}

function validSignedMacRuntime(executable, target) {
  if (!target.startsWith('darwin-') || process.platform !== 'darwin') return false
  const signature = spawnSync('codesign', ['--verify', '--strict', '--verbose=2', executable], { encoding: 'utf8' })
  if (signature.status !== 0) return false
  const architecture = spawnSync('file', ['-b', executable], { encoding: 'utf8' })
  const expectedArchitecture = target.endsWith('-arm64') ? 'arm64' : 'x86_64'
  return architecture.status === 0 && `${architecture.stdout}${architecture.stderr}`.includes(expectedArchitecture)
}
for (const manifestPath of manifestPaths) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const codexRoot = dirname(manifestPath)
  if (!existsSync(join(codexRoot, 'LICENSE'))) {
    failures.push(`${manifestPath}: packaged Codex license is missing`)
  }
  const packagedTargets = existsSync(join(codexRoot, 'bin'))
    ? readdirSync(join(codexRoot, 'bin'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    : []
  for (const target of packagedTargets) {
    const asset = manifest.targets?.[target]
    if (!asset) {
      failures.push(`${manifestPath}: target ${target} is not declared in the manifest`)
      continue
    }
    const executable = join(codexRoot, 'bin', target, asset.executable)
    if (!existsSync(executable)) {
      failures.push(`${manifestPath}: missing ${target}/${asset.executable}`)
      continue
    }
    const size = statSync(executable).size
    const digest = await sha256(executable)
    const exactSourceMatch = size === asset.bytes && digest === asset.sha256
    const startsCorrectly = startsAsExpectedRuntime(executable, target, manifest.version)
    const signedMacRuntime = validSignedMacRuntime(executable, target)
    if (!exactSourceMatch && !signedMacRuntime && !(target.startsWith('win32-') && startsCorrectly)) {
      failures.push(`${manifestPath}: ${target} differs from the verified source and has no valid packaged signature/runtime evidence (${size}, ${digest})`)
    } else if (!exactSourceMatch) {
      signedTransforms.push(target)
    }

    if (target === `${process.platform}-${process.arch}` && !startsCorrectly) {
      failures.push(`${manifestPath}: ${target} failed to start as Codex ${manifest.version}`)
    }
    verifiedTargets.add(target)
  }
}

for (const target of expectedTargets) {
  if (!verifiedTargets.has(target)) failures.push(`expected packaged target was not found: ${target}`)
}
if (failures.length) {
  for (const failure of failures) console.error(`[codex-package-smoke] ${failure}`)
  process.exit(1)
}

console.log(`[codex-package-smoke] verified ${[...verifiedTargets].sort().join(', ')} in ${basename(root)}`)
if (signedTransforms.length) {
  console.log(`[codex-package-smoke] accepted signed package transforms for ${[...new Set(signedTransforms)].sort().join(', ')}`)
}
