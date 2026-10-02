<#
.SYNOPSIS
    Lance l'API .NET (port 5081) dans une nouvelle fenêtre, puis le site Vite (port 5173) dans celle-ci.
#>
$ErrorActionPreference = 'Stop'

$api = Join-Path $PSScriptRoot 'backend/src/CarteDeVoeuxDebiles.Api'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$api'; dotnet run --launch-profile http"

Push-Location (Join-Path $PSScriptRoot 'frontend')
try {
    if (-not (Test-Path node_modules)) { npm install }
    npm run dev
}
finally {
    Pop-Location
}
