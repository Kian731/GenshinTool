@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 原神圖鑒 - 只更新資料（不下載圖片，比較快）
node tools/update.js --skip-images
echo.
echo 按任意鍵關閉視窗...
pause >nul
