# 玩家展示資料代理

這個 Cloudflare Worker 讓純靜態圖鑑可安全讀取 Enka.Network 的公開角色展示資料。

- 不使用 HoYoverse 帳號、Cookie 或 API 金鑰。
- 僅接受單一 UID 的 `GET /api/uid/{uid}`。
- 依上游回傳的 `ttl` 快取 60～1800 秒，避免重複查詢與觸發速率限制。

## 部署

先安裝完整 **Node.js LTS**（需包含 `npm`／`npx`；Codex 內建的 Node 執行環境不能用於部署），再在專案根目錄雙擊 `部署玩家展示代理.bat`。第一次會透過 Wrangler 在瀏覽器完成 Cloudflare 登入；不要關閉主控台，登入完成後它會繼續部署。部署完成後，複製終端機顯示的 `https://...workers.dev` 網址。若部署失敗，根目錄的 `player-showcase-deploy.log` 會保留步驟摘要，Wrangler 的詳細錯誤會直接顯示在主控台。

回到圖鑑的「玩家展示」分頁，展開「首次設定」，將該網址貼入「玩家展示資料代理」欄位。網址只會儲存在目前瀏覽器的 localStorage。

Enka.Network 是第三方公開展示資料服務，不是 HoYoverse 官方 API。只有玩家在遊戲內公開「展示角色詳情」的角色才會有完整資料。
