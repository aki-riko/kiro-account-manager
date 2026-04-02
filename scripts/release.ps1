$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$checkScript = Join-Path $PSScriptRoot 'check-release-pipeline.ps1'
$buildScript = Join-Path $PSScriptRoot 'build-release.ps1'

Push-Location $repoRoot
try {
  & powershell -ExecutionPolicy Bypass -NoLogo -NoProfile -File $checkScript
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  & powershell -ExecutionPolicy Bypass -NoLogo -NoProfile -File $buildScript
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  Pop-Location
}
