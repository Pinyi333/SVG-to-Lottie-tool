@echo off
setlocal EnableDelayedExpansion

title GitHub Project Initializer

echo ======================================
echo      GitHub Project Initializer
echo ======================================
echo.

:: 修改成你的 GitHub 帳號
set GITHUB_USER=pinyi333


:: ==========================
:: Repository Name
:: ==========================

for %%I in (.) do set PROJECT_NAME=%%~nxI

echo Current Project:
echo %PROJECT_NAME%
echo.

set /p REPO_NAME=Repository Name (Enter=使用資料夾名稱):

if "%REPO_NAME%"=="" (
    set REPO_NAME=%PROJECT_NAME%
)


set REPO_URL=https://github.com/%GITHUB_USER%/%REPO_NAME%.git


:: ==========================
:: 建立 .gitignore
:: ==========================

if not exist ".gitignore" (

echo 建立 .gitignore...

(
echo # Dependencies
echo node_modules/

echo.
echo # Build
echo dist/
echo build/

echo.
echo # Environment
echo .env
echo .env.*

echo.
echo # Editor
echo .vscode/
echo .idea/

echo.
echo # Logs
echo *.log

echo.
echo # OS
echo .DS_Store
echo Thumbs.db

echo.
echo # Laravel
echo vendor/
echo storage/*.key

) > .gitignore

) else (

echo .gitignore 已存在，跳過

)


:: ==========================
:: Git Init
:: ==========================

if not exist ".git" (

echo 初始化 Git...

git init

) else (

echo Git 已存在

)


echo.

git add .


echo.

set /p COMMIT_MSG=Commit Message (Enter=Initial commit):

if "%COMMIT_MSG%"=="" (
set COMMIT_MSG=Initial commit
)


git commit -m "%COMMIT_MSG%"


git branch -M main


:: ==========================
:: Remote
:: ==========================

git remote | findstr "^origin$" >nul

if not errorlevel 1 (
    git remote remove origin
)


git remote add origin %REPO_URL%


echo.

echo Push to GitHub...

git push -u origin main


if errorlevel 1 (

echo.
echo ==============================
echo Push Failed
echo ==============================
pause
exit /b

)


echo.
echo ==============================
echo Upload Success!
echo ==============================


start "" https://github.com/%GITHUB_USER%/%REPO_NAME%


pause