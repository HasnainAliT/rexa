# Deploy RExA to a free Hugging Face Docker Space (no credit card).
# Prerequisites:
#   1. Create a public Docker Space named "rexa" under your HF account
#   2. Create a Write token at https://huggingface.co/settings/tokens
#
# Usage:
#   .\scripts\deploy_hf_space.ps1 -HfUsername "yourname"
#   (you will be prompted for the HF token, or set env HF_TOKEN)

param(
  [Parameter(Mandatory = $true)]
  [string]$HfUsername,
  [string]$SpaceName = "rexa"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Staging = Join-Path $env:TEMP "rexa-hf-space"
$Remote = "https://huggingface.co/spaces/$HfUsername/$SpaceName"

$token = $env:HF_TOKEN
if (-not $token) {
  $secure = Read-Host "Paste Hugging Face WRITE token (hf_...)" -AsSecureString
  $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  )
}
if (-not $token) { throw "HF token required" }

if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
New-Item -ItemType Directory -Path $Staging | Out-Null

Write-Host "Preparing Space files in $Staging ..."

# Space README with YAML frontmatter (required by HF)
Copy-Item (Join-Path $Root "hf-space\README.md") (Join-Path $Staging "README.md")

# App image sources
Copy-Item (Join-Path $Root "Dockerfile") (Join-Path $Staging "Dockerfile")
Copy-Item (Join-Path $Root ".dockerignore") (Join-Path $Staging ".dockerignore") -ErrorAction SilentlyContinue

$dirs = @(
  "backend",
  "src",
  "public",
  "ml\checkpoints\large",
  "ml\checkpoints\sentence_roles",
  "ml\checkpoints\concept_coverage",
  "ml\checkpoints\support_contradiction",
  "ml\checkpoints\reasoning_depth",
  "ml\checkpoints\star_prediction"
)
foreach ($d in $dirs) {
  $src = Join-Path $Root $d
  $dst = Join-Path $Staging $d
  if (Test-Path $src) {
    New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
    Copy-Item $src $dst -Recurse -Force
  }
}

$files = @(
  "package.json",
  "package-lock.json",
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "components.json"
)
foreach ($f in $files) {
  Copy-Item (Join-Path $Root $f) (Join-Path $Staging $f) -Force
}

# Strip secrets / venv if copied
Remove-Item (Join-Path $Staging "backend\.env") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $Staging "backend\.venv") -Recurse -Force -ErrorAction SilentlyContinue

Set-Location $Staging
git init -b main
git -c user.name="Hasnain Ali" -c user.email="talpurhasnain91@gmail.com" add -A
$msgFile = Join-Path $env:TEMP "hf-space-msg.txt"
[System.IO.File]::WriteAllText($msgFile, "Deploy RExA public demo to Hugging Face Spaces`n")
git -c user.name="Hasnain Ali" -c user.email="talpurhasnain91@gmail.com" commit --file $msgFile --author="Hasnain Ali <talpurhasnain91@gmail.com>"
Remove-Item $msgFile -ErrorAction SilentlyContinue

$authRemote = "https://oauth2:${token}@huggingface.co/spaces/$HfUsername/$SpaceName"
git remote add origin $authRemote
Write-Host "Pushing to $Remote ..."
git push -u origin main --force

Write-Host ""
Write-Host "Done. Open (after build turns green):"
Write-Host "  https://huggingface.co/spaces/$HfUsername/$SpaceName"
Write-Host "Login: admin@earas.edu / Admin1234"
