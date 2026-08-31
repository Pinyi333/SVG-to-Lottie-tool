import type { Point, Subpath } from '../../types.js';

/**
 * Lottie's bezier shape value.
 *
 * `v` holds the vertices; `i` and `o` hold the incoming and outgoing tangent
 * handles, stored **relative to their own vertex** rather than in absolute
 * coordinates. `c` marks the path closed, in which case the segment from the
 * last vertex back to the first is implicit.
 */
export interface LottieBezier {
  i: [number, number][];
  o: [number, number][];
  v: [number, number][];
  c: boolean;
}

const round = (n: number): number => Number(n.toFixed(4));
const pair = (p: Point): [number, number] => [round(p.x), round(p.y)];
const relative = (handle: Point, vertex: Point): [number, number] => [
  round(handle.x - vertex.x),
  round(handle.y - vertex.y),
];

/**
 * Converts one normalized subpath into Lottie's bezier representation.
 *
 * The mapping hinges on where each control point belongs. In a cubic segment
 * running from vertex A to vertex B, the first control point is A's *outgoing*
 * handle and the second is B's *incoming* handle. A closed path drops the
 * duplicated final vertex and hands its handles to the first vertex instead,
 * because Lottie draws the closing segment implicitly.
 */
export function subpathToBezier(subpath: Subpath): LottieBezier {
  const vertices: Point[] = [subpath.start];
  for (const segment of subpath.segments) vertices.push(segment.end);

  // On a closed path the last segment lands back on the start vertex, which
  // Lottie would otherwise render as a duplicate point with a zero-length seam.
  const closing = subpath.closed ? subpath.segments[subpath.segments.length - 1] : undefined;
  const drawn = subpath.closed ? subpath.segments.slice(0, -1) : subpath.segments;
  if (subpath.closed) vertices.pop();

  const count = vertices.length;
  const inHandles: [number, number][] = new Array(count).fill(null).map(() => [0, 0]);
  const outHandles: [number, number][] = new Array(count).fill(null).map(() => [0, 0]);

  drawn.forEach((segment, index) => {
    const from = vertices[index]!;
    const to = vertices[index + 1]!;
    outHandles[index] = relative(segment.c1, from);
    inHandles[index + 1] = relative(segment.c2, to);
  });

  if (closing && count > 0) {
    // The implicit closing segment runs from the last vertex to the first.
    outHandles[count - 1] = relative(closing.c1, vertices[count - 1]!);
    inHandles[0] = relative(closing.c2, vertices[0]!);
  }

  return {
    i: inHandles,
    o: outHandles,
    v: vertices.map(pair),
    c: subpath.closed,
  };
}

/**
 * Shifts a bezier so it is expressed relative to `origin`.
 *
 * Lottie composes a shape's own coordinates with its group transform, so
 * putting the transform anchor at the shape's centre means the geometry has to
 * be re-expressed around that centre — otherwise a scale or rotation pivots on
 * the composition origin instead of the shape.
 */
export function translateBezier(bezier: LottieBezier, origin: Point): LottieBezier {
  return {
    ...bezier,
    v: bezier.v.map(([x, y]) => [round(x - origin.x), round(y - origin.y)]),
  };
}
