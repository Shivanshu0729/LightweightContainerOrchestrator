$ErrorActionPreference = "Stop"

Write-Host "Starting Lightweight Container Orchestrator Frontend..." -ForegroundColor Cyan
Set-Location -Path (Join-Path $PSScriptRoot "frontend")

if (-Not (Test-Path "node_modules")) {
    Write-Host "Installing frontend node_modules..." -ForegroundColor Yellow
    npm.cmd install
}

Write-Host "Launching Vite dev server at http://localhost:5173" -ForegroundColor Green
npm.cmd run dev
