# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
