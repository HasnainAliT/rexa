# Extract Colab DistilBERT zip into the project checkpoint folder.
# Usage (PowerShell):
#   .\scripts\install_distilbert_checkpoint.ps1 "C:\Users\Hasnain Ali Talpur\Downloads\distilbert_stars.zip"

param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath
)

$ErrorActionPreference = "Stop"
$dest = Join-Path $PSScriptRoot "..\ml\checkpoints\distilbert_stars"
$dest = [System.IO.Path]::GetFullPath($dest)

if (-not (Test-Path $ZipPath)) {
  Write-Error "Zip not found: $ZipPath"
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Write-Host "Extracting to $dest ..."
Expand-Archive -Path $ZipPath -DestinationPath $dest -Force

# If zip contained a nested folder, flatten common layouts
$modelDir = Join-Path $dest "model"
if (-not (Test-Path $modelDir)) {
  $nested = Get-ChildItem $dest -Directory | Where-Object { Test-Path (Join-Path $_.FullName "model") } | Select-Object -First 1
  if ($nested) {
    Write-Host "Flattening nested folder $($nested.Name) ..."
    Copy-Item -Path (Join-Path $nested.FullName "*") -Destination $dest -Recurse -Force
  }
}

Write-Host "Result:"
Get-ChildItem $dest -Recurse | Select-Object FullName, Length | Format-Table -AutoSize

if (Test-Path (Join-Path $dest "model")) {
  Write-Host "OK: model folder found. Restart the API with MODEL_MODE=trained."
} else {
  Write-Warning "model/ folder not found. Open the zip and make sure it contains a 'model' directory."
}
