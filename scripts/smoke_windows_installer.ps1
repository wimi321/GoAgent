#requires -Version 7.0
<#
.SYNOPSIS
Installs an NSIS artifact into a fresh temporary directory, compares every file
with win-unpacked, and uninstalls only that temporary installation.
.NOTES
Requires Windows and PowerShell 7. Does not launch GoAgent or delete app data.
EvidencePath is a JSON file. Exit 0 requires both integrity and uninstall checks.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Installer,
  [Parameter(Mandatory = $true)][string]$ExpectedDir,
  [Parameter(Mandatory = $true)][string]$EvidencePath
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

function Assert-WithinTestRoot {
  param([string]$Path, [string]$TestRoot)
  $root = [IO.Path]::GetFullPath($TestRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
  $candidate = [IO.Path]::GetFullPath($Path)
  if (-not $candidate.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing operation outside the dedicated test root: $candidate"
  }
  # A junction inside the test directory must not redirect uninstall or cleanup.
  $cursor = $candidate
  while ($cursor -and $cursor.Length -ge $root.Length) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -LiteralPath $cursor -Force
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw "Refusing operation through a reparse point: $cursor"
      }
    }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  return $candidate
}

function Compare-InstallFiles {
  param([string]$Expected, [string]$Actual)
  $expectedRoot = [IO.Path]::GetFullPath($Expected)
  $actualRoot = [IO.Path]::GetFullPath($Actual)
  $rows = [Collections.Generic.List[object]]::new()
  $expectedNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($file in (Get-ChildItem -LiteralPath $expectedRoot -File -Recurse -Force | Sort-Object FullName)) {
    $relative = [IO.Path]::GetRelativePath($expectedRoot, $file.FullName)
    [void]$expectedNames.Add($relative)
    $target = Join-Path $actualRoot $relative
    $expectedHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    $exists = Test-Path -LiteralPath $target -PathType Leaf
    $actualHash = if ($exists) { (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash } else { $null }
    $rows.Add([pscustomobject]@{
      path = $relative; bytes = $file.Length; expectedSha256 = $expectedHash
      actualSha256 = $actualHash; exists = $exists; matches = ($exists -and $actualHash -eq $expectedHash)
    })
  }
  $extra = @(if (Test-Path -LiteralPath $actualRoot -PathType Container) {
    Get-ChildItem -LiteralPath $actualRoot -File -Recurse -Force | ForEach-Object {
      $relative = [IO.Path]::GetRelativePath($actualRoot, $_.FullName)
      if (-not $expectedNames.Contains($relative)) { $relative }
    }
  })
  $failures = @($rows | Where-Object { -not $_.matches })
  return [pscustomobject]@{
    ok = ($rows.Count -gt 0 -and $failures.Count -eq 0)
    expectedFileCount = $rows.Count; matchedFileCount = $rows.Count - $failures.Count
    missingFiles = @($failures | Where-Object { -not $_.exists } | ForEach-Object path)
    changedFiles = @($failures | Where-Object exists | ForEach-Object path)
    extraFiles = $extra; files = @($rows.ToArray())
  }
}

function Invoke-HiddenProcess {
  param([string]$File, [string]$Arguments, [string]$WorkingDirectory)
  $startedAt = [DateTime]::UtcNow.ToString('o')
  $process = Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru
  $timedOut = -not $process.WaitForExit(180000)
  if ($timedOut) {
    # Terminate only this process and its children, never another GoAgent instance.
    $process.Kill($true)
    [void]$process.WaitForExit(10000)
  }
  $process.Refresh()
  return [pscustomobject]@{
    file = $File; arguments = $Arguments; pid = $process.Id
    startedAt = $startedAt; finishedAt = [DateTime]::UtcNow.ToString('o')
    timedOut = $timedOut; exitCode = $process.ExitCode
  }
}

$evidenceFile = [IO.Path]::GetFullPath($EvidencePath)
[void](New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($evidenceFile)) -Force)
$report = [ordered]@{
  schemaVersion = 1; startedAt = [DateTime]::UtcNow.ToString('o'); ok = $false
  installer = $Installer; expectedDir = $ExpectedDir; evidencePath = $evidenceFile
  testRoot = $null; installDir = $null; preflight = $null
  installation = $null; integrity = $null; uninstallation = $null
  executableRemoved = $false; testRootRemoved = $false
  errors = [Collections.Generic.List[string]]::new()
}
$mutex = $null
$ownsMutex = $false
$testRoot = $null
$installDir = $null
$installationAttempted = $false

try {
  if (-not $IsWindows) { throw 'This installer smoke test requires Windows and PowerShell 7.' }
  $installerPath = (Get-Item -LiteralPath $Installer).FullName
  $expectedPath = (Get-Item -LiteralPath $ExpectedDir).FullName
  if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf) -or [IO.Path]::GetExtension($installerPath) -ne '.exe') { throw 'Installer must be an existing .exe file.' }
  if (-not (Test-Path -LiteralPath (Join-Path $expectedPath 'GoAgent.exe') -PathType Leaf)) { throw 'ExpectedDir must contain the reference win-unpacked/GoAgent.exe.' }
  if (@(Get-ChildItem -LiteralPath $expectedPath -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'ExpectedDir must not contain reparse points.' }
  $report.installer = $installerPath
  $report.expectedDir = $expectedPath
  $mutex = [Threading.Mutex]::new($false, 'Local\GoAgentInstallerSmoke')
  $ownsMutex = $mutex.WaitOne(0)
  if (-not $ownsMutex) { throw 'Another GoAgent installer smoke test is running.' }

  $processes = @(Get-Process | Where-Object { $_.ProcessName -match '^GoAgent(?:[- ]|$)|^Uninstall GoAgent$' } | Select-Object Id, ProcessName)
  $existing = [Collections.Generic.List[object]]::new()
  $registryRoots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  foreach ($registryRoot in $registryRoots) {
    if (-not (Test-Path -LiteralPath $registryRoot)) { continue }
    foreach ($key in (Get-ChildItem -LiteralPath $registryRoot)) {
      $entry = Get-ItemProperty -LiteralPath $key.PSPath
      if ($entry.DisplayName -match '^GoAgent(?:\s|$)') {
        $existing.Add([pscustomobject]@{ registryKey = $key.Name; displayName = $entry.DisplayName; installLocation = $entry.InstallLocation })
      }
    }
  }
  foreach ($base in @($env:LOCALAPPDATA, $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramW6432) | Where-Object { $_ } | Select-Object -Unique) {
    foreach ($relative in @('GoAgent', 'Programs\GoAgent')) {
      $candidate = Join-Path $base $relative
      if (Test-Path -LiteralPath (Join-Path $candidate 'GoAgent.exe') -PathType Leaf) {
        $existing.Add([pscustomobject]@{ installLocation = $candidate })
      }
    }
  }
  $report.preflight = [pscustomobject]@{ processes = $processes; existingInstallations = @($existing.ToArray()); passed = ($processes.Count -eq 0 -and $existing.Count -eq 0) }
  if (-not $report.preflight.passed) { throw 'Refusing to install: an existing GoAgent installation or active GoAgent/installer process was found. Nothing was changed.' }

  $tempParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $testRoot = Join-Path $tempParent ('goagent-installer-smoke-' + [Guid]::NewGuid().ToString('N'))
  [void](New-Item -ItemType Directory -Path $testRoot)
  $installDir = Assert-WithinTestRoot -Path (Join-Path $testRoot '安装 GoAgent 测试') -TestRoot $testRoot
  $report.testRoot = $testRoot
  $report.installDir = $installDir
  $installationAttempted = $true
  # NSIS requires /D to be last and unquoted, including when the path has spaces.
  $report.installation = Invoke-HiddenProcess -File $installerPath -Arguments "/S /currentuser /D=$installDir" -WorkingDirectory $testRoot
  if ($report.installation.timedOut) { throw 'Installer timed out after 180 seconds.' }
  if ($report.installation.exitCode -ne 0) { throw "Installer exited with code $($report.installation.exitCode)." }
  [void](Assert-WithinTestRoot -Path $installDir -TestRoot $testRoot)
  $report.integrity = Compare-InstallFiles -Expected $expectedPath -Actual $installDir
  if (-not $report.integrity.ok) { throw "Installed file integrity failed: $($report.integrity.missingFiles.Count) missing and $($report.integrity.changedFiles.Count) changed files." }
} catch {
  $report.errors.Add($_.Exception.Message)
} finally {
  if ($installationAttempted) {
    try {
      [void](Assert-WithinTestRoot -Path $installDir -TestRoot $testRoot)
      $uninstaller = Join-Path $installDir 'Uninstall GoAgent.exe'
      if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) { throw "Test installation has no uninstaller; leaving its dedicated directory for diagnosis: $installDir" }
      [void](Assert-WithinTestRoot -Path $uninstaller -TestRoot $testRoot)
      # _?= keeps this uninstaller synchronous and fixes its target to our folder.
      # No --delete-app-data flag: personal settings and accounts must be preserved.
      $report.uninstallation = Invoke-HiddenProcess -File $uninstaller -Arguments "/S /currentuser _?=$installDir" -WorkingDirectory $testRoot
      $report.executableRemoved = -not (Test-Path -LiteralPath (Join-Path $installDir 'GoAgent.exe'))
      if ($report.uninstallation.timedOut) { throw 'Uninstaller timed out after 180 seconds.' }
      if ($report.uninstallation.exitCode -ne 0) { throw "Uninstaller exited with code $($report.uninstallation.exitCode)." }
      if (-not $report.executableRemoved) { throw 'Uninstaller returned but the test GoAgent.exe still exists.' }
      # Delete only the fresh, script-owned root after successful uninstallation.
      [void](Assert-WithinTestRoot -Path $testRoot -TestRoot $tempParent)
      [void](Assert-WithinTestRoot -Path $installDir -TestRoot $testRoot)
      Remove-Item -LiteralPath $testRoot -Recurse -Force
      $report.testRootRemoved = -not (Test-Path -LiteralPath $testRoot)
    } catch {
      $report.errors.Add('Cleanup: ' + $_.Exception.Message)
    }
  }
  if ($ownsMutex) { $mutex.ReleaseMutex() }
  if ($null -ne $mutex) { $mutex.Dispose() }
  $report.finishedAt = [DateTime]::UtcNow.ToString('o')
  $report.ok = ($report.errors.Count -eq 0 -and $null -ne $report.integrity -and $report.integrity.ok -and $report.executableRemoved -and $report.testRootRemoved)
  $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $evidenceFile -Encoding utf8
}

[pscustomobject]@{
  ok = $report.ok; evidencePath = $evidenceFile; installDir = $installDir
  installExitCode = $report.installation.exitCode; uninstallExitCode = $report.uninstallation.exitCode
  expectedFileCount = $report.integrity.expectedFileCount; matchedFileCount = $report.integrity.matchedFileCount
  executableRemoved = $report.executableRemoved; errors = @($report.errors.ToArray())
} | ConvertTo-Json -Depth 4
if (-not $report.ok) { exit 1 }
exit 0
