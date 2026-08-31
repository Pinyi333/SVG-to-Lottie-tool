import type { Point } from '../types.js';

/**
 * A 2D affine matrix in SVG's own `matrix(a b c d e f)` order:
 *
 * ```
 * | a c e |
 * | b d f |
 * | 0 0 1 |
 * ```
 */
export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Returns `m1 * m2`, i.e. apply `m2` first and then `m1`. */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

export function applyMatrix(m: Matrix, p: Point): Point {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

export function isIdentity(m: Matrix): boolean {
  return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;
}

/**
 * Average scale factor of a matrix, used to keep stroke widths visually
 * correct once a transform has been baked into the geometry. SVG scales
 * stroke width by the geometric mean of the axis scales, which is what
 * `sqrt(|det|)` gives for a non-degenerate matrix.
 */
export function scaleFactor(m: Matrix): number {
  const det = Math.abs(m.a * m.d - m.b * m.c);
  return det === 0 ? 0 : Math.sqrt(det);
}

const RAD = Math.PI / 180;

function numbers(raw: string): number[] {
  const found = raw.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  return found ? found.map(Number) : [];
}

/**
 * Parses an SVG `transform` attribute into a single matrix.
 *
 * SVG applies a transform list left to right, with each entry establishing a
 * new coordinate system for the ones that follow, so the accumulated matrix is
 * `t1 * t2 * ... * tn`. Unknown or malformed functions are skipped rather than
 * throwing: a bad transform should degrade to "unmoved", not lose the drawing.
 */
export function parseTransform(value: string | null | undefined): Matrix {
  if (!value) return IDENTITY;

  let result = IDENTITY;
  const pattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const name = match[1]!.toLowerCase();
    const args = numbers(match[2]!);
    const step = transformToMatrix(name, args);
    if (step) result = multiply(result, step);
  }

  return result;
}

function transformToMatrix(name: string, n: number[]): Matrix | null {
  switch (name) {
    case 'matrix':
      if (n.length < 6) return null;
      return { a: n[0]!, b: n[1]!, c: n[2]!, d: n[3]!, e: n[4]!, f: n[5]! };

    case 'translate':
      if (n.length < 1) return null;
      return { ...IDENTITY, e: n[0]!, f: n[1] ?? 0 };

    case 'scale': {
      if (n.length < 1) return null;
      const sx = n[0]!;
      // A single argument scales both axes uniformly.
      return { ...IDENTITY, a: sx, d: n[1] ?? sx };
    }

    case 'rotate': {
      if (n.length < 1) return null;
      const angle = n[0]! * RAD;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotation: Matrix = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
      if (n.length < 3) return rotation;
      // rotate(angle cx cy) is shorthand for translate, rotate, translate back.
      const cx = n[1]!;
      const cy = n[2]!;
      return multiply(multiply({ ...IDENTITY, e: cx, f: cy }, rotation), {
        ...IDENTITY,
        e: -cx,
        f: -cy,
      });
    }

    case 'skewx':
      if (n.length < 1) return null;
      return { ...IDENTITY, c: Math.tan(n[0]! * RAD) };

    case 'skewy':
      if (n.length < 1) return null;
      return { ...IDENTITY, b: Math.tan(n[0]! * RAD) };

    default:
      return null;
  }
}
