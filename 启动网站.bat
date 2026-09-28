@echo off
rem ChainVault local dev server launcher
rem Double-click this file to start the site and open the browser.
cd /d "%~dp0"
echo ============================================
echo  ChainVault dev server starting...
echo  URL: http://localhost:8123/index.html
echo  (Close this window to stop the server)
echo ============================================
start "" "http://localhost:8123/index.html"
"C:\Users\lenovo\.workbuddy\binaries\python\versions\3.13.12\python.exe" server.py
pause
