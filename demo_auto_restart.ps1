param(
    [string]$ApiUrl = "http://127.0.0.1:8088",
    [string]$ContainerName = "demo-nginx"
)

$ErrorActionPreference = "Stop"

Write-Host "   LIGHTWEIGHT ORCHESTRATOR DEMO: AUTO-RECOVERY PIPELINE    " -ForegroundColor Cyan

Write-Host "`n[STEP 1] Checking orchestrator health..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$ApiUrl/api/health" -Method Get
Write-Host "Orchestrator Status : $($health.status)" -ForegroundColor Green
Write-Host "Docker Connected    : $($health.docker_connected)" -ForegroundColor Green
Write-Host "Docker Version      : $($health.docker_version)" -ForegroundColor Green

try {
    $existing = Invoke-RestMethod -Uri "$ApiUrl/api/containers" -Method Get
    foreach ($c in $existing) {
        if ($c.name -eq $ContainerName) {
            Write-Host "Cleaning up previous $ContainerName..." -ForegroundColor Gray
            Invoke-RestMethod -Uri "$ApiUrl/api/containers/$($c.id)" -Method Delete
            Start-Sleep -Seconds 1
        }
    }
} catch {}

Write-Host "`n[STEP 2] Deploying container: $ContainerName (image: nginx:alpine)..." -ForegroundColor Yellow
$deployBody = @{
    name = $ContainerName
    image = "nginx:alpine"
    port = 8089
    container_port = 80
    auto_restart = $true
    health_check = @{
        type = "http"
        path = "/"
        timeout = 3
    }
} | ConvertTo-Json

$deployed = Invoke-RestMethod -Uri "$ApiUrl/api/containers" -Method Post -Body $deployBody -ContentType "application/json"
$cid = $deployed.id
Write-Host "Container deployed successfully!" -ForegroundColor Green
Write-Host "ID            : $($deployed.id)"
Write-Host "Docker ID     : $($deployed.docker_id.Substring(0,12))"
Write-Host "Desired State : $($deployed.desired_state)"
Write-Host "Actual Status : $($deployed.actual_status)"
Write-Host "Health Status : $($deployed.health_status)"

Write-Host "`n[STEP 3] Verifying container is Running and Healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
$current = Invoke-RestMethod -Uri "$ApiUrl/api/containers/$cid" -Method Get
Write-Host "Status: $($current.actual_status) | Health: $($current.health_status) | Restarts: $($current.restart_count)" -ForegroundColor Green

Write-Host "`n[STEP 4] Simulating external crash: executing 'docker kill $ContainerName'..." -ForegroundColor Magenta
docker kill $ContainerName | Out-Null
Write-Host "Container killed externally via Docker CLI!" -ForegroundColor Red

Write-Host "`n[STEP 5 & 6] Waiting for background monitor to detect crash and auto-restart..." -ForegroundColor Yellow
Write-Host "(Configured health check interval: 5 seconds)" -ForegroundColor Gray

$recovered = $false
for ($i = 1; $i -le 15; $i++) {
    Start-Sleep -Seconds 2
    $state = Invoke-RestMethod -Uri "$ApiUrl/api/containers/$cid" -Method Get
    Write-Host "  T+$( $i * 2 )s -> Status: $($state.actual_status.PadRight(12)) | Health: $($state.health_status.PadRight(10)) | Restarts: $($state.restart_count)" -ForegroundColor Cyan
    
    if ($state.restart_count -ge 1 -and $state.actual_status -eq "running" -and $state.health_status -eq "healthy") {
        $recovered = $true
        break
    }
}

if ($recovered) {
    Write-Host "`n[SUCCESS] Container automatically recovered and is back to Healthy!" -ForegroundColor Green
    Write-Host "Restart count incremented: 0 -> $($state.restart_count)" -ForegroundColor Green
} else {
    Write-Host "`n[NOTICE] Current status: $($state.actual_status). Check orchestrator logs for backoff." -ForegroundColor Yellow
}

Write-Host "`n[STEP 7] Fetching lifecycle event history..." -ForegroundColor Yellow
$events = Invoke-RestMethod -Uri "$ApiUrl/api/containers/$cid/events" -Method Get
foreach ($evt in $events) {
    $time = [DateTime]::Parse($evt.timestamp).ToLocalTime().ToString("HH:mm:ss")
    Write-Host "  [$time] $($evt.event_type.PadRight(22)) : $($evt.reason)" -ForegroundColor Gray
}

Write-Host " DEMO COMPLETED SUCCESSFULLY " -ForegroundColor Cyan
