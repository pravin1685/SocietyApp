@echo off
title Central Park Society App
echo ========================================
echo    Central Park Society Management
echo ========================================
echo.

echo Starting Backend Server (Port 5000)...
start "Backend - Society App" cmd /k "cd /d "%~dp0backend" && node server.js"

timeout /t 2 /nobreak >nul

echo Starting Frontend (Port 5173)...
start "Frontend - Society App" cmd /k "cd /d "%~dp0frontend2" && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo  App is starting...
echo  Open your browser at:
echo  http://localhost:5173
echo.
echo  Admin Login:  admin / admin@123
echo  User Login:   flat01 / flat01@123
echo ========================================
echo.
start http://localhost:5173

pause
