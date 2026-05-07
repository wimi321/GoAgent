#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

const args = new Set(process.argv.slice(2))
const mode = args.has('--mode=release') ? 'release' : 'dev'
const root = process.cwd()
const releaseRoot = join(root, 'release')
const packageVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const versionReleaseRoot = join(releaseRoot, packageVersion)
const scanRoot = existsSync(versionReleaseRoot) ? versionReleaseRoot : releaseRoot

function collectFiles(directory) {
  if (!existsSync(directory)) return []
  const out = []
  const stack = [directory]
  while (stack.length) {
    const current = stack.pop()
    for (const name of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, name.name)
      if (name.isDirectory()) stack.push(full)
      else out.push(full)
    }
  }
  return out
}

const files = collectFiles(scanRoot)
const artifactPatterns = [/\.dmg$/i, /\.zip$/i, /\.exe$/i, /\.AppImage$/i, /\.deb$/i, /\.tar\.gz$/i]
const currentArtifactPrefix = `GoAgent-${packageVersion}-`
const artifacts = files.filter((file) => basename(file).startsWith(currentArtifactPrefix) && artifactPatterns.some((pattern) => pattern.test(file)))
const hasMacArm64Dmg = artifacts.some((file) => /mac-arm64\.dmg$/i.test(file))
const hasMacX64Dmg = artifacts.some((file) => /mac-x64\.dmg$/i.test(file))
const hasWinX64Installer = artifacts.some((file) => /win-x64\.exe$/i.test(file) && !/portable/i.test(file))
const hasWinX64PortableZip = artifacts.some((file) => /win-x64-portable\.zip$/i.test(file))
const winPortableExe = artifacts.filter((file) => /win-x64-portable\.exe$/i.test(file))
const winArm64 = artifacts.filter((file) => /win-arm64/i.test(file))

console.log('\nGoAgent Package Artifact Smoke Check')
console.log('======================================')
console.log(`mode=${mode}`)
console.log(`releaseRoot=${releaseRoot}`)
console.log(`packageVersion=${packageVersion}`)
console.log(`scanRoot=${scanRoot}`)
console.log(`artifactCount=${artifacts.length}`)
for (const artifact of artifacts.slice(0, 20)) console.log(`- ${artifact}`)

if (mode === 'release') {
  const failures = []
  if (!existsSync(versionReleaseRoot)) failures.push(`release directory missing for package version ${packageVersion}`)
  if (!hasMacArm64Dmg) failures.push('macOS arm64 DMG missing')
  if (!hasMacX64Dmg) failures.push('macOS x64 DMG missing')
  if (!hasWinX64Installer) failures.push('Windows x64 installer missing')
  if (!hasWinX64PortableZip) failures.push('Windows x64 portable ZIP missing')
  if (winPortableExe.length > 0) failures.push(`Windows portable artifact must be a ZIP, not an EXE: ${winPortableExe.join(', ')}`)
  if (winArm64.length > 0) failures.push(`Windows ARM64 artifacts are not supported for P0 beta: ${winArm64.join(', ')}`)
  if (failures.length) {
    for (const failure of failures) console.error(`❌ ${failure}`)
    process.exit(1)
  }
  console.log('✅ release artifacts look present')
} else if (!existsSync(releaseRoot) || artifacts.length === 0) {
  console.log('⚠️  no release artifacts found; this is acceptable in dev mode before pnpm dist')
} else {
  console.log('✅ artifacts found')
}
