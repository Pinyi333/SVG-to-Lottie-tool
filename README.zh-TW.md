# SVGMotion

把靜態 SVG 圖示變成動畫，並匯出成 **Lottie JSON、CSS、獨立 SVG，或 React / Vue 元件**。

**[在瀏覽器裡試用 →](https://pinyi333.github.io/SVG-to-Lottie-tool/)** · [English](./README.md)

檔案不會上傳。解析、動畫與匯出全部在你自己的機器上完成。

```
上傳 SVG  →  選擇效果  →  預覽  →  匯出
                                    ├── Lottie JSON
                                    ├── CSS ＋ 標記
                                    ├── 獨立 .svg
                                    ├── React 元件
                                    └── Vue 元件
```

另外還有一個 **Lottie 遊樂場**：拖進任何 `.json`，調整速度、方向、循環、尺寸與背景，
再複製 HTML、iframe、React 或 Vue 的嵌入程式碼。在第一個工作區做好的動畫可以直接送過去。

## 核心是一個函式庫

網頁只是 [`svgmotion`](https://www.npmjs.com/package/svgmotion) 的使用者。
這個 TypeScript 套件不綁定任何框架、不含 UI 相依，可以直接用在建置腳本、CLI 或伺服器上。

```bash
npm install svgmotion
```

```ts
import { parseSvg, createSpec, createTrack, toLottie, toCss } from 'svgmotion';

const parsed = parseSvg(svgMarkup);

const spec = createSpec(parsed, { fps: 60 });
spec.tracks = [createTrack('tick', 'strokeDraw', { duration: 1.2 })];

const { animation, warnings } = toLottie(spec);
const { css, html } = toCss(spec);

// warnings 會列出這個格式承載不了的東西，請務必讀它。
for (const warning of warnings) console.warn(warning.message);
```

Node 環境沒有全域的 `DOMParser`，需要自己傳入：

```ts
import { JSDOM } from 'jsdom';
const { window } = new JSDOM();
const parsed = parseSvg(svgMarkup, { domParser: new window.DOMParser() });
```

## 各效果可以匯出到哪些格式

不是每種動畫都能存活在每種格式裡，而且限制來自格式本身，不是這個工具。
Lottie 沒有「輸入事件」這個概念，所以 hover 與 scroll 動畫永遠不可能變成 Lottie，
只能是 CSS 與 JavaScript。把這件事講清楚，比匯出一個什麼都不會做的檔案好。

| 效果       | CSS            | SVG         | Lottie        | React  | Vue    |
| ---------- | -------------- | ----------- | ------------- | ------ | ------ |
| 線條描繪   | ✅ dash offset | ✅          | ✅ Trim Paths | ✅     | ✅     |
| 淡入       | ✅             | ✅          | ✅            | ✅     | ✅     |
| 縮放       | ✅             | ✅          | ✅            | ✅     | ✅     |
| 旋轉       | ✅             | ✅          | ✅            | ✅     | ✅     |
| 彈跳       | ✅             | ✅          | ✅            | ✅     | ✅     |
| 循環／來回 | ✅             | ✅          | ✅            | ✅     | ✅     |
| 路徑變形   | ✅ `d: path()` | ✅          | ✅ 形狀關鍵格 | ✅     | ✅     |
| Hover      | ✅ `:hover`    | ✅          | ❌ 無法表達   | ✅     | ✅     |
| Scroll     | ✅ `view()`    | ❌          | ❌ 無法表達   | ✅     | ✅     |

## SVG 裡哪些內容會被保留

支援：`path`、`rect`、`circle`、`ellipse`、`line`、`polygon`、`polyline`、
巢狀 `g`、上述元素的 `transform`、單色填色與線條、`stroke-width`、
`stroke-linecap`、`stroke-linejoin`、透明度、presentation 屬性與行內 `style`。

不會轉換，而且會以警告呈現而非默默丟掉：漸層與圖樣、`clipPath` 與遮罩、
濾鏡、`text`、`image`、`use` 參照，以及 `<style>` 區塊。請先在設計工具裡把它們展平。

圓形與橢圓使用精確的四分之一圓貝茲曲線建構，而不是通用的 120 度弧線轉換，
半徑誤差因此從約 0.15% 降到 0.005% 以下。

## 安全性

上傳的 SVG 是不可信任的輸入，而且會被畫進頁面裡。在任何東西碰到 DOM 之前，
`parseSvg` 會移除 `<script>`、`<foreignObject>`、所有 `on*` 事件屬性，
以及任何不是本地片段或內嵌 data 圖片的 `href`。
應用程式內的預覽另外跑在 `sandbox=""` 的 iframe 裡，
所以產生出來的樣式表碰不到周圍的介面。

## 開發

需要 Node 20+ 與 pnpm 10+。

```bash
pnpm install
pnpm dev            # 啟動網頁
pnpm test           # 單元測試（核心套件共 111 個）
pnpm test:e2e       # 針對正式建置版本執行 Playwright 測試
pnpm typecheck
pnpm lint
pnpm build
```

Lottie 的輸出不只做 JSON 快照比對，還會實際載入 `lottie-web` 逐格播放驗證——
因為錯誤的屬性代碼可以通過所有快照測試，卻什麼都畫不出來。

## 參與貢獻

歡迎開 issue 與 pull request。[CONTRIBUTING.md](./CONTRIBUTING.md)
說明了專案結構，以及如何新增一個效果（通常只需要改一個檔案）。
標記 `good first issue` 的項目適合作為起點。

## 授權

[MIT](./LICENSE)
