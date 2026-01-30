@echo off
REM MineBench Client - Build Windows Production Installer
REM ====================================================

echo.
echo ========================================
echo MineBench Client - Windows Build Script
echo ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js not found. Please install Node.js first.
    exit /b 1
)

echo [1/3] Building web assets with production configuration...
call npm run build:prod
if %errorlevel% neq 0 (
    echo Error: Build failed
    exit /b 1
)

echo.
echo [2/3] Creating Windows installer...
call npm run dist:win
if %errorlevel% neq 0 (
    echo Error: Installer creation failed
    echo Possible causes:
    echo - Insufficient memory (close other apps and try again)
    echo - NSIS not installed (part of electron-builder)
    exit /b 1
)

echo.
echo ========================================
echo [3/3] Build Complete!
echo ========================================
echo.
echo Installer created in: dist\
echo Look for: MineBench Client 0.4.4.exe
echo.
echo Configuration:
echo - Wallet Auth: https://minebench.cloud/auth
echo - API Base:    https://minebench.cloud/api
echo - Solana RPC:  https://api.mainnet-beta.solana.com
echo.
echo Ready for distribution!
echo.

pause
