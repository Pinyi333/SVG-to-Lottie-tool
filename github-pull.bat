@echo off
title Git Pull Latest

echo ==========================
echo Git Repository Information
echo ==========================

echo.

echo Project:
for %%I in (.) do echo %%~nxI

echo.

echo Branch:
git branch --show-current

echo.

echo Remote:
git remote -v

echo.

set /p CONFIRM=確認拉取最新版本？(Y/N):

if /I not "%CONFIRM%"=="Y" (
    echo Cancel
    pause
    exit /b
)

git pull

echo.
echo Pull Complete!

pause