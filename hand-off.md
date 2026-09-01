# Hand-off 交接文件

> 本檔案用於記錄專案即時進度與待辦事項。**有新進度請隨時更新此檔。**
> 最後更新：2026-09-01（Path morph、Hover、Scroll 觸發已完成）

## 專案是什麼

**SVGMotion** — 把靜態 SVG 圖示變成動畫，並匯出為 **Lottie JSON / CSS / 獨立 SVG / React / Vue 元件**。
所有解析、動畫、匯出皆在本機完成，不上傳任何檔案。

- 線上版：https://pinyi333.github.io/SVG-to-Lottie-tool/
- npm 套件：`svgmotion`（框架無關、無 UI 依賴的 TypeScript 函式庫）

## 架構（pnpm monorepo，Node >= 20）

| 位置 | 內容 |
| --- | --- |
| `packages/core/` | `svgmotion` 核心：SVG 解析（sanitize + 幾何正規化）、easing / preset / timeline、Lottie / CSS / SVG / React / Vue exporter |
| `apps/web/` | React 網頁前端：**Animate** 工作區（上傳 SVG → 選效果 → 預覽 → 匯出）與 **Lottie Playground**（調整 Lottie 播放參數、複製嵌入片段），含 i18n |
| `examples/` | 以 build script 方式使用套件的範例 workspace |
| `docs/lottie-mapping.md` | Lottie 對應關係參考文件 |
| `.github/` | CI workflows、issue templates |

常用指令：`pnpm dev`（開發）、`pnpm build`、`pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm test:e2e`

## 目前進度（依 git 歷史）

- ✅ core：SVG 解析管線、easing / preset / timeline 層
- ✅ core：CSS、獨立 SVG、Lottie（含播放驗證）、React、Vue exporter
- ✅ web：Animate 與 Playground 兩個工作區
- ✅ 文件：README（中英）、CONTRIBUTING、Lottie mapping 參考
- ✅ CI：workflows、issue templates、web 單元測試
- ✅ examples workspace
- ✅ `95fc935` 新增 GitHub 操作工具腳本（`github-init.bat`、`github-pull.bat`、`update-github.bat`）
- ✅ **Path morph 效果（issue #1）完成，尚未 commit**（2026-09-01）：
  - core：新增 `morph` preset（`params.toPath` 指定目標路徑）＋ `morphProgress` channel
  - 新模組 `packages/core/src/parse/morph.ts`：de Casteljau 細分對齊兩條路徑的段數、線性插值；子路徑數不符時發出 `morph-mismatch` 警告而非亂配
  - CSS exporter 輸出 `d: path()` keyframes（SVG / React / Vue 匯出自動繼承）
  - Lottie exporter 輸出原生 shape keyframes（`sh` item 動畫化，頂點數恆定）
  - Web UI：Animate 面板新增「路徑變形」選項與目標路徑輸入框（中英 i18n 已加）
  - 測試：新增 `packages/core/test/morph.test.ts` 13 個測試；全套 140/140 通過，typecheck / eslint 乾淨
  - 文件：README（中英）、packages/core/README、CHANGELOG（Unreleased）已更新

- ✅ `5e9f3e2` **Path morph 已 commit**（含 golden 快照修正：morph 有給 `toPath` 的合理基準）
- ✅ `c86484d` **Hover 觸發已 commit**（2026-09-01，全套 146/146 測試通過）：
  - core：`Track.trigger?: 'auto' | 'hover'`（新型別 `TrackTrigger`，預設 auto，舊 spec 相容）
  - CSS：hover tracks 的 animation 掛在 `.svgm-icon:hover .svgm-<id>` 規則下；有 hover 時根 `<svg>` 加 `svgm-icon` class；hover 規則會重列 always-on 動畫避免 `animation` 覆蓋
  - Lottie：hover tracks 在 resolve 前被剔除並發 `lottie-unsupported` 警告（不影響時間軸與 loop 判定）
  - Web UI：Animate 面板新增「播放時機」選單（載入時／滑鼠懸停時），中英 i18n
  - 測試：新增 `packages/core/test/hover.test.ts` 6 個測試
- ✅ `f314555` **Scroll 觸發已 commit**（2026-09-01，全套 150/150 測試通過）：
  - core：`TrackTrigger` 擴充為 `'auto' | 'hover' | 'scroll'`
  - CSS：scroll tracks 用 `animation-timeline: view()` 隨捲動推進；混用時逐項配對 timeline（`auto, view()`）；不支援的瀏覽器自動退回直接播放
  - Lottie：hover/scroll 一併剔除＋警告；獨立 SVG 匯出對 scroll 發 `trigger-unsupported` 警告（`<img>` 內無捲動上下文）
  - Web UI：「播放時機」加入「捲動時」選項

## 效果 × 匯出格式支援現況

**README 支援表已全部落地**：七種效果（Stroke draw / Fade / Scale / Rotate / Bounce / Loop / Path morph）五種格式全支援；Hover 與 Scroll 以 `trigger` 落地於 CSS/React/Vue（Lottie 本質上無法表達，匯出時明確警告）。

## 待辦事項（Next steps）

### 功能
- [x] **Path morph**：core preset + CSS/SVG/React/Vue/Lottie 匯出 + Web UI + 測試（2026-09-01 完成，待 commit）
- [x] **Hover 效果**：以 `trigger: 'hover'` 落地 CSS/SVG/React/Vue（Lottie 明確警告並剔除）（2026-09-01）
- [x] **Scroll 效果**：以 `trigger: 'scroll'` + `animation-timeline: view()` 落地 CSS/React/Vue（2026-09-01）
- [ ] （可選）Morph 進階：在瀏覽器實測 `d: path()` 各引擎相容性；Playground 加 morph 範例

### 品質 / 維運
- [x] 跑一輪 `pnpm test`、`pnpm typecheck` 確認基準線是綠的（2026-09-01：build ✅、tests 123/123 ✅、typecheck ✅；本機 pnpm 需經 `corepack pnpm` 呼叫）
- [ ] 確認 GitHub Pages 部署與最新 main 同步
- [ ] 評估三個 .bat 腳本是否要納入文件說明（README 目前未提及）

### 文件
- [x] README 支援表格：Path morph 已標為 ✅（中英與 core README）
- [ ] README 支援表格隨後續效果落地即時更新（Hover / Scroll）

## 更新規則

1. 完成任何一項工作後，把上方待辦打勾並在「目前進度」加一行。
2. 更新頁首的「最後更新」日期。
3. 新發現的問題或決策，記在本檔對應段落，不要只留在對話裡。
