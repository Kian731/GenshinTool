#!/bin/bash
# 下載 / 補齊所有角色頭像與立繪（已存在的檔案會跳過，可重複執行）
# 用法：在 Git Bash 執行  bash tools/fetch-images.sh
set -u
cd "$(dirname "$0")/.."
BASE="https://gi.yatta.moe/assets/UI"
UA="Mozilla/5.0"
mkdir -p images/icon images/splash

# 從 characters.json 取出所有圖檔名稱
node -e '
const D=require("./data/characters.json");
const s=new Set(D.map(c=>c.頭像.split("/").pop().replace(/\.png$/,"")));
process.stdout.write([...s].join("\n")+"\n");
' > /tmp/gs_icons.txt

n_i=0; n_s=0; skip=0
while read -r short; do
  [ -z "$short" ] && continue
  if [ -s "images/icon/$short.png" ]; then
    skip=$((skip+1))
  elif curl -s -f --max-time 90 -A "$UA" "$BASE/UI_AvatarIcon_$short.png" -o "images/icon/$short.png"; then
    n_i=$((n_i+1)); echo "  + 頭像 $short"
  else
    rm -f "images/icon/$short.png"; echo "  ! 頭像下載失敗 $short"
  fi

  if [ ! -s "images/splash/$short.png" ]; then
    if curl -s -f --max-time 300 -A "$UA" "$BASE/UI_Gacha_AvatarImg_$short.png" -o "images/splash/$short.png"; then
      n_s=$((n_s+1)); echo "  + 立繪 $short"
    else
      # 部分角色（如奇偶）官方沒有抽卡立繪，網頁會自動改用頭像顯示
      rm -f "images/splash/$short.png"; echo "  - 無立繪 $short"
    fi
  fi
done < /tmp/gs_icons.txt

echo "完成：新增頭像 $n_i 張、立繪 $n_s 張，已存在略過 $skip 個角色"
