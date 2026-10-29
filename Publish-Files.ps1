[CmdletBinding()]
param(
  [string]$Source = $env:GSTOOL_PUBLISH_SOURCE,
  [string]$Destination = $env:GSTOOL_PUBLISH_DESTINATION
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Source) -or [string]::IsNullOrWhiteSpace($Destination)) {
  Write-Error 'This helper must be launched by the GitHub publisher CMD file.'
  exit 1
}

if (-not (Test-Path -LiteralPath $Destination -PathType Container)) {
  throw 'The publishing checkout folder does not exist.'
}

# Enumerate root files instead of hard-coding their names. This remains compatible
# with Windows PowerShell when filenames include non-ASCII characters.
Get-ChildItem -LiteralPath $Source -Force -File |
  Where-Object { $_.Extension -ne '.log' } |
  ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Destination $_.Name) -Force
  }

$folders = @('data', 'images', 'style', 'tools', 'player-showcase-worker')
foreach ($folder in $folders) {
  $fromFolder = Join-Path $Source $folder
  if (-not (Test-Path -LiteralPath $fromFolder -PathType Container)) {
    throw "Required source folder is missing: $folder"
  }

  $toFolder = Join-Path $Destination $folder
  Get-ChildItem -LiteralPath $fromFolder -Recurse -Force -File |
    ForEach-Object {
      $relative = $_.FullName.Substring($fromFolder.Length).TrimStart('\')
      if ($relative -match '^(node_modules|\.wrangler)(\\|$)') { return }
      $to = Join-Path $toFolder $relative
      $parent = Split-Path -Parent $to
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
      Copy-Item -LiteralPath $_.FullName -Destination $to -Force
    }
}
