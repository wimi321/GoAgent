param([Parameter(Mandatory=$true)][string]$Binary)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public class GoAgentLoaderMode {
  [DllImport("kernel32.dll")] public static extern uint SetErrorMode(uint mode);
}
'@
$binaryPath = (Resolve-Path -LiteralPath $Binary).Path
$work = Join-Path ([IO.Path]::GetTempPath()) ('goagent-clean-version-' + [Guid]::NewGuid())
[void](New-Item -ItemType Directory -Path $work)
$oldMode = [GoAgentLoaderMode]::SetErrorMode(0x8003)
try {
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $binaryPath
  $info.Arguments = 'version'
  $info.WorkingDirectory = $work
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.EnvironmentVariables.Clear()
  $info.EnvironmentVariables['SystemRoot'] = $env:SystemRoot
  $info.EnvironmentVariables['WINDIR'] = $env:SystemRoot
  $info.EnvironmentVariables['PATH'] = (Join-Path $env:SystemRoot 'System32') + ';' + $env:SystemRoot
  $info.EnvironmentVariables['TEMP'] = $work
  $info.EnvironmentVariables['TMP'] = $work
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $info
  [void]$process.Start()
  # Read asynchronously so an unexpected verbose binary cannot fill a pipe.
  $stdout = $process.StandardOutput.ReadToEndAsync()
  $stderr = $process.StandardError.ReadToEndAsync()
  if (-not $process.WaitForExit(10000)) {
    $process.Kill()
    $process.WaitForExit()
    throw 'KataGo clean version probe timed out (10 seconds)'
  }
  [pscustomobject]@{
    binary = $binaryPath
    exitCode = $process.ExitCode
    exitHex = ('{0:X8}' -f $process.ExitCode)
    stdout = $stdout.Result
    stderr = $stderr.Result
    cleanEnvironment = $true
  } | ConvertTo-Json -Compress
} finally {
  [void][GoAgentLoaderMode]::SetErrorMode($oldMode)
  $resolvedWork = [IO.Path]::GetFullPath($work)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
  if (-not $resolvedWork.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected probe cleanup directory' }
  Remove-Item -LiteralPath $resolvedWork -Recurse -Force
}
