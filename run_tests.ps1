$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot
Write-Host "Executing Orchestrator unit & Docker integration tests..." -ForegroundColor Cyan

& ".venv\Scripts\python.exe" -m pytest -v --tb=short
