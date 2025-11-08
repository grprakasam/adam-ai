# ADAM AI Backend Setup Script
# This script sets up the backend environment and installs dependencies

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ADAM AI Backend Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to project root
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Project Root: $projectRoot" -ForegroundColor Yellow
Write-Host ""

# Check Python version
Write-Host "[1/6] Checking Python version..." -ForegroundColor Green
$pythonPath = ".\prakenv\Scripts\python.exe"
if (Test-Path $pythonPath) {
    $pythonVersion = & $pythonPath --version
    Write-Host "  [OK] Python found: $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Virtual environment not found!" -ForegroundColor Red
    Write-Host "  Please create virtual environment first:" -ForegroundColor Yellow
    Write-Host "    python -m venv prakenv" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Upgrade pip
Write-Host "[2/6] Upgrading pip..." -ForegroundColor Green
& $pythonPath -m pip install --upgrade pip --quiet
Write-Host "  [OK] pip upgraded" -ForegroundColor Green
Write-Host ""

# Install dependencies
Write-Host "[3/6] Installing backend dependencies..." -ForegroundColor Green
Write-Host "  This may take several minutes..." -ForegroundColor Yellow
& $pythonPath -m pip install -r backend\requirements.txt
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Error installing dependencies" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Create .env file
Write-Host "[4/6] Setting up environment file..." -ForegroundColor Green
$envExample = "backend\.env.example"
$envFile = "backend\.env"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "  [OK] Created .env file from template" -ForegroundColor Green
    Write-Host "  [WARNING] Remember to add your API keys to backend\.env" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] .env file already exists" -ForegroundColor Green
}
Write-Host ""

# Create logs directory
Write-Host "[5/6] Creating logs directory..." -ForegroundColor Green
$logsDir = "backend\logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
    Write-Host "  [OK] Logs directory created" -ForegroundColor Green
} else {
    Write-Host "  [OK] Logs directory already exists" -ForegroundColor Green
}
Write-Host ""

# Verify installation
Write-Host "[6/6] Verifying installation..." -ForegroundColor Green
$verifyScript = @'
import sys
try:
    import fastapi
    import uvicorn
    import pydantic
    import openai
    import anthropic
    import google.generativeai
    print("All core packages imported successfully")
    sys.exit(0)
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)
'@

$verifyResult = & $pythonPath -c $verifyScript
if ($LASTEXITCODE -eq 0) {
    Write-Host "  $verifyResult" -ForegroundColor Green
} else {
    Write-Host "  $verifyResult" -ForegroundColor Red
    Write-Host "  Some packages may not be installed correctly" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit backend\.env and add your LLM API keys" -ForegroundColor White
Write-Host "2. Run the backend server:" -ForegroundColor White
Write-Host "   cd backend" -ForegroundColor Gray
Write-Host "   ..\prakenv\Scripts\python.exe -m uvicorn app.main:app --reload" -ForegroundColor Gray
$apiUrl = "http://localhost:8000/api/docs"
Write-Host "3. Access API docs at: $apiUrl" -ForegroundColor White
Write-Host ""
