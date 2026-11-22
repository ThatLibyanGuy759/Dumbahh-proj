@echo off
title LedgerLab - Accounting Workspace
echo ========================================================
echo               LedgerLab Accounting Workspace
echo ========================================================
echo.

set PATH=C:\Program Files\nodejs;C:\Users\AHG\AppData\Roaming\npm;%PATH%

echo [1/2] Starting Flask Backend (port 5000)...
start "LedgerLab Backend" cmd /k "cd /d "%~dp0backend" && (py app.py || python app.py)"

echo [2/2] Starting Vite Frontend (port 5173)...
start "LedgerLab Frontend" cmd /k "cd /d "%~dp0frontend" && pnpm dev --open"

echo.
echo LedgerLab is launching!
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo.
pause
