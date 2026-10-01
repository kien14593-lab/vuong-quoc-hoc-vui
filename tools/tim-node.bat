@echo off
rem Tim Node.js (va cai thu vien lan dau). Dung chung cho cac tep .bat o thu muc goc.
where node >nul 2>nul
if not errorlevel 1 goto :thuvien
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node >nul 2>nul
if not errorlevel 1 goto :thuvien
echo.
echo   Chua co Node.js tren may nay.
echo   Hay tai ban LTS tai https://nodejs.org , cai dat, roi chay lai tep nay.
echo.
exit /b 1

:thuvien
if exist "%~dp0..\node_modules\vite\package.json" exit /b 0
echo   Dang cai thu vien lan dau - can Internet, mat khoang 1-3 phut...
pushd "%~dp0.."
call npm install --no-audit --no-fund
set "KQ=%errorlevel%"
popd
if not "%KQ%"=="0" (
  echo   Cai thu vien that bai. Kiem tra ket noi Internet roi thu lai.
  exit /b 1
)
exit /b 0
