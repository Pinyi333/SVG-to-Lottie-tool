import type { AnimationSpec, Easing, Track } from './types.js';
import { EASINGS } from './easing.js';
import type { Channel, Keyframe } from './presets/channels.js';

/** A keyframe placed on the spec's absolute timeline, in seconds. */
export interface AbsoluteKeyframe {
  time: number;
  value: number;
  /** Easing from this keyframe to the next. Meaningless on the final one. */
  easing: Easing;
}

/**
 * Length of one cycle of a track, in seconds.
 *
 * A ping-pong cycle is the full there-and-back, because that is the unit a
 * player has to repeat to produce the effect. Baking the return leg into the
 * cycle is what lets an infinitely ping-ponging animation loop correctly in
 * Lottie, which has no alternating playback mode of its own.
 */
export function cycleDuration(track: Track): number {
  return track.loop.mode === 'pingpong' ? track.duration * 2 : track.duration;
}

/** How many cycles a track plays. `Infinity` for an endless loop. */
export function cycleCount(track: Track): number {
  if (track.loop.mode === 'none') return 1;
  return track.loop.count ?? Infinity;
}

/**
 * Seconds of timeline a track occupies.
 *
 * An endlessly looping track contributes a single cycle: the player repeats
 * it, so the file only ever needs to contain one.
 */
export function trackDuration(track: Track): number {
  const cycles = cycleCount(track);
  return track.delay + cycleDuration(track) * (Number.isFinite(cycles) ? cycles : 1);
}

/**
 * Total length of the spec in seconds.
 *
 * `spec.duration` wins when it is long enough to hold every track; otherwise
 * the tracks decide, so that raising a delay cannot silently truncate an
 * animation.
 */
export function specDuration(spec: AnimationSpec): number {
  const longest = spec.tracks.reduce((max, track) => Math.max(max, trackDuration(track)), 0);
  return Math.max(spec.duration, longest, 0.001);
}

/** True when at least one track never stops. */
export function loopsForever(spec: AnimationSpec): boolean {
  return spec.tracks.some((track) => cycleCount(track) === Infinity);
}

/**
 * Flattens a channel onto the absolute timeline, repeating it for each cycle.
 *
 * Exporters that own a real timeline — Lottie — need every repetition present
 * as data. Exporters whose target repeats natively — CSS, with
 * `animation-iteration-count` — use the unexpanded channel instead and keep
 * their output small.
 */
export function expandChannel(channel: Channel, track: Track): AbsoluteKeyframe[] {
  const cycles = Number.isFinite(cycleCount(track)) ? cycleCount(track) : 1;
  const out: AbsoluteKeyframe[] = [];

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const cycleStart = track.delay + cycle * cycleDuration(track);
    appendPass(out, channel.keyframes, cycleStart, track, false);

    if (track.loop.mode === 'pingpong') {
      appendPass(out, channel.keyframes, cycleStart + track.duration, track, true);
    }
  }

  return out;
}

/**
 * Appends one forward or reversed pass of a channel's keyframes.
 *
 * A keyframe landing exactly where the previous pass ended is dropped: two
 * keyframes at the same time make players choose arbitrarily between them,
 * and on a ping-pong the seam produces exactly that collision.
 */
function appendPass(
  out: AbsoluteKeyframe[],
  keyframes: Keyframe[],
  startTime: number,
  track: Track,
  reversed: boolean,
): void {
  const source = reversed ? [...keyframes].reverse() : keyframes;

  for (let i = 0; i < source.length; i += 1) {
    const keyframe = source[i]!;
    const position = reversed ? 1 - keyframe.t : keyframe.t;
    const time = startTime + position * track.duration;

    if (out.length > 0 && Math.abs(out[out.length - 1]!.time - time) < 1e-9) continue;

    // On a reversed pass the easing that governs a segment belongs to the
    // keyframe that now comes first, which is the next one in source order.
    const easingSource = reversed ? source[i + 1] : keyframe;
    out.push({
      time,
      value: keyframe.value,
      easing: easingSource?.easing ?? track.easing,
    });
  }
}

/** Convenience default used by the app and by `createSpec`. */
export const DEFAULT_EASING: Easing = { ...EASINGS.easeInOut };
