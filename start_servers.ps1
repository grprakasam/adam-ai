# ADAM AI - Robust Server Startup Script
# This script ensures both backend and frontend servers start properly

param(
    [switch]$SkipChecks = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ADAM AI - Server Startup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Get the script directory (project root)
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$scriptDir = Resolve-Path $scriptDir
Set-Location $scriptDir
Write-Host "Working directory: $scriptDir" -ForegroundColor Gray
Write-Host ""

# Function to kill ALL processes on a specific port (more robust)
function Stop-ProcessOnPort {
    param([int]$Port)
    
    $attempts = 0
    $maxAttempts = 3
    
    do {
        $attempts++
        $found = $false
        
        # Get all connections on the port
        $connections = netstat -ano | Select-String ":$Port\s" | ForEach-Object {
            $line = $_.Line.Trim()
            $parts = $line -split '\s+'
            if ($parts.Length -ge 5) {
                $processId = $parts[-1]
                if ($processId -match '^\d+$') {
                    $processId
                }
            }
        }
        
        $uniquePids = $connections | Sort-Object -Unique
        
        foreach ($processId in $uniquePids) {
            try {
                $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "  Stopping process: $($proc.ProcessName) (PID: $processId)" -ForegroundColor Yellow
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    $found = $true
                    Start-Sleep -Milliseconds 500
                }
            } catch {
                # Process might already be gone
            }
        }
        
        if ($found) {
            Start-Sleep -Seconds 1
        }
    } while ($found -and $attempts -lt $maxAttempts)
    
    # Final check
    $remaining = netstat -ano | Select-String ":$Port\s"
    if ($remaining) {
        Write-Host "  Warning: Some processes may still be using port $Port" -ForegroundColor Yellow
    } else {
        Write-Host "  Port $Port is now free" -ForegroundColor Green
    }
}

# Function to verify server is responding
function Test-ServerHealth {
    param(
        [string]$Url,
        [int]$MaxAttempts = 10,
        [int]$DelaySeconds = 2
    )
    
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                return $true
            }
        } catch {
            if ($i -lt $MaxAttempts) {
                Write-Host "  Attempt ${i} of ${MaxAttempts}: Waiting for server..." -ForegroundColor Gray
                Start-Sleep -Seconds $DelaySeconds
            }
        }
    }
    return $false
}

# Step 1: Stop existing servers
Write-Host "Step 1: Stopping existing servers..." -ForegroundColor Yellow
Stop-ProcessOnPort -Port 8000
Stop-ProcessOnPort -Port 3000
Stop-ProcessOnPort -Port 5173
Start-Sleep -Seconds 2
Write-Host ""

if (-not $SkipChecks) {
    # Step 2: Check Python virtual environment
    Write-Host "Step 2: Checking Python environment..." -ForegroundColor Yellow
    $pythonPath = Join-Path $scriptDir "prakenv\Scripts\python.exe"
    if (-not (Test-Path $pythonPath)) {
        Write-Host "  [ERROR] Python virtual environment not found at: $pythonPath" -ForegroundColor Red
        Write-Host "  Please create it first: python -m venv prakenv" -ForegroundColor Yellow
        exit 1
    }
    
    $pythonVersion = & $pythonPath --version 2>&1
    Write-Host "  [OK] Python found: $pythonVersion" -ForegroundColor Green
    
    # Check if uvicorn is installed
    $uvicornCheck = & $pythonPath -m pip show uvicorn 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [WARNING] uvicorn not found. Installing dependencies..." -ForegroundColor Yellow
        $requirementsPath = Join-Path $scriptDir "backend\requirements.txt"
        & $pythonPath -m pip install -r $requirementsPath --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [ERROR] Failed to install dependencies" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  [OK] Backend dependencies installed" -ForegroundColor Green
    }
    Write-Host ""
    
    # Step 3: Check Node.js and frontend dependencies
    Write-Host "Step 3: Checking Node.js environment..." -ForegroundColor Yellow
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Node.js not found. Please install Node.js 18+" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] Node.js found: $nodeVersion" -ForegroundColor Green
    
    $nodeModulesPath = Join-Path $scriptDir "frontend\node_modules"
    if (-not (Test-Path $nodeModulesPath)) {
        Write-Host "  [WARNING] node_modules not found. Installing dependencies..." -ForegroundColor Yellow
        $frontendDir = Join-Path $scriptDir "frontend"
        Push-Location $frontendDir
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [ERROR] Failed to install frontend dependencies" -ForegroundColor Red
            Pop-Location
            exit 1
        }
        Pop-Location
        Write-Host "  [OK] Frontend dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "  [OK] Frontend dependencies found" -ForegroundColor Green
    }
    Write-Host ""
}

# Step 4: Clear Python cache
Write-Host "Step 4: Clearing Python cache..." -ForegroundColor Yellow
$backendDir = Join-Path $scriptDir "backend"
$cacheDirs = Get-ChildItem -Path $backendDir -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue
$pycFiles = Get-ChildItem -Path $backendDir -Recurse -Filter "*.pyc" -ErrorAction SilentlyContinue

if ($cacheDirs -or $pycFiles) {
    $cacheDirs | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    $pycFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Cleared Python cache" -ForegroundColor Green
} else {
    Write-Host "  [OK] No cache files found" -ForegroundColor Gray
}
Write-Host ""

# Step 5: Start Backend Server
Write-Host "Step 5: Starting Backend Server (FastAPI)..." -ForegroundColor Yellow
Write-Host "  Port: 8000" -ForegroundColor Gray
Write-Host "  URL: http://localhost:8000" -ForegroundColor Gray

$backendScriptPath = Join-Path $scriptDir "start_backend.ps1"
$backendDir = Join-Path $scriptDir "backend"
$pythonExe = Join-Path $scriptDir "prakenv\Scripts\python.exe"

$backendScript = @"
`$ErrorActionPreference = 'Continue'
cd `"$backendDir`"
& `"$pythonExe`" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"@

$backendScript | Out-File -FilePath $backendScriptPath -Encoding UTF8 -Force
Start-Process powershell -ArgumentList "-NoExit", "-File", "`"$backendScriptPath`"" -WindowStyle Normal
Start-Sleep -Seconds 4

# Verify backend is starting
Write-Host "  Verifying backend server..." -ForegroundColor Gray
if (Test-ServerHealth -Url "http://localhost:8000/" -MaxAttempts 15 -DelaySeconds 2) {
    Write-Host "  [OK] Backend server is responding!" -ForegroundColor Green
} else {
    Write-Host "  [WARNING] Backend server may not be ready yet. Check the server window for errors." -ForegroundColor Yellow
}
Write-Host ""

# Step 6: Start Frontend Server
Write-Host "Step 6: Starting Frontend Server (Vite)..." -ForegroundColor Yellow
Write-Host "  Port: 3000" -ForegroundColor Gray
Write-Host "  URL: http://localhost:3000" -ForegroundColor Gray

$frontendScriptPath = Join-Path $scriptDir "start_frontend.ps1"
$frontendDir = Join-Path $scriptDir "frontend"

$frontendScript = @"
`$ErrorActionPreference = 'Continue'
cd `"$frontendDir`"
npm run dev
"@

$frontendScript | Out-File -FilePath $frontendScriptPath -Encoding UTF8 -Force
Start-Process powershell -ArgumentList "-NoExit", "-File", "`"$frontendScriptPath`"" -WindowStyle Normal
Start-Sleep -Seconds 5

# Verify frontend is starting
Write-Host "  Verifying frontend server..." -ForegroundColor Gray
if (Test-ServerHealth -Url "http://localhost:3000/" -MaxAttempts 20 -DelaySeconds 2) {
    Write-Host "  [OK] Frontend server is responding!" -ForegroundColor Green
} else {
    Write-Host "  [WARNING] Frontend server may not be ready yet. Check the server window for errors." -ForegroundColor Yellow
}
Write-Host ""

# Final summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Servers Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend API:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "  - API Docs: http://localhost:8000/api/docs" -ForegroundColor Gray
Write-Host "  - Health:   http://localhost:8000/health" -ForegroundColor Gray
Write-Host ""
Write-Host "Frontend App: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Server windows are open. Check them for any errors." -ForegroundColor Yellow
Write-Host "If servers don't respond, check the PowerShell windows for error messages." -ForegroundColor Yellow
Write-Host ""

