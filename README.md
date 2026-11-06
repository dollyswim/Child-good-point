# 親子集點（Child-good-point）

親子集點養成冒險 App。完整規格見 [PROJECT_SPEC.md](PROJECT_SPEC.md)。

目前進度：**Phase 1｜生活積分核心系統** ✅

## 使用方式

純 HTML / CSS / JavaScript，不需要建置。

- 直接以瀏覽器開啟 `index.html` 即可使用。
- 或啟動本機伺服器（可啟用 PWA 離線與「加到主畫面」）：`npm start` 後開啟 http://localhost:8080
- 也可直接部署到 GitHub Pages 等靜態網站空間。

資料儲存在瀏覽器 `localStorage`（鍵名 `cgp-data`），可在「設定 → 備份」匯出／匯入 JSON。

## 專案結構

```
index.html            入口
css/style.css         樣式（mobile-first）
js/store.js           資料層：資料模型、計分規則、遷移、備份（可於 Node 測試）
js/app.js             介面層：首頁、孩子計分頁、設定頁
sw.js                 Service Worker（離線快取）
manifest.webmanifest  PWA 設定
tests/store.test.js   資料層單元測試
tests/e2e.js          手機尺寸端對端測試（Playwright）
```

## 資料模型（schemaVersion 1）

- 總點數 = 起始點數 + 所有紀錄點數（不另存，避免不同步）
- 今日淨得分 = 今日加分 + 扣分 + 任務；**不含**起始點數與兌換獎勵
- 扣分、兌換以負數保存
- 任務完成狀態由紀錄推導，每個孩子各自獨立
- 未來修改資料模型時，遞增 `SCHEMA_VERSION` 並在 `migrate()` 加入遷移步驟

## 測試

```
npm test          # 單元測試
npm run test:e2e  # 端對端測試（需 Playwright + Chromium）
```
