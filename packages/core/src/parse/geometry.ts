import { pathToCurve, shapeToPathArray, splitPath } from 'svg-path-commander/util';
import type { CubicSegment, Point, Rect, Subpath } from '../types.js';
import { applyMatrix, type Matrix } from './matrix.js';

/** Distance below which two points are treated as the same vertex. */
const EPSILON = 1e-6;

/**
 * The circle-to-bezier constant: the control-point offset that makes a cubic
 * bezier hug a 90-degree arc. Derived as 4/3 * (sqrt(2) - 1).
 */
const KAPPA = 0.5522847498307936;

/**
 * Builds an ellipse from four 90-degree cubic segments.
 *
 * The generic arc-to-cubic conversion splits at 120 degrees, which leaves a
 * radial error around 0.15% of the radius. Ellipses and circles are the most
 * common curved primitive in icon artwork, so they get the exact quarter-arc
 * construction instead, dropping that error by roughly an order of magnitude.
 */
function ellipsePathData(cx: number, cy: number, rx: number, ry: number): string | null {
  if (!(rx > 0) || !(ry > 0)) return null;
  const ox = rx * KAPPA;
  const oy = ry * KAPPA;

  return (
    `M${cx + rx} ${cy}` +
    `C${cx + rx} ${cy + oy} ${cx + ox} ${cy + ry} ${cx} ${cy + ry}` +
    `C${cx - ox} ${cy + ry} ${cx - rx} ${cy + oy} ${cx - rx} ${cy}` +
    `C${cx - rx} ${cy - oy} ${cx - ox} ${cy - ry} ${cx} ${cy - ry}` +
    `C${cx + ox} ${cy - ry} ${cx + rx} ${cy - oy} ${cx + rx} ${cy}` +
    `Z`
  );
}

const num = (raw: string | null, fallback = 0): number => {
  if (raw === null) return fallback;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Extracts path data from any supported shape element as a `d` string.
 *
 * `rect`, `circle`, `ellipse`, `line`, `polyline` and `polygon` are all
 * rewritten as paths so that every later stage deals with exactly one
 * geometry type. Returns `null` for elements this library does not draw.
 */
export function elementToPathData(el: Element): string | null {
  const tag = el.tagName.toLowerCase();

  if (tag === 'path') {
    const d = el.getAttribute('d');
    return d && d.trim() !== '' ? d : null;
  }

  // shapeToPathArray works from a plain options object, so this stays usable
  // in Node where the elements come from a DOM shim rather than a real browser.
  let options: Record<string, unknown> | null = null;
  switch (tag) {
    case 'rect':
      options = {
        type: 'rect',
        x: num(el.getAttribute('x')),
        y: num(el.getAttribute('y')),
        width: num(el.getAttribute('width')),
        height: num(el.getAttribute('height')),
        rx: num(el.getAttribute('rx')),
        ry: num(el.getAttribute('ry')),
      };
      break;
    case 'circle': {
      const r = num(el.getAttribute('r'));
      return ellipsePathData(num(el.getAttribute('cx')), num(el.getAttribute('cy')), r, r);
    }
    case 'ellipse':
      return ellipsePathData(
        num(el.getAttribute('cx')),
        num(el.getAttribute('cy')),
        num(el.getAttribute('rx')),
        num(el.getAttribute('ry')),
      );
    case 'line':
      options = {
        type: 'line',
        x1: num(el.getAttribute('x1')),
        y1: num(el.getAttribute('y1')),
        x2: num(el.getAttribute('x2')),
        y2: num(el.getAttribute('y2')),
      };
      break;
    case 'polygon':
    case 'polyline':
      options = { type: tag, points: el.getAttribute('points') ?? '' };
      break;
    default:
      return null;
  }

  const array = shapeToPathArray(options as Parameters<typeof shapeToPathArray>[0]);
  if (!array || array.length === 0) return null;
  return array.map((segment) => segment.join(' ')).join(' ');
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Converts a `d` string into subpaths of absolute cubic beziers, with
 * `matrix` baked into every coordinate.
 *
 * Everything downstream depends on this being the only representation of
 * geometry in the library. Lottie can express paths *only* as cubic beziers,
 * so arcs and quadratics are decomposed here rather than at export time —
 * that way the CSS, SVG and Lottie exporters all draw the identical shape.
 */
export function toSubpaths(pathData: string, matrix: Matrix): Subpath[] {
  let parts;
  try {
    parts = splitPath(pathData);
  } catch {
    // Malformed `d` should cost us one element, not the whole document.
    return [];
  }

  const subpaths: Subpath[] = [];

  for (const part of parts) {
    // Closedness has to be read before conversion: `pathToCurve` discards `Z`
    // and emits an explicit curve back to the start in its place.
    const hasCloseCommand = part.some((segment) => String(segment[0]).toUpperCase() === 'Z');

    let curves;
    try {
      curves = pathToCurve(part);
    } catch {
      continue;
    }

    let start: Point | null = null;
    const segments: CubicSegment[] = [];

    for (const segment of curves) {
      if (segment[0] === 'M') {
        start = applyMatrix(matrix, { x: Number(segment[1]), y: Number(segment[2]) });
      } else if (segment[0] === 'C' && start) {
        segments.push({
          c1: applyMatrix(matrix, { x: Number(segment[1]), y: Number(segment[2]) }),
          c2: applyMatrix(matrix, { x: Number(segment[3]), y: Number(segment[4]) }),
          end: applyMatrix(matrix, { x: Number(segment[5]), y: Number(segment[6]) }),
        });
      }
    }

    if (!start || segments.length === 0) continue;

    // Shapes converted from `<circle>` and `<ellipse>` carry no `Z` yet still
    // close, so fall back to comparing the endpoints.
    const last = segments[segments.length - 1]!.end;
    const closed = hasCloseCommand || distance(last, start) < EPSILON;

    // When a path already returns to its start before `Z`, `pathToCurve` still
    // emits a curve for the `Z`, producing a zero-length segment. Left in, it
    // duplicates a vertex and contributes null tangents on export, so drop it.
    if (closed && segments.length > 1) {
      const penultimate = segments[segments.length - 2]!.end;
      if (distance(penultimate, start) < EPSILON) segments.pop();
    }

    subpaths.push({ start, segments, closed });
  }

  return subpaths;
}

/**
 * Re-serializes subpaths to a `d` attribute for the CSS and SVG exporters.
 *
 * Closed subpaths keep their final segment as an explicit curve before `Z`,
 * because that segment is not always the straight line `Z` would draw on its
 * own — on a circle it is a real quarter arc.
 */
export function subpathsToPathData(subpaths: Subpath[], precision = 3): string {
  const round = (n: number) => Number(n.toFixed(precision));
  const parts: string[] = [];

  for (const subpath of subpaths) {
    parts.push(`M${round(subpath.start.x)} ${round(subpath.start.y)}`);
    for (const s of subpath.segments) {
      parts.push(
        `C${round(s.c1.x)} ${round(s.c1.y)} ${round(s.c2.x)} ${round(s.c2.y)} ` +
          `${round(s.end.x)} ${round(s.end.y)}`,
      );
    }
    if (subpath.closed) parts.push('Z');
  }

  return parts.join('');
}

/** Evaluates a cubic bezier at `t`, used for bounding boxes and sampling. */
export function pointOnCubic(p0: Point, s: CubicSegment, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * s.c1.x + c * s.c2.x + d * s.end.x,
    y: a * p0.y + b * s.c1.y + c * s.c2.y + d * s.end.y,
  };
}

/**
 * Exact axis-aligned bounding box of a set of subpaths.
 *
 * Control points alone overestimate the box, which would push transform
 * origins off-centre, so this solves for the curve's real extrema instead.
 */
export function boundingBox(subpaths: Subpath[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const include = (p: Point) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };

  for (const subpath of subpaths) {
    let from = subpath.start;
    include(from);
    for (const segment of subpath.segments) {
      include(segment.end);
      for (const t of cubicExtrema(from, segment)) include(pointOnCubic(from, segment, t));
      from = segment.end;
    }
  }

  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Values of `t` in (0, 1) where a cubic's derivative crosses zero on either axis. */
function cubicExtrema(p0: Point, s: CubicSegment): number[] {
  const roots: number[] = [];

  for (const axis of ['x', 'y'] as const) {
    const a = -p0[axis] + 3 * s.c1[axis] - 3 * s.c2[axis] + s.end[axis];
    const b = 2 * (p0[axis] - 2 * s.c1[axis] + s.c2[axis]);
    const c = -p0[axis] + s.c1[axis];

    // The derivative is quadratic: 3(a t^2 + b t + c) = 0.
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) > 1e-12) roots.push(-c / b);
      continue;
    }
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) continue;
    const root = Math.sqrt(discriminant);
    roots.push((-b + root) / (2 * a), (-b - root) / (2 * a));
  }

  return roots.filter((t) => t > 0 && t < 1);
}

/**
 * Approximate outline length, used to size the `stroke-dasharray` that drives
 * the CSS stroke-draw animation. Flattening each curve into segments is both
 * accurate enough for that purpose and portable to Node, where
 * `SVGGeometryElement.getTotalLength()` does not exist.
 */
export function outlineLength(subpaths: Subpath[], samplesPerSegment = 24): number {
  let total = 0;
  for (const subpath of subpaths) {
    let from = subpath.start;
    for (const segment of subpath.segments) {
      let previous = from;
      for (let i = 1; i <= samplesPerSegment; i += 1) {
        const point = pointOnCubic(from, segment, i / samplesPerSegment);
        total += distance(previous, point);
        previous = point;
      }
      from = segment.end;
    }
  }
  return total;
}
