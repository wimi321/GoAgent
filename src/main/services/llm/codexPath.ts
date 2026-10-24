import { accessSync, constants, existsSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { delimiter, dirname, isAbsolute, join } from 'node:path'

function executableFile(path: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(path).isFile()) return false
    accessSync(path, platform === 'win32' ? constants.F_OK : constants.X_OK)
    return true
  } catch {
    return false
  }
}

// npm installs a .cmd shim on Windows. Resolve its native payload instead of
// launching a shell: Electron cannot spawn .cmd files directly, and a shell
// would complicate quoting and leave an intermediate process on cancellation.
function npmCodexExecutable(directory: string, arch: string): string | null {
  const triple = arch === 'x64' ? 'x86_64-pc-windows-msvc'
    : arch === 'arm64' ? 'aarch64-pc-windows-msvc' : null
  if (!triple) return null
  const packageJson = join(directory, 'node_modules', '@openai', 'codex', 'package.json')
  if (!existsSync(packageJson)) return null
  const roots = [dirname(packageJson)]
  try {
    roots.unshift(dirname(createRequire(packageJson).resolve(`@openai/codex-win32-${arch}/package.json`)))
  } catch {
    // Older npm packages include vendor/ directly in @openai/codex.
  }
  for (const root of roots) {
    const candidate = join(root, 'vendor', triple, 'bin', 'codex.exe')
    if (executableFile(candidate, 'win32')) return candidate
  }
  return null
}

export function findCodexOnPath(
  pathValue = process.env.PATH ?? '',
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string | null {
  for (const entry of pathValue.split(platform === 'win32' ? ';' : delimiter)) {
    const directory = entry.trim().replace(/^"(.*)"$/, '$1')
    // Do not accidentally discover an executable in the current project.
    if (!directory || !isAbsolute(directory)) continue
    const candidate = join(directory, platform === 'win32' ? 'codex.exe' : 'codex')
    if (executableFile(candidate, platform)) return candidate
    if (platform === 'win32' && existsSync(join(directory, 'codex.cmd'))) {
      const native = npmCodexExecutable(directory, arch)
      if (native) return native
    }
  }
  return null
}
