# ADAM AI - Robust Server Restart Script
# This script stops and restarts both backend and frontend servers with verification

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ADAM AI - Server Restart Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Call the start script which handles everything
& ".\start_servers.ps1"
