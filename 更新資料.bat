@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 原神圖鑒 - 資料更新

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [錯誤] 找不到 Node.js
  echo 請先安裝 Node.js： https://nodejs.org/   選 LTS 版本
  echo 安裝完以後重新開啟這個檔案即可。
  echo.
  pause
  exit /b 1
)

node tools/update.js %*

echo.
echo 按任意鍵關閉視窗...
pause >nul
