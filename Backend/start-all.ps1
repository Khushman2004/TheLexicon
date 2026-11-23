$ErrorActionPreference = "Stop"

$services = @(
    "AuthService",
    "LibraryService",
    "NetworkService",
    "ChatService"
)

$backendPath = $PSScriptRoot

foreach ($service in $services) {
    $servicePath = Join-Path $backendPath $service
    if (-not (Test-Path (Join-Path $servicePath "package.json"))) {
        throw "Cannot find package.json for $service at $servicePath"
    }

    if (-not (Test-Path (Join-Path $servicePath "node_modules"))) {
        throw "Dependencies are missing for $service. Run 'npm install' in $servicePath first."
    }
}

$libraryServicePath = Join-Path $backendPath "LibraryService"
Push-Location $libraryServicePath
try {
    & npm run db:setup
    if ($LASTEXITCODE -ne 0) {
        throw "Database setup failed. Check the SQL Server connection and DB_* environment variables."
    }
}
finally {
    Pop-Location
}

foreach ($service in $services) {
    $servicePath = Join-Path $backendPath $service
    Start-Process -FilePath $env:ComSpec `
        -ArgumentList @("/k", "npm start") `
        -WorkingDirectory $servicePath
}

Write-Host "Started all backend services in separate terminal windows."
Write-Host "Auth:    http://localhost:5000"
Write-Host "Library: http://localhost:5001"
Write-Host "Network: http://localhost:5002"
Write-Host "Chat:    http://localhost:5003"
