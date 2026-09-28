@echo off
rem Push ChainVault to GitHub
rem Usage: double-click, paste your repo URL, done.
cd /d "%~dp0"
echo ============================================
echo  Push ChainVault to GitHub
echo  Create the repo on github.com first (Public)
echo  then paste its URL below.
echo  Example: https://github.com/yourname/chainvault-dapp.git
echo ============================================
set /p REPO=Repo URL:
if "%REPO%"=="" (
  echo No URL entered. Aborted.
  pause
  exit /b
)
git remote remove origin >nul 2>&1
git remote add origin %REPO%
git branch -M main
git push -u origin main
echo.
echo Done. Next: GitHub repo -^> Settings -^> Pages
echo   Source = Deploy from a branch, Branch = main, Folder = / (root)
echo   Your site: https://^<username^>.github.io/^<repo^>/
pause
