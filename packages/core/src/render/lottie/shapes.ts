import { parseColor, toLottieColor } from '../../parse/color.js';
import { toLottieHandles } from '../../easing.js';
import type { Easing, Paint, Point, SvgNode } from '../../types.js';
import { subpathToBezier, translateBezier, type LottieBezier } from './path.js';
import { staticProperty, type LottieProperty } from './keyframe.js';

/** Lottie's numeric codes for the line-cap and line-join enums. */
const LINECAP: Record<Paint['strokeLinecap'], number> = { butt: 1, round: 2, square: 3 };
const LINEJOIN: Record<Paint['strokeLinejoin'], number> = { miter: 1, round: 2, bevel: 3 };

export interface LottieShapeItem {
  ty: string;
  [key: string]: unknown;
}

/** A `sh` item: one bezier path. */
export function pathItem(bezier: LottieBezier, index: number): LottieShapeItem {
  return { ty: 'sh', ind: index, ks: { a: 0, k: bezier }, nm: `Path ${index + 1}` };
}

/** One stop of an animated path: the full bezier the shape holds at `time`. */
export interface PathKeyframe {
  /** Seconds on the absolute timeline. */
  time: number;
  bezier: LottieBezier;
  /** Easing towards the next keyframe. Ignored on the last one. */
  easing: Easing;
}

/**
 * A `sh` item whose geometry animates: Lottie shape keyframes hold the whole
 * vertex set in `s`, one complete bezier per stop, and interpolate every
 * vertex and tangent between them.
 */
export function animatedPathItem(
  keyframes: PathKeyframe[],
  fps: number,
  index: number,
): LottieShapeItem {
  const round = (n: number): number => Number(n.toFixed(4));
  const k = keyframes.map((keyframe, i) => {
    const frame: Record<string, unknown> = {
      t: round(keyframe.time * fps),
      s: [keyframe.bezier],
    };
    if (i < keyframes.length - 1) {
      const handles = toLottieHandles(keyframe.easing);
      frame.o = { x: [handles.out.x], y: [handles.out.y] };
      frame.i = { x: [handles.in.x], y: [handles.in.y] };
    }
    return frame;
  });

  return { ty: 'sh', ind: index, ks: { a: 1, k }, nm: `Path ${index + 1}` };
}

/** An `fl` item: a solid fill. Returns null when the shape has no fill. */
export function fillItem(paint: Paint): LottieShapeItem | null {
  const color = parseColor(paint.fill);
  if (!color) return null;
  return {
    ty: 'fl',
    c: staticProperty(toLottieColor(color)),
    // Lottie stores opacity as a percentage.
    o: staticProperty(paint.fillOpacity * 100),
    r: 1,
    nm: 'Fill',
  };
}

/** An `st` item: a stroke. Returns null when the shape has no stroke. */
export function strokeItem(paint: Paint): LottieShapeItem | null {
  const color = parseColor(paint.stroke);
  if (!color) return null;
  return {
    ty: 'st',
    c: staticProperty(toLottieColor(color)),
    o: staticProperty(paint.strokeOpacity * 100),
    w: staticProperty(paint.strokeWidth),
    lc: LINECAP[paint.strokeLinecap],
    lj: LINEJOIN[paint.strokeLinejoin],
    nm: 'Stroke',
  };
}

/**
 * A `tm` item: trim paths, Lottie's native stroke-draw mechanism.
 *
 * `s` and `e` are the start and end of the visible span as percentages of the
 * outline. Order matters inside a group: the trim has to come *after* the
 * stroke it modifies, or players apply it to nothing.
 */
export function trimItem(
  start: LottieProperty,
  end: LottieProperty,
  multiple: boolean,
): LottieShapeItem {
  return {
    ty: 'tm',
    s: start,
    e: end,
    o: staticProperty(0),
    // 1 trims the shapes as one continuous outline, 2 trims each individually.
    // Continuous is what makes a multi-subpath icon draw as a single stroke.
    m: multiple ? 2 : 1,
    nm: 'Trim Paths',
  };
}

export interface TransformItemOptions {
  anchor: LottieProperty;
  position: LottieProperty;
  scale: LottieProperty;
  rotation: LottieProperty;
  opacity: LottieProperty;
}

/** A `tr` item: the transform every shape group ends with. */
export function transformItem(options: TransformItemOptions): LottieShapeItem {
  return {
    ty: 'tr',
    a: options.anchor,
    p: options.position,
    s: options.scale,
    r: options.rotation,
    o: options.opacity,
    sk: staticProperty(0),
    sa: staticProperty(0),
    nm: 'Transform',
  };
}

/** The centre of a node's bounding box, used as its transform pivot. */
export function nodeCenter(node: SvgNode): Point {
  return { x: node.bbox.x + node.bbox.width / 2, y: node.bbox.y + node.bbox.height / 2 };
}

/**
 * Builds the path items for a node, re-expressed around its own centre.
 *
 * Centring is what makes scale and rotation behave: Lottie applies a group's
 * transform about its anchor point, so the anchor is placed at the shape's
 * centre and the geometry is shifted to match, then the position puts it back
 * where it belongs on the canvas.
 */
export function pathItemsFor(node: SvgNode): LottieShapeItem[] {
  const centre = nodeCenter(node);
  return node.subpaths.map((subpath, index) =>
    pathItem(translateBezier(subpathToBezier(subpath), centre), index),
  );
}
