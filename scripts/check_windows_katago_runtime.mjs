#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { checkWindowsRuntimeDependencies } from './lib/windows_pe_dependencies.mjs'
import { parseKataGoVersion } from './lib/katago_asset_metadata.mjs'

const execFileAsync = promisify(execFile)
const arg = (name, fallback = '') => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const helper = join(dirname(fileURLToPath(import.meta.url)), 'probe_windows_katago.ps1')
export async function checkRuntime(runtime, nvidia) {
  const dependencies = await checkWindowsRuntimeDependencies(runtime, { nvidia })
  const { stdout } = await execFileAsync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', helper, '-Binary', join(runtime, 'katago.exe')], { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 })
  const probe = JSON.parse(stdout.trim())
  if (probe.exitCode !== 0) throw new Error(`KataGo clean version probe failed: 0x${probe.exitHex}; ${probe.stderr || probe.stdout || 'no output'}`)
  if (parseKataGoVersion(probe.stdout) !== '1.17.1') throw new Error(`Expected executable KataGo v1.17.1: ${probe.stdout}`)
  if (nvidia && !/Using CUDA backend/i.test(probe.stdout)) throw new Error(`Expected CUDA backend: ${probe.stdout}`)
  return { runtime, ...probe, dependencies }
}

async function walk(root) {
  const files = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) files.push(...await walk(full))
    else files.push(full)
  }
  return files
}
async function checkArtifact(artifact, nvidia, sevenZip) {
  const work = await mkdtemp(join(tmpdir(), 'goagent-katago-artifact-'))
  try {
    const extract = async (archive, destination) => execFileAsync(sevenZip, ['x', resolve(archive), `-o${destination}`, '-y'], { windowsHide: true, timeout: 300_000, maxBuffer: 4 * 1024 * 1024 })
    await extract(artifact, join(work, 'outer'))
    let files = await walk(join(work, 'outer'))
    if (/\.exe$/i.test(artifact)) {
      // Inspect NSIS payload without executing the installer or touching an install.
      const payloads = files.filter((p) => /(?:^|[\\/])app-64\.7z$/i.test(p))
      if (payloads.length !== 1) throw new Error(`Expected one NSIS app-64.7z payload: ${artifact}`)
      await extract(payloads[0], join(work, 'payload'))
      files = await walk(join(work, 'payload'))
    }
    const engines = files.filter((p) => /[\\/]resources[\\/]data[\\/]katago[\\/]bin[\\/]win32-x64[\\/]katago\.exe$/i.test(p))
    if (engines.length !== 1) throw new Error(`Expected one packaged KataGo runtime: ${artifact}`)
    return { artifact: resolve(artifact), ...await checkRuntime(dirname(engines[0]), nvidia) }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}
async function main() {
  if (process.platform !== 'win32') throw new Error('Clean KataGo runtime check requires Windows')
  const nvidia = process.argv.includes('--nvidia')
  const results = []
  if (arg('runtime-dir')) results.push(await checkRuntime(resolve(arg('runtime-dir')), nvidia))
  for (const item of process.argv.filter((item) => item.startsWith('--artifact='))) results.push(await checkArtifact(item.slice(11), nvidia, arg('7z', '7z')))
  if (!results.length) throw new Error('Provide --runtime-dir=... or --artifact=... (repeatable)')
  const report = JSON.stringify(results, null, 2) + '\n'
  if (arg('evidence')) await writeFile(resolve(arg('evidence')), report)
  console.log(report)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error); process.exitCode = 1 })
