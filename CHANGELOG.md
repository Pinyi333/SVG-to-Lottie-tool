# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Path morph effect (`morph` preset): reshapes a path into a target `d` string
  passed as `params.toPath`. Exports to CSS (`d: path()` keyframes, inherited
  by the SVG, React and Vue outputs) and to Lottie as native shape keyframes.
  Mismatched segment counts are aligned by subdividing curves; mismatched
  subpath counts are reported as a `morph-mismatch` warning instead of guessed
  at.
- Hover trigger: any track can set `trigger: 'hover'` to play while the
  pointer is over the icon. CSS (and the SVG, React and Vue outputs) express
  it with a `:hover` rule on a root class; the Lottie export drops such tracks
  with a warning, since the format has no model for input events. The Animate
  workspace gained a "Play on" control for it.
- Scroll trigger: `trigger: 'scroll'` scrubs a track as the icon crosses the
  viewport, via CSS scroll-driven animations (`animation-timeline: view()`).
  Browsers without the feature autoplay it instead; the Lottie export drops
  such tracks with a warning, and the standalone SVG export warns that an
  image embed has no scroller.
- Gradient paint: linear and radial gradients on a fill or a stroke are parsed
  and exported instead of dropped. Both unit systems, `gradientTransform`,
  `spreadMethod`, percentage lengths, `stop-opacity`, a moved focal point and
  `href` inheritance are resolved; the CSS, SVG, React and Vue exports emit a
  `<defs>` entry that keeps the composed matrix, and the Lottie export emits
  native `gf` and `gs` items. Where Lottie's two-point model cannot hold the
  gradient — a non-uniform bounding box, a skew, or a `spreadMethod` other
  than `pad` — it exports the nearest it can and says so. `Paint` gained
  `fillGradient` and `strokeGradient`.

- dotLottie export (`toDotLottie`): packs the animation and a manifest into a
  `.lottie` archive. The manifest carries the loop setting, which a bare
  `.json` has nowhere to record. Entries are deflated and stamped with a fixed
  timestamp, so the same animation always produces the same bytes. The Animate
  workspace gained a "Download .lottie" button beside the Lottie export, and
  the Lottie Playground now opens a dropped `.lottie` archive — honouring the
  loop setting its manifest records — as well as a bare `.json`.

### Changed

- A `url(#id)` fill or stroke that cannot be resolved now falls back to the
  colour named after it, as SVG specifies, rather than leaving the shape
  unpainted. The warning names the reference and why it failed.

### Fixed

- Rounded rectangles were drawn with two of their four corners wrong. The
  shape-to-path helper writes them as smooth cubics (`s`) following `h` and
  `v` lines; SVG reflects a smooth cubic's first control point only when the
  previous command was itself a cubic, but the conversion turned those lines
  into cubics first and reflected off them anyway. On a 4x8 bar with `rx="1"`
  the bottom-right control point landed a whole unit below the shape, drawing
  a spike and pushing the bounding box outside the rectangle. `rect` now
  builds its own path, as `circle` and `ellipse` already did, including the
  `rx`/`ry` defaulting and clamping rules.
- The Chart sample animated nothing when clicked. Its bars are filled and have
  no stroke, and the workspace opened with stroke draw selected, so the
  animation ran correctly on a stroke that was not there. Each sample now
  names the effect its own artwork can show.
- Lottie exports drew every shape around the canvas origin instead of where it
  sat in the source, leaving most icons a quarter visible in the corner. Each
  layer set both its anchor and its position to the shape's centre, which a
  player composes as `translate(position) · translate(-anchor)` — exactly
  cancelling out. The geometry is exported around its own centre, so the
  anchor is now the origin and the position alone places the shape.

## [0.1.0] - 2026-09-01

First release.

### Added

- `svgmotion`, a framework-agnostic engine that parses SVG, applies animation
  presets, and exports to Lottie JSON, CSS, standalone SVG, React and Vue.
- Five effects: stroke draw, fade, scale, rotate and bounce, each with
  configurable duration, delay, easing, and looping including ping-pong.
- SVG parsing that sanitizes untrusted input, bakes nested transforms into the
  geometry, resolves inherited styles, and normalizes every shape type to
  absolute cubic beziers.
- Warnings for everything a target format cannot carry, surfaced in the UI
  rather than dropped silently.
- A web app with two workspaces — Animate and Lottie Playground — and the
  ability to hand an animation from one to the other.
- English and Traditional Chinese interface locales.

### Known limitations

- Gradients, patterns, masks, filters, text, images and `use` references are
  not converted.
- Hover and scroll animations are not implemented, and cannot ever be
  represented in Lottie, which has no model for input events.
- Path morphing is not implemented.

[Unreleased]: https://github.com/Pinyi333/SVG-to-Lottie-tool/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Pinyi333/SVG-to-Lottie-tool/releases/tag/v0.1.0
