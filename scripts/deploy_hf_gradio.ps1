# Deploy free Gradio Space to Hugging Face (no Docker / no credit card).
# Usage:
#   $env:HF_TOKEN = "hf_..."   # Write token from https://huggingface.co/settings/tokens
#   .\scripts\deploy_hf_gradio.ps1 -HfUsername "Hasnain-ai" -SpaceName "RExA"

param(
  [string]$HfUsername = "Hasnain-ai",
  [string]$SpaceName = "RExA"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $Root "hf-gradio"
$Staging = Join-Path $env:TEMP "rexa-hf-gradio"

$token = $env:HF_TOKEN
if (-not $token) {
  $secure = Read-Host "Paste Hugging Face WRITE token (hf_...)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
}
if (-not $token) { throw "HF_TOKEN required" }

if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
New-Item -ItemType Directory -Path $Staging | Out-Null
Copy-Item (Join-Path $Src "*") $Staging -Recurse -Force

Set-Location $Staging
git init -b main | Out-Null
git -c user.name="Hasnain Ali" -c user.email="talpurhasnain91@gmail.com" add -A
$msgFile = Join-Path $env:TEMP "hf-gradio-msg.txt"
[System.IO.File]::WriteAllText($msgFile, "Deploy RExA Gradio public demo`n")
git -c user.name="Hasnain Ali" -c user.email="talpurhasnain91@gmail.com" commit --file $msgFile --author="Hasnain Ali <talpurhasnain91@gmail.com>" | Out-Null
Remove-Item $msgFile -ErrorAction SilentlyContinue

$authRemote = "https://oauth2:${token}@huggingface.co/spaces/$HfUsername/$SpaceName"
git remote remove origin -ErrorAction SilentlyContinue
git remote add origin $authRemote
Write-Host "Pushing to https://huggingface.co/spaces/$HfUsername/$SpaceName ..."
git push -u origin main --force

Write-Host ""
Write-Host "Public link:"
Write-Host "  https://huggingface.co/spaces/$HfUsername/$SpaceName"
Write-Host "Click Analyze with RExA after the Space finishes building."
