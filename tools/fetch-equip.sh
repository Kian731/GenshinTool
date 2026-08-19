#!/bin/bash
# 下載所有武器與聖遺物的詳細資料（已存在會跳過）
set -u
cd "$(dirname "$0")/.."
mkdir -p data/_raw/weapon_detail data/_raw/reliquary_detail
node -e 'const w=require("./data/_raw/weapons.json");process.stdout.write(Object.keys(w.data.items).join("\n")+"\n")' > data/_raw/weapon_ids.txt
node -e 'const r=require("./data/_raw/reliquary.json");process.stdout.write(Object.keys(r.data.items).join("\n")+"\n")' > data/_raw/reliquary_ids.txt
n=0
while read -r id; do
  [ -z "$id" ] && continue
  f="data/_raw/weapon_detail/$id.json"
  [ -s "$f" ] && continue
  curl -s -f --max-time 45 -A "Mozilla/5.0" "https://gi.yatta.moe/api/v2/cht/weapon/$id" -o "$f" && n=$((n+1)) || { rm -f "$f"; echo "  ! 武器 $id"; }
done < data/_raw/weapon_ids.txt
m=0
while read -r id; do
  [ -z "$id" ] && continue
  f="data/_raw/reliquary_detail/$id.json"
  [ -s "$f" ] && continue
  curl -s -f --max-time 45 -A "Mozilla/5.0" "https://gi.yatta.moe/api/v2/cht/reliquary/$id" -o "$f" && m=$((m+1)) || { rm -f "$f"; echo "  ! 聖遺物 $id"; }
done < data/_raw/reliquary_ids.txt
echo "武器新增 $n 筆、聖遺物新增 $m 筆"
