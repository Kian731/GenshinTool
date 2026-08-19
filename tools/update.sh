#!/bin/bash
# 一鍵更新：重抓最新資料 → 補天賦／裝備明細 → 重建所有輸出檔 → 補下載圖片
# 用法：在 Git Bash 執行  bash tools/update.sh
set -eu
cd "$(dirname "$0")/.."

echo "[1/7] 抓取最新角色／武器／聖遺物總表（Project Amber 繁中）…"
curl -s -f --max-time 60 -A "Mozilla/5.0" "https://gi.yatta.moe/api/v2/cht/avatar"     -o data/_raw_yatta_cht.json
curl -s -f --max-time 60 -A "Mozilla/5.0" "https://gi.yatta.moe/api/v2/cht/weapon"     -o data/_raw/weapons.json
curl -s -f --max-time 60 -A "Mozilla/5.0" "https://gi.yatta.moe/api/v2/cht/reliquary"  -o data/_raw/reliquary.json
node -e 'console.log("  角色",Object.keys(require("./data/_raw_yatta_cht.json").data.items).length,
  "／武器",Object.keys(require("./data/_raw/weapons.json").data.items).length,
  "／聖遺物",Object.keys(require("./data/_raw/reliquary.json").data.items).length)'

echo "[2/7] 先用現有分類重建一次，好取得完整角色 id 清單…"
node tools/build-data.js > /dev/null 2>&1 || true

echo "[3/7] 補下載角色天賦／命座明細…"
bash tools/fetch-detail.sh

echo "[4/7] 補下載武器／聖遺物明細…"
bash tools/fetch-equip.sh

echo "[5/7] 更新成長曲線（用來算 Lv90 基礎面板）…"
B="https://raw.githubusercontent.com/DimbreathBot/AnimeGameData/master/ExcelBinOutput"
curl -s -f --max-time 60 -A "Mozilla/5.0" "$B/AvatarCurveExcelConfigData.json" -o data/_raw/avatar_curve.json || echo "  （沿用舊的曲線資料）"
curl -s -f --max-time 60 -A "Mozilla/5.0" "$B/WeaponCurveExcelConfigData.json" -o data/_raw/weapon_curve.json || echo "  （沿用舊的曲線資料）"

echo "[6/7] 重建輸出檔…"
node tools/build-equip.js
node tools/build-data.js

echo "[7/7] 補下載圖片與圖標…"
bash tools/fetch-images.sh
bash tools/fetch-equip-icons.sh

echo
echo "更新完成，重新整理 index.html 即可看到新內容。"
echo "※ 新角色要自己補兩個檔案，補完後再跑一次 node tools/build-data.js："
echo "   tools/roles.js   定位／機制標籤／一句話特色（沒補會顯示「未分類」）"
echo "   tools/builds.js  反應體系／聖遺物／武器／關鍵命座（沒補則配裝頁是空的）"
echo "※ 天賦、命座、技能功能標籤、基礎面板、有效詞條、畢業目標、培養素材都是自動產生的。"
echo "※ 面板計算的假設集中在 tools/build-stats.js 的 ASSUME。"
