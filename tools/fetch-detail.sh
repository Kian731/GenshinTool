#!/bin/bash
# 下載每位角色的完整天賦／命座資料（已存在會跳過，可重複執行）
set -u
cd "$(dirname "$0")/.."
mkdir -p data/_raw/detail
node -e 'const D=require("./data/characters.json");process.stdout.write([...new Set(D.map(c=>c.id))].join("\n")+"\n")' > data/_raw/ids.txt
n=0; s=0
while read -r id; do
  [ -z "$id" ] && continue
  f="data/_raw/detail/$id.json"
  if [ -s "$f" ]; then s=$((s+1)); continue; fi
  if curl -s -f --max-time 60 -A "Mozilla/5.0" "https://gi.yatta.moe/api/v2/cht/avatar/$id" -o "$f"; then
    n=$((n+1))
  else
    rm -f "$f"; echo "  ! 失敗 $id"
  fi
done < data/_raw/ids.txt
echo "天賦資料：新增 $n 筆，略過 $s 筆"
