@echo off
rem Dong goi tro choi thanh 1 tep HTML duy nhat trong thu muc ban-phat-hanh (choi offline, khong can cai dat).
chcp 65001 >nul
cd /d "%~dp0"
title Dong goi - Vuong Quoc Hoc Vui

call "%~dp0tools\tim-node.bat"
if errorlevel 1 goto :loi

echo.
echo   Dang dong goi tro choi... mat khoang 30 giay.
call npm run build:single --silent
if errorlevel 1 goto :loi
node tools\dong-goi.mjs
if errorlevel 1 goto :loi
if /i "%~1"=="--khong-dung" exit /b 0
echo.
pause
exit /b 0

:loi
echo.
echo   Dong goi that bai - xem thong bao o tren.
if /i "%~1"=="--khong-dung" exit /b 1
pause
exit /b 1
