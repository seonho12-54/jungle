@echo off
cd /d "%~dp0"
echo Starting Mini React Education Lab server...
echo.
echo Main app:      http://localhost:8000/public/index.html
echo Education lab: http://localhost:8000/education/index.html
echo.
node scripts\serve.js
