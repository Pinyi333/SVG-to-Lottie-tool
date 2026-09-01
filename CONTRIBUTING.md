# Contributing

Thanks for taking a look. Bug reports, ideas and pull requests are all welcome.

## Getting set up

Node 20 or later, and pnpm 10 or later.

```bash
git clone https://github.com/Pinyi333/SVG-to-Lottie-tool.git
cd SVG-to-Lottie-tool
pnpm install
pnpm dev
```

Before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e     # needs a Chromium; see below
```

If your environment already ships a Chromium build, point Playwright at it
instead of downloading another:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium pnpm test:e2e
```

Otherwise `pnpm exec playwright install chromium` once is enough.

## How the repository is laid out

```
packages/core/     the svgmotion package — parsing, presets, exporters
apps/web/          the React app, a consumer of that package
```

The core package has no UI dependencies and must keep it that way. That
constraint is what makes it usable from a build script or a server, which is
most of the point of publishing it separately.

## How the pipeline fits together

```
SVG text
   │  parseSvg          sanitize, flatten transforms, normalize to cubic beziers
   ▼
ParsedSvg              a flat list of shapes, no nesting, no transforms left
   │  presets           turn user intent into channels of keyframes
   ▼
AnimationSpec
   │  toCss / toSvg / toLottie / toReact / toVue
   ▼
output
```

Two rules hold the design together:

**Geometry is normalized once.** Every shape becomes absolute cubic bezier
subpaths during parsing. Lottie can express nothing else, so decomposing arcs
there rather than at export time is what keeps all five exporters drawing the
identical shape.

**Presets emit channels, not markup.** A channel is one animatable property
with keyframes on it. Exporters know how to express a channel in their own
format. This is why adding an effect does not mean editing five exporters, and
why they cannot drift on what an effect means.

## Adding a new effect

Usually one file plus a translation key.

1. Add the name to `PresetName` in `packages/core/src/types.ts`.
2. Add a `PresetDefinition` in `packages/core/src/presets/index.ts`. `build`
   returns the channels the effect drives. Add a `validate` if the effect can
   be a silent no-op on some shapes — a stroke animation on a shape with no
   stroke, say. Warning about that is better than exporting nothing.
3. If the effect needs a channel that does not exist yet, add it to
   `ChannelName` in `presets/channels.ts` with a resting value, then teach
   `render/css.ts` and `render/lottie.ts` how to express it. The React, Vue and
   SVG exporters build on the CSS one and need no change.
4. Add a label to `apps/web/src/i18n/en.ts` and `zh-TW.ts`.
5. Add tests. The golden-file snapshots pick up the new effect automatically.

If the effect cannot be represented in Lottie, set `lottieSupported: false` and
say so in the README's table. That table is a feature, not an admission.

## Tests

- `packages/core/test/` — unit tests, plus golden-file snapshots of every
  exporter's output. Update snapshots with `pnpm test -- -u` and **read the
  diff** before accepting it.
- `packages/core/test/lottie-playback.test.ts` — loads generated files into
  `lottie-web` and steps through frames. Structural assertions alone cannot
  prove a player will accept a file.
- `apps/web/e2e/` — Playwright specs against a production build.

A test that asserts a button was clicked is worth much less than one that
parses the exported file and checks what is in it. Prefer the latter.

## Commits and pull requests

[Conventional Commits](https://www.conventionalcommits.org/), e.g.
`feat(core): add path morph preset` or `fix(web): keep zoom on file change`.

Keep pull requests focused. A description of what changed and why is worth more
than a long one describing how.

## Code of conduct

By taking part you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).
