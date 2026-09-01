# SVGMotion

Turn a static SVG icon into an animation, and export it as **Lottie JSON, CSS, a
standalone SVG, or a React or Vue component**.

**[Try it in your browser →](https://pinyi333.github.io/SVG-to-Lottie-tool/)** · [繁體中文說明](./README.zh-TW.md)

Nothing is uploaded. Parsing, animating and exporting all happen on your machine.

```
Upload SVG  →  pick an effect  →  preview  →  export
                                              ├── Lottie JSON
                                              ├── CSS + markup
                                              ├── standalone .svg
                                              ├── React component
                                              └── Vue component
```

The app has a second workspace, a **Lottie Playground**: drop in any `.json`,
adjust speed, direction, loop, size and background, and copy an embed snippet
for plain HTML, an iframe, React or Vue. Animations you build in the first
workspace can be handed straight to it.

## The engine is a library

The web app is a consumer of [`svgmotion`](https://www.npmjs.com/package/svgmotion),
a framework-agnostic TypeScript package with no UI dependencies. Use it directly
in a build script, a CLI, or a server.

```bash
npm install svgmotion
```

```ts
import { parseSvg, createSpec, createTrack, toLottie, toCss } from 'svgmotion';

const parsed = parseSvg(svgMarkup);

const spec = createSpec(parsed, { fps: 60 });
spec.tracks = [
  createTrack('tick', 'strokeDraw', { duration: 1.2, easing: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } }),
];

const { animation, warnings, loop } = toLottie(spec);
const { css, html } = toCss(spec);

// `warnings` lists everything the format could not carry. Read it.
for (const warning of warnings) console.warn(warning.message);
```

In Node there is no global `DOMParser`, so pass one in:

```ts
import { JSDOM } from 'jsdom';
const { window } = new JSDOM();
const parsed = parseSvg(svgMarkup, { domParser: new window.DOMParser() });
```

## What each effect can export to

Not every animation survives every format, and the gaps are in the format
itself rather than in this tool. Lottie has no concept of input events, so
hover and scroll animations can never be Lottie — they are CSS and JavaScript
only. Saying so plainly beats exporting a file that silently does nothing.

| Effect          | CSS | SVG | Lottie          | React | Vue |
| --------------- | --- | --- | --------------- | ----- | --- |
| Stroke draw     | ✅ dash offset | ✅ | ✅ Trim Paths | ✅ | ✅ |
| Fade            | ✅  | ✅  | ✅              | ✅    | ✅  |
| Scale           | ✅  | ✅  | ✅              | ✅    | ✅  |
| Rotate          | ✅  | ✅  | ✅              | ✅    | ✅  |
| Bounce          | ✅  | ✅  | ✅              | ✅    | ✅  |
| Loop / ping-pong | ✅ | ✅  | ✅              | ✅    | ✅  |
| Path morph      | [#1](https://github.com/Pinyi333/SVG-to-Lottie-tool/issues) | planned | planned | planned | planned |
| Hover           | planned | ✅ `:hover` | ❌ not expressible | planned | planned |
| Scroll          | planned | ❌ | ❌ not expressible | planned | planned |

## What of an SVG survives the trip

Supported: `path`, `rect`, `circle`, `ellipse`, `line`, `polygon`, `polyline`,
nested `g` elements, `transform` on any of them, solid fills and strokes,
`stroke-width`, `stroke-linecap`, `stroke-linejoin`, opacity, presentation
attributes and inline `style`.

Not converted, and reported as a warning rather than dropped in silence:
gradients and patterns, `clipPath` and masks, filters, `text`, `image`, `use`
references, and `<style>` blocks. Flatten those before uploading.

Circles and ellipses are built from exact quarter-arc beziers rather than the
generic 120° arc conversion, which keeps radial error under 0.005% of the
radius instead of around 0.15%.

## Security

Uploaded SVG is untrusted input that gets rendered into a page. Before anything
touches the DOM, `parseSvg` strips `<script>`, `<foreignObject>`, every `on*`
event handler attribute, and any `href` that is not a local fragment or an
inline data image. The in-app preview additionally runs inside a `sandbox=""`
iframe, so the generated stylesheet cannot reach the surrounding UI.

## Development

Requires Node 20+ and pnpm 10+.

```bash
pnpm install
pnpm dev            # start the web app
pnpm test           # unit tests (111 in the core package)
pnpm test:e2e       # Playwright smoke tests against a production build
pnpm typecheck
pnpm lint
pnpm build
```

The Lottie output is validated by loading it into `lottie-web` and stepping
through frames, not only by snapshotting the JSON — a wrong property code
passes every snapshot and still renders nothing.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md)
for the layout of the repository and how to add a new effect, which is usually
a single file. Issues tagged `good first issue` are a reasonable place to start.

## Licence

[MIT](./LICENSE)
