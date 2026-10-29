@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 原神圖鑒 - 重建與檢查
echo 改完 tools 裡的設定檔後，跑這個重新產生資料。
echo.
node tools/build-equip.js
node tools/build-data.js
echo.
echo 檢查配裝資料...
node tools/validate.js
echo.
echo 按任意鍵關閉視窗...
pause >nul
