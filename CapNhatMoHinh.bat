@echo off
rem Cap nhat mo hinh AI: doc cac tep .glb trong thu muc mo-hinh-ai, toi uu, dua vao tro choi.
rem Huong dan: HUONG-DAN-MO-HINH-AI.md
chcp 65001 >nul
cd /d "%~dp0"
title Cap nhat mo hinh AI - Vuong Quoc Hoc Vui

call "%~dp0tools\tim-node.bat"
if errorlevel 1 goto :loi

node tools\xu-ly-mo-hinh.mjs %*
if errorlevel 1 goto :loi

echo.
choice /c CK /n /m "Dong goi lai tro choi ngay bay gio de thay mo hinh moi? [C = Co / K = Khong] "
if errorlevel 2 goto :het
call "%~dp0DongGoi.bat" --khong-dung
goto :het

:loi
echo.
echo Co loi - hay doc thong bao o tren, sua roi chay lai.
:het
echo.
pause
