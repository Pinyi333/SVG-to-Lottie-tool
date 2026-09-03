# 交接紀錄 Hand-off

> 這份文件記錄專案的**當下真實狀態**，給下一個接手的人（或下一個 session）在三分鐘內進入狀況。
> 每完成一件事就更新，不要等到最後才補。更新規則見文件末尾。

**最後更新：** 2026-09-01 · 狀態對應 commit `a4e5aee`（最後一次改變專案狀態的 commit）

---

## 一句話狀態

核心引擎與網頁工具都已完成並通過測試，**CI 全綠**，v0.2 roadmap 原訂的五項功能**全部做完**（path morph、hover、scroll、漸層、dotLottie），**demo 已經成功部署到 GitHub Pages**。工程面沒有阻塞項了；送 Codex for OSS 申請之前建議先累積使用量與 star。

---

## 這個專案是什麼

**SVGMotion** — 把靜態 SVG 圖示變成動畫，匯出成 Lottie JSON / CSS / 獨立 SVG / React / Vue。
另附一個 Lottie Playground（拖 `.json` 進去調播放參數、產生嵌入碼）。

**做這個的目的**：申請 OpenAI 的 **Codex for Open Source**，通過可得 6 個月免費 ChatGPT Pro。
評分看四項：repo 使用量、生態系重要性、活躍維護證據、申請人的實際維護者角色。

---

## 目前狀態總覽

| 項目                                                        | 狀態                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 核心套件 `svgmotion`                                        | ✅ 完成，179 個測試通過                                                                              |
| 網頁 App（Animate + Playground）                            | ✅ 完成，17 個單元測試 + 11 個 e2e 測試通過                                                          |
| v0.2 功能（morph／hover／scroll／漸層／dotLottie）          | ✅ 五項全部完成                                                                                      |
| 文件（README 中英、CONTRIBUTING、SECURITY、CoC、CHANGELOG） | ✅ 完成                                                                                              |
| CI（lint / format / typecheck / test / build / e2e）        | ✅ **全綠**（PR #1 上 Node 20／22 都過）                                                             |
| PR #1（morph／hover／scroll／漸層／dotLottie）              | ✅ 已合併進 `main`（`aa1ba8d`）                                                                      |
| GitHub Pages demo                                           | 🟡 Pages 已啟用，`build` job 過了；`deploy` job 被 environment 規則擋（見下）                        |
| 預設分支                                                    | ⚠️ 還是 `claude/codex-oss-project-coq6cn`，建議改成 `main`（已不再阻塞部署，但 repo 首頁顯示的是它） |
| npm 發佈 `v0.1.0`                                           | ⬜ 未開始（需要 `NPM_TOKEN`）                                                                        |
| v0.2 roadmap issues                                         | ✅ 已開 #2〜#6                                                                                       |
| demo GIF                                                    | ⬜ 未開始                                                                                            |
| 送出 Codex for OSS 申請                                     | ⬜ 未開始（建議先累積使用量，見下方）                                                                |

---

## 下一步（依順序）

### ① 開啟 GitHub Pages ✅ 已完成（2026-09-01）

Demo 網址：https://pinyi333.github.io/SVG-to-Lottie-tool/

花了兩步才通，兩步都記在下面的「踩過的坑」第 7 條：先是 Pages 沒啟用（`build` job
死在 `configure-pages`），啟用之後換 `deploy` job 被 `github-pages` environment 的
分支政策擋掉。後者是把 `main` 加進 `Settings → Environments → github-pages →
Deployment branches` 解掉的。

要重新部署：推任何 commit 到 `main`，或在 Actions 頁按 Run workflow。

### ② 改預設分支成 `main`

`Settings → General → Default branch` → ⇄ → `main`
改完 `claude/codex-oss-project-coq6cn` 可以刪除（內容是 `main` 的前段）。

已經不阻塞部署了（environment 政策已直接允許 `main`），但還是建議改：repo 首頁預設
顯示的是 `claude/codex-oss-project-coq6cn`，對一個要拿去申請的專案來說是不必要的雜訊。

### ③ 發佈到 npm

1. 註冊 npm 帳號 → 建立 **Automation** token
2. `Settings → Secrets and variables → Actions` 新增 secret：`NPM_TOKEN`
3. `git tag v0.1.0 && git push origin v0.1.0`

release workflow 會先跑完整測試、確認 tag 與套件版本一致才發佈。套件名 `svgmotion`（已確認未被占用）。

### ④ 開 v0.2 roadmap issues ✅ 已完成

原訂的五項功能全部做完，所以開的是新的一批（2026-09-01）：

| #                                                             | 主題                                | 標籤                                         |
| ------------------------------------------------------------- | ----------------------------------- | -------------------------------------------- |
| [#2](https://github.com/Pinyi333/SVG-to-Lottie-tool/issues/2) | 套用 `<style>` 區塊而不是只發警告   | enhancement · good first issue · help wanted |
| [#3](https://github.com/Pinyi333/SVG-to-Lottie-tool/issues/3) | 解析階段展平 `<use>` 參照           | enhancement · help wanted                    |
| [#4](https://github.com/Pinyi333/SVG-to-Lottie-tool/issues/4) | Lottie 匯出近似 `reflect`／`repeat` | enhancement · help wanted                    |
| [#5](https://github.com/Pinyi333/SVG-to-Lottie-tool/issues/5) | 一個 `.lottie` 封存多支動畫         | enhancement · help wanted                    |
| [#6](https://github.com/Pinyi333/SVG-to-Lottie-tool/issues/6) | 在 Firefox／Safari 實測 morph       | good first issue · help wanted               |

每一則都寫了「從哪個檔案下手」，#6 甚至不需要架環境——開瀏覽器看完回報就是完整貢獻。
**這是加分項**——公開 roadmap 是「活躍維護」的訊號。

### ⑤ 錄 demo GIF 放進 README

上傳 SVG → 選線條描繪 → 預覽 → 匯出，5～8 秒即可。

### ⑥ 送申請前先累積使用量

repo 剛開，「使用量」與「生態系重要性」兩項必然是零，這無法用工程品質彌補。
建議先把 demo 分享到前端／設計社群，**有真實使用者和 star 之後再送件**。

---

## 架構速記

```
packages/core/     svgmotion 套件 — 解析、preset、匯出器（無 UI 相依）
apps/web/          React 網頁，是 core 的使用者
examples/          用 Node 呼叫套件的範例，也是唯一跑到 Node 路徑的地方
docs/              Lottie 轉換的技術筆記
```

管線：

```
SVG 文字 → parseSvg → ParsedSvg → presets → AnimationSpec → toCss/toSvg/toLottie/toReact/toVue
```

**兩條撐住整個設計的規則：**

1. **幾何只正規化一次** — 解析階段就把所有形狀轉成絕對三次貝茲曲線。Lottie 只認這個，所以在這裡分解弧線，五個匯出器畫出來的形狀才必然一致。
2. **preset 產出 channel，不產出標記** — channel 是「一個可動畫屬性 + 關鍵影格」。新增效果只要改一個檔案，不用動五個匯出器，匯出器之間也不會對「這個效果是什麼」產生分歧。

新增效果的完整步驟寫在 `CONTRIBUTING.md`。

---

## 驗證指令

```bash
pnpm install
pnpm build        # 必須先 build，apps/web 是吃 core 的建置產物
pnpm lint
pnpm typecheck
pnpm test         # core 184 + web 23
pnpm test:e2e     # Playwright 12 個，跑在正式建置版本上
```

環境若已有 Chromium：`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium pnpm test:e2e`

---

## 已完成的功能（依 git 歷史）

| 功能                | commit    | 重點                                                                                                                                                                           |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub 操作腳本     | `95fc935` | `github-init.bat`、`github-pull.bat`、`update-github.bat`。已評估：這是維護者自己的 Windows 捷徑，不是專案工具，所以只在 `CONTRIBUTING.md` 說明「可以完全忽略」，不寫進 README |
| 路徑變形 path morph | `5e9f3e2` | `morph` preset ＋ `params.toPath`；`parse/morph.ts` 用 de Casteljau 對齊段數；CSS 出 `d: path()`，Lottie 出原生 shape keyframes；子路徑數不符發 `morph-mismatch` 警告          |
| Hover 觸發          | `c86484d` | `Track.trigger`；CSS 掛在 `.svgm-icon:hover` 下並重列 always-on 動畫；Lottie 剔除並警告                                                                                        |
| Scroll 觸發         | `f314555` | `animation-timeline: view()`；混用時逐項配對 timeline；獨立 SVG 匯出對 scroll 另外警告                                                                                         |
| 漸層 gradient       | `93298ad` | 線性／放射漸層在 fill 與 stroke 都能解析與匯出；CSS/SVG/React/Vue 出 `<defs>`，Lottie 出原生 `gf`／`gs`                                                                        |
| dotLottie 輸出      | `6b79752` | `toDotLottie`：ZIP＋manifest；loop 設定終於有地方放；deflate 壓縮（bars 23KB → 1.1KB）；固定時間戳所以位元組可重現                                                             |

漸層的設計重點（詳見 `docs/lottie-mapping.md`）：**座標保持原樣，把 CTM、bounding box、`gradientTransform` 全部合成到一個 `transform` 矩陣裡**。這樣 SVG／CSS 匯出可以直接把矩陣寫到 `gradientTransform` 上，傾斜與非等比縮放都完全精確；Lottie 只認兩個點，所以只有那裡是近似值，而且會明確警告。

## 已驗證 / 未驗證的事

- **Lottie 匯出的實際畫面**：把 JSON 丟進 lottie-web 截圖比對過，圖形位置正確（這就是抓到 anchor bug 的方法）。
- **漸層匯出**：原始 SVG 與匯出 SVG 在 Chromium 逐像素比對，除了刻意退回純色的 pattern 方塊之外完全一致。
- **`.lottie` 封存檔**：用 Python 的 `zipfile`（跟寫檔的 fflate 是完全獨立的實作）驗證過 CRC 與內容都正確。
- **Morph 的 `d: path()`**：在 **Chromium 141 實測會動**（逐格取 `getComputedStyle(path).d`，數值確實在插值）。**Firefox 與 Safari 尚未實測**——這個環境只有 Chromium，不要在文件上宣稱沒驗證過的支援度。

## 踩過的坑（別再踩一次）

**1. 本地全綠 ≠ CI 全綠。** 第一次推上去 CI 三個 job 全紅，其中兩個在本地看不到：

- `typecheck` 失敗：`apps/web` 是透過**建置後**的 `svgmotion` 解析型別，乾淨簽出時 `dist/` 不存在。本地因為留著先前的建置產物而假綠。
  → **修法**：CI 把 `build` 排在 `typecheck` 之前。驗證任何 CI 問題前先 `rm -rf packages/core/dist apps/web/dist` 重現。
- `e2e` 失敗：Vite preview 預設綁 `localhost`，在 runner 上先解析成 IPv6 `::1`，Playwright 卻輪詢 IPv4 `127.0.0.1`。
  → **修法**：`--host 127.0.0.1` 明確綁定。

**2. 錯誤訊息被吞掉會讓人診斷錯方向。** e2e 第一次只吐一句 `Timed out waiting for webServer`，因此第一輪誤判成「冷啟動建置太慢」，白修一次。
→ 已加上 `stdout: 'pipe'` / `stderr: 'pipe'`。**訊息不足本身就是要修的缺陷**，不要繞過它猜。

**3. `pathToCurve` 的退化封閉線段。** 路徑若在 `Z` 之前就已回到起點，轉換仍會為 `Z` 產生一段零長度曲線；留著會重複一個頂點並產生 `[0,0]` 切線——**每個圓形和橢圓都會中**。已在 `parse/geometry.ts` 處理。

**4. 圓形不要用通用弧線轉換。** 通用轉換以 120° 分割，半徑誤差約 0.15%；改用精確的四分之一圓建構（常數 `4/3 × (√2 − 1)`）可降到 0.005% 以下。圖示裡圓形和橢圓最常見，值得特例處理。

**5. `pnpm lint` 不包含格式檢查。**
症狀：程式碼過了 `pnpm lint`，但 CI 的 `format:check` 會紅。
原因：`lint` 只跑 eslint，格式是另一個 script（`pnpm format:check`，跑 prettier）。CI 兩個都跑。
修法：推之前跑 `pnpm format:check`，或直接 `pnpm format`。（這次是因為 CI 只在 main 與 PR 上跑，分支還沒開 PR，才沒真的變紅。）

**6. Lottie 圖層的 anchor 與 position 不能都設成形狀中心。**（2026-09-01 修正）
症狀：所有 Lottie 匯出的圖形都畫在畫布左上角，只露出四分之一。
原因：幾何已經平移到以形狀中心為原點，圖層卻同時把 `a`（anchor）和 `p`（position）都設成中心；播放器算的是 `translate(p) · rotate · scale · translate(-a)`，兩者相同就互相抵銷成單位矩陣。
修法：`a` 設為 `[0, 0]`，只用 `p` 把形狀放回畫布位置。快照測試與結構斷言全都抓不到這個錯——**是把 JSON 丟進真正的播放器截圖比對才發現的**。已加上會失敗的回歸測試（`lottie-playback.test.ts` 會把播放器算出的座標還原出來，檢查是否落在畫布內）。

**7. GitHub Pages 部署失敗要分兩層看：`build` 還是 `deploy`。**（2026-09-01 解決）
症狀一：`build` job 死在 `actions/configure-pages@v5`。
原因：Pages 根本沒啟用——那個 action 就是在向 GitHub 宣告要部署到 Pages，沒開必然失敗。程式面不用改任何東西。
修法：`Settings → Pages → Source` 選 GitHub Actions。

症狀二：Pages 開好之後，`build` 過了，換 `deploy` job 在 **2 秒內失敗、一個 step 都沒跑**。
原因：`github-pages` 這個 environment 預設**只允許從預設分支部署**，而本 repo 的預設分支是 `claude/codex-oss-project-coq6cn`，不是 `main`。
修法：把 `main` 加進 `Settings → Environments → github-pages → Deployment branches`（或把預設分支改成 `main`）。
**辨認方式**：`deploy` job 的 steps 數量。0 steps = 被 environment 規則擋在門外；有 steps = 才是真的部署錯誤。

**8. 圓角矩形的兩個角是錯的（`svg-path-commander` 的 `s` 指令處理）。**（2026-09-01 修正）
症狀：`<rect rx="1">` 匯出後，左上角有缺口、右下角有尖刺；bbox 比原矩形還大。
原因：`shapeToPathArray` 用 `h`／`v` 直線接 `s`（平滑三次曲線）來寫圓角矩形。SVG 規定 `s` 的第一個控制點只有在**前一個指令也是三次曲線**時才鏡射，否則等於目前點；但 `pathToCurve` 會先把直線轉成三次曲線、再照樣鏡射。4×8 的長條配 `rx="1"`，右下控制點會落到底邊下方一整個單位。
修法：`rect` 改成自己產生路徑（和 `circle`／`ellipse` 早就這樣做的理由完全相同），順便正確處理 `rx`／`ry` 互相沿用與夾到半邊長的規則。
**這是視覺才看得出來的 bug**——所有測試都是綠的，是把 Chart 樣本截圖下來看才發現形狀不對。

**9. 樣本圖示要自帶合適的效果。**（2026-09-01 修正）
症狀：點 Chart 樣本，畫面完全不動。
原因：Chart 是三根**只有 fill、沒有 stroke** 的長條，而工作區預設效果是「線條描繪」。動畫確實有產生（在動 `stroke-dashoffset`），只是沒有線條可以描。引擎有發警告，但第一印象已經毀了。
修法：每個樣本自己宣告效果（Chart → bounce），和 `examples/generate.mjs` 早就在做的一樣。

**10. 同一個問題不要警告兩次。** 曾經 preset 驗證器和 Lottie 匯出器各報一次「這個形狀沒有 stroke」，措辭不同，看起來像兩個問題。已移除重複。

---

## 這份文件的更新規則

**每次做完下列任何一件事，就更新這份文件並一起 commit：**

- 完成或推進「下一步」清單裡的任何一項 → 更新狀態表與清單
- CI / 部署狀態改變 → 更新「目前狀態總覽」
- 踩到新的坑並修好 → 加進「踩過的坑」，寫清楚**症狀 → 原因 → 修法**
- 架構有實質變動 → 更新「架構速記」

更新時**一定要改開頭的「最後更新」日期**，並把 commit 指向**最後一次改變專案狀態的 commit**
（不是這份文件自己的 commit——那個值在 amend 之後就會失效）。

寫的時候記住：讀者是三個月後的你，或是一個完全沒有上下文的人。
**寫下當下的真實狀態，不要寫成希望的狀態**——卡住的事情要明白寫出卡在哪裡。
