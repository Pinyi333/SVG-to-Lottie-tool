@echo off
title GitHub Update Commit

echo ==============================
echo     GitHub Update Commit
echo ==============================
echo.

:: 檢查 Git
git --version >nul 2>&1
if errorlevel 1 (
    echo Git 未安裝！
    pause
    exit /b
)

:: 檢查是否為 Git 專案
if not exist ".git" (
    echo 目前不是 Git Repository！
    echo 請先執行初始化。
    pause
    exit /b
)

echo.

:: 查看修改
echo [Changes]
git status

echo.

:: Commit 訊息
set /p COMMIT_MSG=Commit Message：

if "%COMMIT_MSG%"=="" (
    set COMMIT_MSG=Update project
)

echo.

echo Adding files...
git add .

echo.

echo Commit...
git commit -m "%COMMIT_MSG%"

echo.

echo Push...
git push

echo.

echo ==============================
echo        Push Complete!
echo ==============================

pause