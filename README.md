# 旅遊行程（hokkaido-app）

離線可用的旅遊 PWA：行程、景點、匯率、記帳、行李清單、相簿連結、票夾。
線上版：<https://whalechao.github.io/hokkaido-app/>（GitHub Pages，`gh-pages` 分支放建置成品，原始碼在 `main`）。

沒有帳號、沒有伺服器、沒有任何 API 金鑰。所有資料只存在使用者自己手機瀏覽器的 IndexedDB。

## 功能與資料存放

| 功能 | 資料位置 | 外部服務（皆免金鑰） | 離線時 |
| --- | --- | --- | --- |
| 行程庫、每日行程、景點 | IndexedDB `hokkaido_app`（`config` / `itinerary`） | 無 | 完整可用 |
| 景點背景圖 | 不儲存（瀏覽器與 Service Worker 快取圖片） | 維基百科（傳景點名稱） | 看過的圖仍在，沒有就不顯示 |
| 每日天氣與穿著建議 | `localStorage`（預報快取） | Open-Meteo（傳主要地點文字） | 顯示上次存下的預報並標示 |
| 匯率、換算 | `localStorage` `hokkaido_exchange_rates` | ExchangeRate-API（只下載公開匯率表） | 使用舊匯率並警告；沒有任何匯率時不顯示估算值 |
| 記帳 | IndexedDB `expenses` | 無 | 完整可用 |
| 行李清單、海關提醒 | IndexedDB `checklists`；海關規則隨 App 打包 | 無 | 完整可用 |
| 相簿 | IndexedDB `albums`（只存連結） | 無（點了才開啟連結） | 可看連結，開啟需網路 |
| 票夾 | IndexedDB `tickets`（含 Blob 圖片，私密 QR 永遠不匯出） | 無 | 完整可用 |
| 分享行程 | 產生一串文字碼（base64，非加密） | 無 | 完整可用 |
| 完整備份／還原 | 使用者自選的 JSON 檔 | 無 | 完整可用 |

**儲存庫名稱與鍵名（`hokkaido_app`、`config`、`itinerary`、`tickets`、`expenses`、`checklists`、`albums`、`<tripId>_app_config` …）不得更動**，否則使用者手機上的既有資料會「消失」。`src/compat.test.tsx` 與 `e2e/migration.mjs` 會擋下這類修改。新增欄位一律是「選填」，舊資料沒有也能讀。

## 開發

```sh
npm install
npm run dev          # http://localhost:5173/hokkaido-app/
npm run lint
npm run typecheck
npm test             # 規則檔檢查 + 單元／元件／相容性測試（vitest）
npm run build        # tsc -b && vite build，產生 dist/（含 Service Worker）
npm run e2e          # 需要先 build；用本機 Google Chrome 跑端對端冒煙測試
node e2e/migration.mjs   # 升級相容性：舊版寫入的資料，新版必須完整讀得出來
SHOT_DIR=./shots npm run e2e   # 同時輸出各頁面淺色／深色、手機／桌面截圖
```

## 發布

```sh
npm run deploy       # 先跑 lint + 測試 + build，再把 dist/ 強制推到 gh-pages 分支
```

Service Worker 的更新策略是「新版下載好後，畫面下方出現提示，使用者按『立即更新』才切換」，
並且每小時與每次回到 App 時檢查更新，不會永遠卡在舊版。設定頁也有「檢查 App 更新」。

## 海關提醒

`public/prohibited_rules.json` 是人工整理的簡短提醒，**不是自動更新的，也未逐條對照官方公告驗證**。
App 內會顯示免責說明與官方網站連結。修改後請更新 `last_reviewed`，並執行 `npm run validate:rules`。
（舊版的「每週自動更新」排程只是把寫死在腳本裡的同一份文字重寫一遍，並沒有查詢任何來源，已移除。）

## 設計

設計 tokens 在 `src/styles/tokens.css`，與個人網站同一套：紙色底、墨藍字、黃銅點綴、明體標題。
自動跟隨系統深淺色，也可在設定頁手動指定。字體使用系統字體堆疊（不載入外部字體，離線也一致）。
