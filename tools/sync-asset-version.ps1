param(
  [string]$Version
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$versionFile = Join-Path $repoRoot "assets\asset-version.txt"

if (-not $Version) {
  $Version = (Get-Content -LiteralPath $versionFile -Raw).Trim()
} else {
  Set-Content -LiteralPath $versionFile -Value $Version -NoNewline
}

if (-not $Version) {
  throw "Asset version is empty."
}

$targets = @()
$targets += Get-ChildItem -LiteralPath $repoRoot -Recurse -File -Filter "*.html" |
  Where-Object { $_.FullName -notmatch "\\\.git\\" }

$awwsomeRoot = Resolve-Path (Join-Path $repoRoot "..\AWWsome-Toolkit") -ErrorAction SilentlyContinue
if ($awwsomeRoot) {
  $targets += @(
    Join-Path $awwsomeRoot "web\merge_release_feeds.py"
    Join-Path $awwsomeRoot "_site\index.html"
  ) | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Get-Item -LiteralPath $_ }
}

$assetVersionPattern = '(assets/(?:style\.css|site\.js)\?v=)[^"''<>\s]+'

foreach ($target in $targets) {
  $original = Get-Content -LiteralPath $target.FullName -Raw
  $updated = [regex]::Replace(
    $original,
    $assetVersionPattern,
    { param($match) $match.Groups[1].Value + $Version }
  )

  if ($updated -ne $original) {
    Set-Content -LiteralPath $target.FullName -Value $updated -NoNewline
    Write-Host "Updated $($target.FullName)"
  }
}
