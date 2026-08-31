import type { Easing } from '../types.js';

/**
 * The animatable properties a preset can drive.
 *
 * Presets never emit CSS or Lottie directly. They emit channels, and each
 * exporter knows how to express a channel in its own format. That is what
 * keeps "add a preset" from meaning "touch five exporters", and what keeps
 * the exporters agreeing on what a preset looks like.
 */
export type ChannelName =
  /** 0..1 opacity multiplier. */
  | 'opacity'
  /** Uniform scale factor; 1 is natural size. */
  | 'scale'
  /** Rotation in degrees, clockwise, about the element's bounding-box centre. */
  | 'rotation'
  | 'translateX'
  | 'translateY'
  /** 0..1 fraction of the outline where the visible stroke begins. */
  | 'trimStart'
  /** 0..1 fraction of the outline where the visible stroke ends. */
  | 'trimEnd';

export interface Keyframe {
  /** Position within the track, 0 at its start and 1 at its end. */
  t: number;
  value: number;
  /**
   * Easing from this keyframe to the next one. Presets set this only where
   * the segment needs a different curve than the track's — a bounce needs to
   * decelerate on the way up and accelerate on the way down.
   */
  easing?: Easing;
}

export interface Channel {
  name: ChannelName;
  keyframes: Keyframe[];
}

/** The value a channel holds when nothing animates it. */
export const CHANNEL_RESTING_VALUE: Record<ChannelName, number> = {
  opacity: 1,
  scale: 1,
  rotation: 0,
  translateX: 0,
  translateY: 0,
  trimStart: 0,
  trimEnd: 1,
};

/** True when the channel is expressed through a CSS `transform` function. */
export function isTransformChannel(name: ChannelName): boolean {
  return name === 'scale' || name === 'rotation' || name === 'translateX' || name === 'translateY';
}
