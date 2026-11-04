$ErrorActionPreference = 'Stop'

if (-not $env:API_FOOTBALL_KEY) {
    throw 'Define API_FOOTBALL_KEY en esta ventana de PowerShell antes de iniciar.'
}

py scripts/run_local.py
