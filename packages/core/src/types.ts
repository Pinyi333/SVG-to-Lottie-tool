/**
 * The intermediate representation shared by every parser and exporter.
 *
 * The whole library is built around one rule: `parseSvg` produces a `ParsedSvg`,
 * presets turn user intent into `Track`s, and every `to*` renderer is a pure
 * function of the resulting `AnimationSpec`. Renderers never reach back into the
 * original SVG text, which is what keeps them independently testable.
 */

/** A single cubic bezier segment. Start point is the previous segment's `end`. */
export interface CubicSegment {
  /** First control point. */
  c1: Point;
  /** Second control point. */
  c2: Point;
  /** Segment end point. */
  end: Point;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One contiguous subpath, already normalized to absolute cubic beziers.
 * Lottie can only express cubic beziers, so every arc and quadratic is
 * decomposed during parsing rather than at export time.
 */
export interface Subpath {
  start: Point;
  segments: CubicSegment[];
  closed: boolean;
}

export interface Paint {
  fill: string | null;
  fillOpacity: number;
  stroke: string | null;
  strokeOpacity: number;
  strokeWidth: number;
  strokeLinecap: 'butt' | 'round' | 'square';
  strokeLinejoin: 'miter' | 'round' | 'bevel';
  opacity: number;
}

/** A single drawable element after all SVG shape types have been unified. */
export interface SvgNode {
  /** Stable id used to address this node from a `Track`. Generated if absent. */
  id: string;
  /** The original SVG tag this node came from, kept for UI labelling. */
  sourceTag: string;
  /** Path data normalized to absolute cubic beziers, transforms already baked in. */
  subpaths: Subpath[];
  paint: Paint;
  /** Axis-aligned bounding box, used for centred transform origins. */
  bbox: Rect;
  /** Total outline length, used by stroke-draw exporters. */
  length: number;
}

export interface ParsedSvg {
  /** Effective viewBox. Synthesized from width/height when the source omits it. */
  viewBox: Rect;
  width: number;
  height: number;
  nodes: SvgNode[];
  /** Non-fatal issues found while parsing (dropped features, guessed values). */
  warnings: Warning[];
}

export type WarningCode =
  | 'unsupported-element'
  | 'unsupported-paint'
  | 'unsupported-attribute'
  | 'removed-for-safety'
  | 'missing-viewbox'
  | 'lottie-unsupported'
  | 'empty-document';

export interface Warning {
  code: WarningCode;
  message: string;
  /** The element or attribute the warning refers to, when one applies. */
  subject?: string;
}

export type PresetName = 'strokeDraw' | 'fade' | 'scale' | 'rotate' | 'bounce';

export type LoopMode = 'none' | 'loop' | 'pingpong';

export interface Loop {
  mode: LoopMode;
  /** Repeat count. `undefined` means infinite. Ignored when mode is 'none'. */
  count?: number;
}

/**
 * Easing as four cubic-bezier control values, matching the CSS
 * `cubic-bezier(x1, y1, x2, y2)` argument order. Lottie keyframe handles are
 * derived from the same numbers, so both exporters stay in sync by construction.
 */
export interface Easing {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Track {
  /** `SvgNode.id` this track animates. */
  targetId: string;
  preset: PresetName;
  /** Seconds before the animation starts. */
  delay: number;
  /** Seconds the animation runs for, excluding delay. */
  duration: number;
  easing: Easing;
  loop: Loop;
  params: PresetParams;
}

/**
 * Preset-specific knobs. Every field is optional; each preset documents and
 * applies its own defaults so a `Track` is always renderable.
 */
export interface PresetParams {
  /** rotate: degrees to turn through. */
  degrees?: number;
  /** scale: start and end scale factors, 1 = natural size. */
  from?: number;
  to?: number;
  /** bounce: peak height in user units. */
  height?: number;
  /** strokeDraw: draw from the end of the path instead of the start. */
  reverse?: boolean;
}

export interface AnimationSpec {
  source: ParsedSvg;
  /** Frames per second. Only meaningful for Lottie output. */
  fps: number;
  /** Total timeline length in seconds. */
  duration: number;
  tracks: Track[];
}
