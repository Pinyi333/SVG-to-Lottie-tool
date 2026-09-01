import type { CubicSegment, Point, Subpath } from '../types.js';
import { toSubpaths } from './geometry.js';
import { IDENTITY } from './matrix.js';

/**
 * Geometry alignment for path morphing.
 *
 * Every format that can interpolate a path — CSS `d: path()`, Lottie shape
 * keyframes — demands that both endpoints have the *same structure*: the same
 * number of subpaths, and per subpath the same number of segments. This module
 * produces that structure once, so the CSS and Lottie exporters interpolate
 * the identical geometry and stay visually in sync.
 */

export interface AlignedMorph {
  /** Source geometry, subdivided where needed. Draws identically to the original. */
  from: Subpath[];
  /** Target geometry, subdivided to match `from` segment-for-segment. */
  to: Subpath[];
}

/**
 * Parses a morph target `d` string.
 *
 * The target is authored in the same viewBox coordinates as the parsed source
 * shape (whose transforms are already baked in), so no matrix is applied.
 */
export function parseMorphTarget(pathData: string): Subpath[] {
  return toSubpaths(pathData, IDENTITY);
}

/** Splits one cubic segment at `t` into two that draw the same curve. */
function splitCubic(from: Point, segment: CubicSegment, t: number): [CubicSegment, CubicSegment] {
  const lerp = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  // De Casteljau: the intermediate points are the control points of the halves.
  const ab = lerp(from, segment.c1);
  const bc = lerp(segment.c1, segment.c2);
  const cd = lerp(segment.c2, segment.end);
  const abbc = lerp(ab, bc);
  const bccd = lerp(bc, cd);
  const mid = lerp(abbc, bccd);

  return [
    { c1: ab, c2: abbc, end: mid },
    { c1: bccd, c2: cd, end: segment.end },
  ];
}

/** Approximate length of one segment, used to pick which segment to subdivide. */
function segmentLength(from: Point, segment: CubicSegment): number {
  // Control polygon length overestimates but ranks segments correctly, which
  // is all the subdivision heuristic needs.
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  return d(from, segment.c1) + d(segment.c1, segment.c2) + d(segment.c2, segment.end);
}

/**
 * Subdivides a subpath's longest segments until it has `count` segments.
 * The drawn curve is unchanged; only the parameterization gets denser.
 */
function subdivideTo(subpath: Subpath, count: number): Subpath {
  if (subpath.segments.length >= count) return subpath;

  // Track each segment with its start point so lengths and splits stay local.
  const entries: { from: Point; segment: CubicSegment }[] = [];
  let cursor = subpath.start;
  for (const segment of subpath.segments) {
    entries.push({ from: cursor, segment });
    cursor = segment.end;
  }

  while (entries.length < count) {
    let longest = 0;
    let longestLength = -Infinity;
    entries.forEach((entry, index) => {
      const length = segmentLength(entry.from, entry.segment);
      if (length > longestLength) {
        longestLength = length;
        longest = index;
      }
    });

    const target = entries[longest]!;
    const [first, second] = splitCubic(target.from, target.segment, 0.5);
    entries.splice(
      longest,
      1,
      { from: target.from, segment: first },
      { from: first.end, segment: second },
    );
  }

  return { ...subpath, segments: entries.map((entry) => entry.segment) };
}

/**
 * Aligns two subpath lists so they interpolate cleanly, or returns `null`
 * when their subpath counts differ.
 *
 * Mismatched subpath counts have no principled pairing — which hole of a `B`
 * maps onto a `O`? — so that case is reported to the user instead of guessed
 * at. Mismatched *segment* counts are routine (a 4-segment circle onto a
 * 12-segment star) and are fixed by subdividing the poorer side.
 */
export function alignForMorph(from: Subpath[], to: Subpath[]): AlignedMorph | null {
  if (from.length === 0 || to.length === 0) return null;
  if (from.length !== to.length) return null;

  const alignedFrom: Subpath[] = [];
  const alignedTo: Subpath[] = [];

  for (let i = 0; i < from.length; i += 1) {
    const a = from[i]!;
    const b = to[i]!;
    const count = Math.max(a.segments.length, b.segments.length);
    alignedFrom.push(subdivideTo(a, count));
    // Closedness follows the source: a Lottie shape keyframe set must keep a
    // constant vertex count, and a closed subpath drops its duplicated final
    // vertex. Morphing between open and closed is inherently approximate, so
    // the source's topology wins for the whole animation.
    alignedTo.push({ ...subdivideTo(b, count), closed: a.closed });
  }

  return { from: alignedFrom, to: alignedTo };
}

/**
 * Resolves the aligned morph geometry for a morph track targeting `subpaths`,
 * or null when there is no usable target.
 *
 * The failure cases are already reported by the morph preset's `validate`, so
 * exporters call this quietly and render the shape unmorphed on null rather
 * than warning a second time.
 */
export function resolveMorph(toPath: string | undefined, subpaths: Subpath[]): AlignedMorph | null {
  if (!toPath || toPath.trim() === '') return null;
  const target = parseMorphTarget(toPath);
  if (target.length === 0) return null;
  return alignForMorph(subpaths, target);
}

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

const mixPoint = (a: Point, b: Point, t: number): Point => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
});

/**
 * Linearly interpolates between two aligned subpath lists at progress `t`.
 * Callers must pass geometry produced by `alignForMorph`.
 */
export function interpolateSubpaths(from: Subpath[], to: Subpath[], t: number): Subpath[] {
  if (t <= 0) return from;
  if (t >= 1) return to;

  return from.map((subpath, index) => {
    const target = to[index]!;
    return {
      start: mixPoint(subpath.start, target.start, t),
      segments: subpath.segments.map((segment, s) => {
        const other = target.segments[s]!;
        return {
          c1: mixPoint(segment.c1, other.c1, t),
          c2: mixPoint(segment.c2, other.c2, t),
          end: mixPoint(segment.end, other.end, t),
        };
      }),
      // Aligned geometry shares one closed flag, so either side works here.
      closed: subpath.closed,
    };
  });
}
