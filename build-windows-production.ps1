# MineBench Client - Build Windows Production Installer
# ====================================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MineBench Client - Windows Build Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
    Write-Host "Error: Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Step 1: Build
Write-Host "[1/3] Building web assets with production configuration..." -ForegroundColor Yellow
npm run build:prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Create Installer
Write-Host "[2/3] Creating Windows installer..." -ForegroundColor Yellow
npm run dist:win

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Installer creation failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible causes:" -ForegroundColor Yellow
    Write-Host "  - Insufficient memory (close other apps and try again)" -ForegroundColor Yellow
    Write-Host "  - NSIS not installed (part of electron-builder)" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "[3/3] Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Installer location: " -ForegroundColor Cyan -NoNewline
Write-Host "dist\" -ForegroundColor Green

Write-Host "Installer filename: " -ForegroundColor Cyan -NoNewline
Write-Host "MineBench Client 0.4.4.exe" -ForegroundColor Green

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Wallet Auth: https://minebench.cloud/auth" -ForegroundColor Green
Write-Host "  API Base:    https://minebench.cloud/api" -ForegroundColor Green
Write-Host "  Solana RPC:  https://api.mainnet-beta.solana.com" -ForegroundColor Green

Write-Host ""
Write-Host "Ready for distribution!" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"
