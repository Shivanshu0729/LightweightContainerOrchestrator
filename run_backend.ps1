$ErrorActionPreference = "Stop"

Write-Host "Starting Lightweight Container Orchestrator Backend..." -ForegroundColor Cyan
Set-Location -Path $PSScriptRoot

if (-Not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Virtual environment not found! Creating .venv..." -ForegroundColor Yellow
    py -3.11 -m venv .venv
    .venv\Scripts\pip.exe install -r backend\requirements.txt
}

Write-Host "Launching FastAPI backend at http://localhost:8088" -ForegroundColor Green
Write-Host "Interactive Swagger API documentation available at http://localhost:8088/docs" -ForegroundColor Green

& ".venv\Scripts\python.exe" -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8088 --reload
