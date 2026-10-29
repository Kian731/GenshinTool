@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Genshin Tool GitHub Publisher

set "SOURCE=%~dp0"
set "REMOTE=https://github.com/Kian731/GenshinTool.git"
set "PUBLISH_HOME=%SOURCE%.publish-cache"
set "CHECKOUT=%PUBLISH_HOME%\GenshinTool"
set "LOG=%SOURCE%github-publish.log"
> "%LOG%" echo === GitHub publish log %date% %time% ===

echo.
echo ==========================================
echo   Genshin Tool GitHub Publisher
echo ==========================================
echo.
call :say "This publishes the guide files only. Private handoff files are excluded."
call :say "Git and GitHub CLI are required. GitHub sign-in opens in a browser when needed."

where git >nul 2>nul
if errorlevel 1 (call :fail "Git for Windows was not found." & exit /b 1)
where gh >nul 2>nul
if errorlevel 1 (call :fail "GitHub CLI was not found." & exit /b 1)

rem Verify the token itself, not only the locally stored login record.
gh api user >nul 2>nul
if errorlevel 1 (
  echo.
  echo GitHub sign-in is required. Your browser will open now.
  call :say "Opening interactive GitHub sign-in."
  gh auth login -h github.com -p https -w
  if errorlevel 1 (call :fail "GitHub sign-in was not completed. Nothing was uploaded." & exit /b 1)
)

if not exist "%PUBLISH_HOME%" mkdir "%PUBLISH_HOME%"

if not exist "%CHECKOUT%\.git" (
  echo.
  echo Downloading the GitHub repository for the first time...
  call :say "Cloning the GitHub repository."
  git clone "%REMOTE%" "%CHECKOUT%" 2>> "%LOG%"
  if errorlevel 1 (call :fail "Repository clone failed. Check the repository URL, network, and permissions." & exit /b 1)
) else (
  echo.
  echo Getting the latest GitHub version...
  call :say "Fetching and fast-forwarding the local publishing checkout."
  git -C "%CHECKOUT%" fetch origin 2>> "%LOG%"
  if errorlevel 1 (call :fail "Fetching the GitHub repository failed." & exit /b 1)
  git -C "%CHECKOUT%" pull --ff-only 2>> "%LOG%"
  if errorlevel 1 (call :fail "The publishing checkout cannot fast-forward. Resolve its Git state before retrying." & exit /b 1)
)

echo.
echo Syncing guide files...
call :say "Copying the selected guide files into the publishing checkout."
set "GSTOOL_PUBLISH_SOURCE=%SOURCE%"
set "GSTOOL_PUBLISH_DESTINATION=%CHECKOUT%"
call :say "Source: %GSTOOL_PUBLISH_SOURCE%"
call :say "Destination: %GSTOOL_PUBLISH_DESTINATION%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SOURCE%Publish-Files.ps1" 2>> "%LOG%"
if errorlevel 1 (call :fail "Copying source files failed. Nothing was committed or pushed." & exit /b 1)

git -C "%CHECKOUT%" add --all 2>> "%LOG%"
if errorlevel 1 (
  git -C "%CHECKOUT%" status --short >> "%LOG%" 2>&1
  call :fail "Git could not stage the synchronized files. Details were added to the log."
  exit /b 1
)

git -C "%CHECKOUT%" diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo No files need to be uploaded.
  call :say "No source changes were detected."
  goto :done
)

for /f "delims=" %%B in ('git -C "%CHECKOUT%" branch --show-current') do set "BRANCH=%%B"
if "%BRANCH%"=="" set "BRANCH=main"

git -C "%CHECKOUT%" commit -m "Publish Genshin Tool" 2>> "%LOG%"
if errorlevel 1 (call :fail "Git commit failed. Check Git author configuration and repository state." & exit /b 1)

echo.
echo Pushing to GitHub...
call :say "Pushing the new commit to GitHub."
git -C "%CHECKOUT%" push origin "%BRANCH%" 2>> "%LOG%"
if errorlevel 1 (call :fail "GitHub push failed. Check repository permission and network." & exit /b 1)

call :say "Upload completed: https://github.com/Kian731/GenshinTool"
goto :done

:fail
call :say "[ERROR] %~1"
echo.
echo Nothing was pushed after this error. Full summary log saved at:
echo %LOG%
echo.
pause
exit /b 1

:done
echo.
echo Full summary log saved at:
echo %LOG%
echo.
pause
exit /b 0

:say
echo %~1
>> "%LOG%" echo [%date% %time%] %~1
exit /b 0
