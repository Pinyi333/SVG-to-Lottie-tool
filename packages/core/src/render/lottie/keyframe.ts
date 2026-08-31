import { toLottieHandles } from '../../easing.js';
import type { AbsoluteKeyframe } from '../../timeline.js';

/** A Lottie animated property: `a: 1` plus a list of keyframes in `k`. */
export interface LottieAnimatedProperty {
  a: 1;
  k: LottieKeyframe[];
  ix?: number;
}

/** A Lottie static property: `a: 0` and a plain value in `k`. */
export interface LottieStaticProperty<T = number | number[]> {
  a: 0;
  k: T;
  ix?: number;
}

export type LottieProperty<T = number | number[]> =
  LottieAnimatedProperty | LottieStaticProperty<T>;

export interface LottieKeyframe {
  /** Frame number this keyframe sits on. */
  t: number;
  /** Value at this keyframe, always an array even for scalars. */
  s?: number[];
  /** Outgoing bezier handle towards the next keyframe. */
  o?: { x: number[]; y: number[] };
  /** Incoming bezier handle from the previous keyframe. */
  i?: { x: number[]; y: number[] };
  /** Hold interpolation: 1 keeps the value until the next keyframe. */
  h?: number;
}

const round = (n: number): number => Number(n.toFixed(4));

/**
 * Builds an animated Lottie property from timeline keyframes.
 *
 * Lottie splits the interpolation curve across two objects: the outgoing
 * handle lives on the earlier keyframe and the incoming handle on the later
 * one. Both are taken from the same easing so the curve is continuous, and
 * `transform` maps a channel value onto the shape the property expects — a
 * scale is a percentage pair, a position is a coordinate pair.
 */
export function animatedProperty(
  keyframes: AbsoluteKeyframe[],
  fps: number,
  transform: (value: number) => number[],
  propertyIndex?: number,
): LottieAnimatedProperty {
  const out: LottieKeyframe[] = [];

  keyframes.forEach((keyframe, index) => {
    const next = keyframes[index + 1];
    const frame: LottieKeyframe = {
      t: round(keyframe.time * fps),
      s: transform(keyframe.value).map(round),
    };

    if (next) {
      const handles = toLottieHandles(keyframe.easing);
      frame.o = { x: [handles.out.x], y: [handles.out.y] };
      frame.i = { x: [handles.in.x], y: [handles.in.y] };
    }

    // Two keyframes on the same frame make players pick arbitrarily between
    // them; keep the later value, which is the one that should win.
    const previous = out[out.length - 1];
    if (previous && previous.t === frame.t) out[out.length - 1] = frame;
    else out.push(frame);
  });

  return { a: 1, k: out, ...(propertyIndex !== undefined ? { ix: propertyIndex } : {}) };
}

export function staticProperty<T extends number | number[]>(
  value: T,
  propertyIndex?: number,
): LottieStaticProperty<T> {
  return { a: 0, k: value, ...(propertyIndex !== undefined ? { ix: propertyIndex } : {}) };
}

/**
 * Builds an animated property whose value has more than one component.
 *
 * Lottie's position is a single two-component property, so two independent
 * translation channels cannot be animated separately — they have to be
 * sampled onto one shared set of keyframes and emitted together.
 */
export function animatedVectorProperty(
  times: number[],
  valueAt: (time: number) => number[],
  easingAt: (time: number) => AbsoluteKeyframe['easing'],
  fps: number,
  propertyIndex?: number,
): LottieAnimatedProperty {
  const out: LottieKeyframe[] = [];

  times.forEach((time, index) => {
    const frame: LottieKeyframe = {
      t: round(time * fps),
      s: valueAt(time).map(round),
    };

    if (index < times.length - 1) {
      const handles = toLottieHandles(easingAt(time));
      frame.o = { x: [handles.out.x], y: [handles.out.y] };
      frame.i = { x: [handles.in.x], y: [handles.in.y] };
    }

    const previous = out[out.length - 1];
    if (previous && previous.t === frame.t) out[out.length - 1] = frame;
    else out.push(frame);
  });

  return { a: 1, k: out, ...(propertyIndex !== undefined ? { ix: propertyIndex } : {}) };
}

/**
 * Reads a timeline channel at an arbitrary time by linear interpolation.
 *
 * Used only when two channels have to share a keyframe set: the easing between
 * the original keyframes is preserved separately, so sampling linearly here
 * introduces no error at the keyframes themselves.
 */
export function sampleAt(keyframes: AbsoluteKeyframe[], time: number): number {
  if (keyframes.length === 0) return 0;
  const first = keyframes[0]!;
  const last = keyframes[keyframes.length - 1]!;
  if (time <= first.time) return first.value;
  if (time >= last.time) return last.value;

  for (let i = 1; i < keyframes.length; i += 1) {
    const previous = keyframes[i - 1]!;
    const next = keyframes[i]!;
    if (time <= next.time) {
      const span = next.time - previous.time;
      const ratio = span === 0 ? 0 : (time - previous.time) / span;
      return previous.value + (next.value - previous.value) * ratio;
    }
  }
  return last.value;
}
