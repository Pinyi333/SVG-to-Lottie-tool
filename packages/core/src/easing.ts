import type { Easing } from './types.js';

/**
 * Named easings, stored as CSS `cubic-bezier(x1, y1, x2, y2)` control values.
 *
 * Keeping one source of truth for easing is what lets the CSS and Lottie
 * exporters stay visually identical: CSS consumes these numbers directly,
 * and Lottie keyframe handles are derived from the same four values.
 */
export const EASINGS = {
  linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
  ease: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  easeIn: { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  easeOut: { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  easeInOut: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  /** Overshoots slightly on the way in, the standard "snappy" UI curve. */
  easeOutBack: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
  easeInOutCubic: { x1: 0.65, y1: 0, x2: 0.35, y2: 1 },
} as const satisfies Record<string, Easing>;

export type EasingName = keyof typeof EASINGS;

export const EASING_NAMES = Object.keys(EASINGS) as EasingName[];

export function easing(name: EasingName): Easing {
  return { ...EASINGS[name] };
}

/** Serializes to a CSS `animation-timing-function` value. */
export function toCssEasing(e: Easing): string {
  if (e.x1 === 0 && e.y1 === 0 && e.x2 === 1 && e.y2 === 1) return 'linear';
  const round = (n: number) => Number(n.toFixed(4));
  return `cubic-bezier(${round(e.x1)}, ${round(e.y1)}, ${round(e.x2)}, ${round(e.y2)})`;
}

/** Lottie's per-keyframe bezier handle, normalized to the 0..1 value range. */
export interface LottieHandle {
  x: number;
  y: number;
}

/**
 * Splits an easing into the pair of handles Lottie stores on its keyframes.
 *
 * Lottie models interpolation as a bezier between consecutive keyframes, with
 * the outgoing handle `o` on the earlier frame and the incoming handle `i` on
 * the later one. That is the same curve CSS describes, just distributed across
 * two objects: `o` carries the first control point and `i` the second.
 *
 * Lottie clamps handle coordinates to (0, 1), so easings that overshoot — such
 * as `easeOutBack` — lose their overshoot in Lottie output. The clamp is
 * applied here rather than silently producing a file players reject.
 */
export function toLottieHandles(e: Easing): { out: LottieHandle; in: LottieHandle } {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  // The epsilon keeps handles off the exact 0/1 bounds, which some players
  // treat as a degenerate curve and fall back to linear for.
  const safe = (n: number) => Math.min(0.999, Math.max(0.001, clamp(n)));

  return {
    out: { x: safe(e.x1), y: clamp(e.y1) },
    in: { x: safe(e.x2), y: clamp(e.y2) },
  };
}

/**
 * Evaluates a cubic-bezier easing at progress `t`, returning eased progress.
 *
 * Used by exporters that have to bake intermediate values themselves — the
 * bounce preset samples this to build its arc — rather than handing the curve
 * to a player. Newton-Raphson with a bisection fallback converges to well
 * under a frame's worth of error at any realistic frame rate.
 */
export function evaluateEasing(e: Easing, t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const curve = (a: number, b: number, u: number) => {
    const mu = 1 - u;
    return 3 * mu * mu * u * a + 3 * mu * u * u * b + u * u * u;
  };
  const slope = (a: number, b: number, u: number) => {
    const mu = 1 - u;
    return 3 * mu * mu * a + 6 * mu * u * (b - a) + 3 * u * u * (1 - b);
  };

  let u = t;
  for (let i = 0; i < 8; i += 1) {
    const error = curve(e.x1, e.x2, u) - t;
    if (Math.abs(error) < 1e-7) return curve(e.y1, e.y2, u);
    const derivative = slope(e.x1, e.x2, u);
    if (Math.abs(derivative) < 1e-7) break;
    u -= error / derivative;
  }

  let low = 0;
  let high = 1;
  u = t;
  for (let i = 0; i < 24; i += 1) {
    const x = curve(e.x1, e.x2, u);
    if (Math.abs(x - t) < 1e-7) break;
    if (x > t) high = u;
    else low = u;
    u = (low + high) / 2;
  }
  return curve(e.y1, e.y2, u);
}
