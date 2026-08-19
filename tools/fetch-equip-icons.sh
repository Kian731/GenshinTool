#!/bin/bash
# 下載武器／聖遺物／培養素材圖標（已存在會跳過）
set -u
cd "$(dirname "$0")/.."
mkdir -p images/weapon images/artifact images/item
n=0; s=0
while read -r ic; do
  [ -z "$ic" ] && continue
  case "$ic" in
    UI_EquipIcon_*) dir=weapon ;;
    UI_RelicIcon_*) dir=artifact ;;
    *)              dir=item ;;
  esac
  f="images/$dir/$ic.png"
  if [ -s "$f" ]; then s=$((s+1)); continue; fi
  # 聖遺物圖標在 /assets/UI/reliquary/ 底下，其餘在 /assets/UI/
  if [ "$dir" = artifact ]; then url="https://gi.yatta.moe/assets/UI/reliquary/$ic.png"; else url="https://gi.yatta.moe/assets/UI/$ic.png"; fi
  if curl -s -f --max-time 45 -A "Mozilla/5.0" "$url" -o "$f"; then
    n=$((n+1))
  else
    rm -f "$f"; echo "  ! $ic"
  fi
done < data/_build/icon-list.txt
echo "圖標：新增 $n 張，已存在略過 $s 張"
