@echo off
rem Push ChainVault to GitHub
cd /d "%~dp0"
rem Bypass local proxy (it returns 502 for github.com)
set "http_proxy="
set "https_proxy="
set "HTTP_PROXY="
set "HTTPS_PROXY="

echo ============================================
echo  Push ChainVault to GitHub
echo  Repo: https://github.com/Gui-su/chainvault-dapp.git
echo  A GitHub login window will pop up on first run.
echo ============================================

git remote remove origin >nul 2>&1
git remote add origin https://github.com/Gui-su/chainvault-dapp.git
git branch -M main
git push -u origin main

if errorlevel 1 (
  echo.
  echo Push FAILED. Check your login window / network, then run this again.
) else (
  echo.
  echo Push OK! Next step:
  echo   GitHub repo -^> Settings -^> Pages
  echo   Source = Deploy from a branch, Branch = main, Folder = / (root) -^> Save
  echo   Your site: https://gui-su.github.io/chainvault-dapp/
)
pause
