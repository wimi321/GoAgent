import { win32 } from 'node:path'

export function teacherShellCommand(
  command: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): { command: string; args: string[] } {
  if (platform === 'win32') {
    return {
      command: win32.join(env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      args: [
        '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
        `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new(); ${command}`
      ]
    }
  }
  return { command: env.SHELL || '/bin/sh', args: ['-lc', command] }
}
