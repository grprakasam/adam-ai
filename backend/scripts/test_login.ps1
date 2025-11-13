# Test login endpoint
$body = 'username=admin&password=admin'
$headers = @{
    'Content-Type' = 'application/x-www-form-urlencoded'
}

Write-Host "Testing login endpoint..." -ForegroundColor Cyan
$response = Invoke-WebRequest -Uri http://localhost:8000/api/v1/auth/login -Method POST -Body $body -ContentType 'application/x-www-form-urlencoded'

Write-Host "`nStatus Code: $($response.StatusCode)" -ForegroundColor Green
Write-Host "Response:" -ForegroundColor Green
$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
