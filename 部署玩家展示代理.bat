@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Genshin Tool - Deploy Showcase Proxy

set "ROOT=%~dp0"
set "WORKER_DIR=%ROOT%player-showcase-worker"
set "LOG=%ROOT%player-showcase-deploy.log"
> "%LOG%" echo === Showcase proxy deployment log %date% %time% ===

echo.
echo ==========================================
echo   Deploy Player Showcase Proxy (Cloudflare Worker)
echo ==========================================
echo.
call :say "This deploys a public-data cache proxy only. No game cookies are used."
call :say "Full Node.js LTS with npm and npx is required. Codex runtime Node is not enough."
echo.

where node >nul 2>nul
if errorlevel 1 (call :fail "Node.js was not found. Install full Node.js LTS and run again." & exit /b 1)
where npm.cmd >nul 2>nul
if errorlevel 1 (call :fail "npm was not found. The Codex runtime Node cannot deploy Workers." & exit /b 1)
where npx.cmd >nul 2>nul
if errorlevel 1 (call :fail "npx was not found. The Codex runtime Node cannot deploy Workers." & exit /b 1)
if not exist "%WORKER_DIR%\wrangler.toml" (call :fail "player-showcase-worker files were not found." & exit /b 1)

for /f "delims=" %%V in ('node --version') do call :say "Detected Node %%V"
call :say "Checking Cloudflare sign-in. Wrangler output stays in this window for interactive login."
call :say "Summary log: %LOG%"

pushd "%WORKER_DIR%"
call npx.cmd --yes wrangler@latest whoami >nul 2>nul
if errorlevel 1 (
  echo.
  echo Cloudflare sign-in is required. Your browser will open now.
  call :say "Opening interactive Cloudflare sign-in."
  call npx.cmd --yes wrangler@latest login
  if errorlevel 1 (
    popd
    call :fail "Cloudflare sign-in was not completed."
    exit /b 1
  )
)

echo.
echo Deploying Worker...
call :say "Cloudflare sign-in confirmed. Deploying Worker."
call npx.cmd --yes wrangler@latest deploy
set "RESULT=%ERRORLEVEL%"
popd

if not "%RESULT%"=="0" (call :fail "Cloudflare Worker deployment failed. Open player-showcase-deploy.log for details." & exit /b 1)

call :say "Deployment complete. Copy the https://...workers.dev URL shown by Wrangler."
call :say "Paste it into the Player Showcase proxy field in the guide."
echo.
echo Full log saved at:
echo %LOG%
echo.
pause
exit /b 0

:say
echo %~1
>> "%LOG%" echo [%date% %time%] %~1
exit /b 0

:fail
call :say "[ERROR] %~1"
echo.
echo No deployment was made. Full log saved at:
echo %LOG%
echo.
pause
exit /b 1
