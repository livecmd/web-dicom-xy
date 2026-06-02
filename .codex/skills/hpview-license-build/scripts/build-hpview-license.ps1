param(
  [Parameter(Mandatory = $true)]
  [string]$Hospital,

  [Parameter(Mandatory = $true)]
  [string]$HostName,

  [Parameter(Mandatory = $true)]
  [string]$Salt,

  [string]$HospitalParam = "hospital",

  [switch]$QuickBuild,

  [switch]$SkipPlaintextCheck
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  $scriptDir = Split-Path -Parent $PSCommandPath
  return (Resolve-Path (Join-Path $scriptDir "..\..\..\..")).Path
}

function Normalize-LicenseValue {
  param([string]$Value)
  return $Value.Trim().ToLowerInvariant()
}

function Normalize-HostName {
  param([string]$Value)

  $trimmed = $Value.Trim()
  if ($trimmed -match "^[a-zA-Z][a-zA-Z0-9+.-]*://") {
    return ([Uri]$trimmed).Host.ToLowerInvariant()
  }

  $withoutPath = ($trimmed -split "/")[0]
  return ($withoutPath -split ":")[0].ToLowerInvariant()
}

function Get-LicenseHash {
  param(
    [ValidateSet("hospital", "host")]
    [string]$Kind,
    [string]$Value,
    [string]$SaltValue
  )

  $normalized = Normalize-LicenseValue $Value
  $payload = "$SaltValue`:$Kind`:$normalized"
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Set-EnvForBuild {
  param([hashtable]$Values)

  $previous = @{}
  foreach ($key in $Values.Keys) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
    [Environment]::SetEnvironmentVariable($key, $Values[$key], "Process")
  }

  return $previous
}

function Restore-Env {
  param([hashtable]$Previous)

  foreach ($key in $Previous.Keys) {
    [Environment]::SetEnvironmentVariable($key, $Previous[$key], "Process")
  }
}

$repoRoot = Get-RepoRoot
$outputPath = Join-Path $repoRoot "platform\app\hpview"
$normalizedHospital = Normalize-LicenseValue $Hospital
$normalizedHost = Normalize-HostName $HostName

if (-not $normalizedHospital) {
  throw "Hospital is required."
}

if (-not $normalizedHost) {
  throw "HostName is required."
}

if (-not $Salt.Trim()) {
  throw "Salt is required."
}

$hospitalHash = Get-LicenseHash -Kind "hospital" -Value $normalizedHospital -SaltValue $Salt
$hostHash = Get-LicenseHash -Kind "host" -Value $normalizedHost -SaltValue $Salt

Write-Host "Repository: $repoRoot"
Write-Host "Hospital hash: $hospitalHash"
Write-Host "Host hash: $hostHash"

$envValues = @{
  "OHIF_LICENSE_HOSPITAL_HASHES" = $hospitalHash
  "OHIF_LICENSE_HOST_HASHES" = $hostHash
  "OHIF_LICENSE_SALT" = $Salt
  "OHIF_LICENSE_HOSPITAL_PARAM" = $HospitalParam
  "GENERATE_SOURCEMAP" = "false"
}

if ($QuickBuild) {
  $envValues["QUICK_BUILD"] = "true"
}

$previousEnv = Set-EnvForBuild $envValues

try {
  $previousOutputWriteTime = $null
  if (Test-Path $outputPath) {
    $previousOutputWriteTime = (Get-Item $outputPath).LastWriteTimeUtc
  }

  Push-Location $repoRoot
  try {
    yarn build:hpview
    if ($LASTEXITCODE -ne 0) {
      throw "HPView build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }

  if (-not (Test-Path $outputPath)) {
    throw "Expected HPView output directory was not generated: $outputPath"
  }

  $currentOutputWriteTime = (Get-Item $outputPath).LastWriteTimeUtc
  if ($previousOutputWriteTime -and $currentOutputWriteTime -le $previousOutputWriteTime) {
    Write-Warning "HPView output directory timestamp did not advance: $outputPath"
  }
} finally {
  Restore-Env $previousEnv
}

if (-not $SkipPlaintextCheck) {
  Push-Location $repoRoot
  try {
    $hpviewPath = "platform\app\hpview"
    $rg = Get-Command rg -ErrorAction SilentlyContinue
    if (-not $rg) {
      Write-Warning "rg is not available; skipping plaintext scan."
      return
    }

    $hospitalMatches = & rg -n --fixed-strings $Hospital $hpviewPath
    $hostMatches = & rg -n --fixed-strings $normalizedHost $hpviewPath
    $hospitalHashMatches = & rg -n --fixed-strings $hospitalHash $hpviewPath
    $hostHashMatches = & rg -n --fixed-strings $hostHash $hpviewPath

    if ($hospitalMatches -or $hostMatches) {
      if ($hospitalMatches) {
        Write-Host $hospitalMatches
      }
      if ($hostMatches) {
        Write-Host $hostMatches
      }
      throw "Plaintext hospital or host was found in platform/app/hpview."
    }

    if (-not $hospitalHashMatches -or -not $hostHashMatches) {
      throw "Expected license hashes were not found in platform/app/hpview; the hpview output may not contain this authorization build."
    }

    Write-Host "Plaintext scan passed: hospital and host were not found in platform/app/hpview."
    Write-Host "Hash scan passed: expected authorization hashes were found in platform/app/hpview."
  } finally {
    Pop-Location
  }
}
