#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const modeArg = process.argv.find((arg) => arg.startsWith('--mode='))
const mode = modeArg ? modeArg.split('=')[1] : (args.has('--release') ? 'release' : 'dev')
const releaseRoot = join(root, 'release')
const packageVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
const versionReleaseDir = join(releaseRoot, packageVersion)
const releaseDir = existsSync(versionReleaseDir) ? versionReleaseDir : releaseRoot
const minSizeBytes = Number(process.env.GOAGENT_MIN_ARTIFACT_BYTES ?? 1024 * 1024)

function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name)
    if (name.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const files = walk(releaseDir)
function isPackagedArtifact(file) {
  const rel = file.replace(root + '/', '')
  if (
    rel.includes('.app/') ||
    rel.includes('-unpacked/') ||
    rel.includes('/mac/') ||
    rel.includes('/mac-arm64/')
  ) {
    return false
  }
  return /\.(dmg|zip|exe|AppImage|deb|tar\.gz)$/i.test(file)
}

const artifacts = files.filter(isPackagedArtifact)
const currentArtifactPrefix = `GoAgent-${packageVersion}-`
const currentArtifacts = artifacts.filter((file) => basename(file).startsWith(currentArtifactPrefix))
const macArm64Dmg = currentArtifacts.filter((file) => /mac-arm64\.dmg$/i.test(file))
const macX64Dmg = currentArtifacts.filter((file) => /mac-x64\.dmg$/i.test(file))
const winX64Installer = currentArtifacts.filter((file) => /win-x64\.exe$/i.test(file) && !/portable/i.test(file))
const winX64PortableZip = currentArtifacts.filter((file) => /win-x64-portable\.zip$/i.test(file))
const winX64NvidiaInstaller = currentArtifacts.filter((file) => /win-x64-nvidia\.exe$/i.test(file))
const winX64NvidiaPortableZip = currentArtifacts.filter((file) => /win-x64-nvidia-portable\.zip$/i.test(file))
const winPortableExe = currentArtifacts.filter((file) => /win-x64-portable\.exe$/i.test(file))
const winArm64 = currentArtifacts.filter((file) => /win-arm64/i.test(file))
const tiny = currentArtifacts.filter((file) => statSync(file).size < minSizeBytes)

console.log(`Release artifact smoke (${mode})`)
console.log(`packageVersion=${packageVersion}`)
console.log(`scanDir=${releaseDir.replace(root + '/', '')}`)
console.log(`Found ${currentArtifacts.length} current GoAgent artifact candidates`)
for (const artifact of currentArtifacts) {
  const size = statSync(artifact).size
  console.log(`- ${artifact.replace(root + '/', '')} (${Math.round(size / 1024)} KB)`)
}

const failures = []
const warnings = []
if (currentArtifacts.length === 0) {
  if (mode === 'release') failures.push('No release artifacts found')
  else warnings.push('No release artifacts found in dev mode')
}
if (mode === 'release') {
  if (!existsSync(versionReleaseDir)) failures.push(`No release directory found for package version ${packageVersion}`)
  if (macArm64Dmg.length === 0) failures.push('No macOS arm64 DMG found')
  if (macX64Dmg.length === 0) failures.push('No macOS x64 DMG found')
  if (winX64Installer.length === 0) failures.push('No Windows x64 installer found')
  if (winX64PortableZip.length === 0) failures.push('No Windows x64 portable ZIP found')
  if (winX64NvidiaInstaller.length === 0) failures.push('No Windows NVIDIA x64 installer found')
  if (winX64NvidiaPortableZip.length === 0) failures.push('No Windows NVIDIA x64 portable ZIP found')
  if (winPortableExe.length > 0) failures.push(`Windows portable artifact must be a ZIP, not an EXE: ${winPortableExe.map((file) => file.replace(root + '/', '')).join(', ')}`)
  if (winArm64.length > 0) failures.push(`Windows ARM64 artifacts are not supported for P0 beta: ${winArm64.map((file) => file.replace(root + '/', '')).join(', ')}`)
  if (tiny.length > 0) failures.push(`Artifact too small: ${tiny.map((file) => file.replace(root + '/', '')).join(', ')}`)
} else if (tiny.length > 0) {
  warnings.push(`Artifact too small: ${tiny.map((file) => file.replace(root + '/', '')).join(', ')}`)
}

for (const warning of warnings) console.log(`! ${warning}`)
for (const failure of failures) console.log(`✗ ${failure}`)
console.log(`Summary: ${Math.max(0, currentArtifacts.length - tiny.length)} artifact(s), ${warnings.length} warning(s), ${failures.length} failure(s)`)
process.exit(failures.length > 0 ? 1 : 0)
