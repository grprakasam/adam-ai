# Restart ADAM AI Servers Script
# This script stops and restarts both backend and frontend servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ADAM AI - Server Restart Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to kill process on a specific port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    $connections = netstat -ano | findstr ":$Port"
    if ($connections) {
        Write-Host "Stopping processes on port $Port..." -ForegroundColor Yellow
        $connections | ForEach-Object {
            $parts = $_ -split '\s+'
            $pid = $parts[-1]
            if ($pid -and $pid -match '^\d+$') {
                try {
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                    Write-Host "  Stopped process PID: $pid" -ForegroundColor Green
                } catch {
                    Write-Host "  Could not stop process PID: $pid" -ForegroundColor Red
                }
            }
        }
        Start-Sleep -Seconds 2
    } else {
        Write-Host "No processes found on port $Port" -ForegroundColor Gray
    }
}

# Step 1: Stop existing servers
Write-Host "Step 1: Stopping existing servers..." -ForegroundColor Yellow
Stop-ProcessOnPort -Port 8000
Stop-ProcessOnPort -Port 3000
Stop-ProcessOnPort -Port 5173
Write-Host ""

# Step 2: Clear Python cache (to ensure fresh code)
Write-Host "Step 2: Clearing Python cache..." -ForegroundColor Yellow
$cacheDirs = Get-ChildItem -Path . -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue
$pycFiles = Get-ChildItem -Path . -Recurse -Filter "*.pyc" -ErrorAction SilentlyContinue

if ($cacheDirs -or $pycFiles) {
    $cacheDirs | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    $pycFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "  Cleared Python cache" -ForegroundColor Green
} else {
    Write-Host "  No cache files found" -ForegroundColor Gray
}
Write-Host ""

# Step 3: Start Backend Server
Write-Host "Step 3: Starting Backend Server (FastAPI)..." -ForegroundColor Yellow
Write-Host "  Port: 8000" -ForegroundColor Gray
Write-Host "  URL: http://localhost:8000" -ForegroundColor Gray

$backendScript = @"
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"@

$backendScript | Out-File -FilePath "start_backend.ps1" -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", "start_backend.ps1" -WindowStyle Minimized
Start-Sleep -Seconds 3
Write-Host "  Backend server starting..." -ForegroundColor Green
Write-Host ""

# Step 4: Start Frontend Server
Write-Host "Step 4: Starting Frontend Server (Vite)..." -ForegroundColor Yellow
Write-Host "  Port: 3000" -ForegroundColor Gray
Write-Host "  URL: http://localhost:3000" -ForegroundColor Gray

$frontendScript = @"
cd frontend
npm run dev
"@

$frontendScript | Out-File -FilePath "start_frontend.ps1" -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", "start_frontend.ps1" -WindowStyle Minimized
Start-Sleep -Seconds 3
Write-Host "  Frontend server starting..." -ForegroundColor Green
Write-Host ""

# Step 5: Wait and verify
Write-Host "Step 5: Waiting for servers to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Servers Restarted!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend API:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend App: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "API Docs:     http://localhost:8000/docs" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: Server windows are minimized. Check them for any errors." -ForegroundColor Yellow
Write-Host ""





