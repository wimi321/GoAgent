import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(join(root, 'data', 'codex', 'manifest.json'), 'utf8'))
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const mode = process.argv.find((arg) => arg.startsWith('--mode='))?.slice('--mode='.length) ?? 'dev'
const requested = process.argv.filter((arg) => arg.startsWith('--platform=')).map((arg) => arg.slice('--platform='.length))
const targets = requested.length ? [...new Set(requested)] : [`${process.platform}-${process.arch}`]
const failures = []

if (!existsSync(join(root, 'data', 'codex', 'LICENSE'))) {
  failures.push('Codex Apache-2.0 license is missing')
}

if (manifest.version !== packageJson.devDependencies?.['@openai/codex']) {
  failures.push(`manifest version ${manifest.version} does not match @openai/codex ${packageJson.devDependencies?.['@openai/codex'] ?? 'missing'}`)
}
for (const target of ['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-x64', 'linux-arm64']) {
  if (!manifest.targets?.[target]) failures.push(`manifest target is missing: ${target}`)
}

async function sha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

function installedDevelopmentBinary(target) {
  if (target !== `${process.platform}-${process.arch}`) return ''
  try {
    const require = createRequire(join(root, 'package.json'))
    const packagePath = require.resolve('@openai/codex/package.json')
    const platformPackage = require.resolve(`@openai/codex-${target}/package.json`, { paths: [dirname(packagePath)] })
    const triple = target === 'darwin-arm64' ? 'aarch64-apple-darwin'
      : target === 'darwin-x64' ? 'x86_64-apple-darwin'
        : target === 'win32-x64' ? 'x86_64-pc-windows-msvc'
          : target === 'linux-x64' ? 'x86_64-unknown-linux-musl'
            : target === 'linux-arm64' ? 'aarch64-unknown-linux-musl'
              : ''
    return join(dirname(platformPackage), 'vendor', triple, 'bin', target.startsWith('win32-') ? 'codex.exe' : 'codex')
  } catch {
    return ''
  }
}

for (const target of targets) {
  const asset = manifest.targets?.[target]
  if (!asset) {
    failures.push(`unsupported target: ${target}`)
    continue
  }
  const prepared = join(root, 'data', 'codex', 'bin', target, asset.executable)
  const candidate = existsSync(prepared) ? prepared : mode === 'dev' ? installedDevelopmentBinary(target) : ''
  if (!candidate || !existsSync(candidate)) {
    failures.push(`${target} runtime is missing; run prepare:codex-runtime for this platform`)
    continue
  }
  const size = statSync(candidate).size
  const digest = await sha256(candidate)
  if (size !== asset.bytes) failures.push(`${target} size mismatch: ${size}`)
  if (digest !== asset.sha256) failures.push(`${target} SHA256 mismatch: ${digest}`)
  if (target === `${process.platform}-${process.arch}`) {
    const version = spawnSync(candidate, ['--version'], { encoding: 'utf8' })
    if (version.status !== 0 || !`${version.stdout}${version.stderr}`.includes(manifest.version)) {
      failures.push(`${target} failed to report Codex ${manifest.version}`)
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`[codex-runtime] ${failure}`)
  process.exit(1)
}
console.log(`[codex-runtime] ${mode} check passed for ${targets.join(', ')}`)
