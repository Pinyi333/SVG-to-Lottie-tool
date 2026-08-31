import { describe, expect, it } from 'vitest';
import { createSpec, createTrack, resolveSpec } from '../src/spec.js';
import { cycleDuration, expandChannel, specDuration, trackDuration } from '../src/timeline.js';
import { EASINGS, evaluateEasing, toLottieHandles } from '../src/easing.js';
import { PRESETS } from '../src/presets/index.js';
import { parseSvg } from '../src/parse/index.js';
import { fixture } from './helpers.js';

const parsed = () => parseSvg(fixture('shapes.svg'));

describe('easing', () => {
  it('is the identity at both ends of any curve', () => {
    for (const curve of Object.values(EASINGS)) {
      expect(evaluateEasing(curve, 0)).toBe(0);
      expect(evaluateEasing(curve, 1)).toBe(1);
    }
  });

  it('matches the known midpoint of a symmetric ease-in-out', () => {
    expect(evaluateEasing(EASINGS.easeInOut, 0.5)).toBeCloseTo(0.5, 6);
  });

  it('is monotonic for curves that do not overshoot', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const value = evaluateEasing(EASINGS.easeInOut, t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('clamps overshooting handles into the range Lottie accepts', () => {
    // easeOutBack has y1 = 1.56, which Lottie players reject.
    const handles = toLottieHandles(EASINGS.easeOutBack);
    expect(handles.out.y).toBe(1);
    expect(handles.out.x).toBeGreaterThan(0);
    expect(handles.in.x).toBeLessThan(1);
  });
});

describe('track timing', () => {
  it('counts a ping-pong cycle as the full there-and-back', () => {
    const forward = createTrack('a', 'fade', { duration: 2 });
    const pingpong = createTrack('a', 'fade', { duration: 2, loop: { mode: 'pingpong' } });
    expect(cycleDuration(forward)).toBe(2);
    expect(cycleDuration(pingpong)).toBe(4);
  });

  it('gives an endless loop a single cycle of timeline', () => {
    const endless = createTrack('a', 'fade', { duration: 2, loop: { mode: 'loop' } });
    expect(trackDuration(endless)).toBe(2);
  });

  it('lays out every repetition of a finite loop', () => {
    const track = createTrack('a', 'fade', {
      duration: 1,
      delay: 0.5,
      loop: { mode: 'loop', count: 3 },
    });
    expect(trackDuration(track)).toBe(3.5);
  });

  it('never truncates a track to fit a shorter declared duration', () => {
    const spec = createSpec(parsed(), { duration: 1 });
    spec.tracks = [createTrack('box', 'fade', { duration: 2, delay: 1 })];
    expect(specDuration(spec)).toBe(3);
  });
});

describe('expandChannel', () => {
  const channel = PRESETS.fade.build(createTrack('box', 'fade'), parsed().nodes[0]!)[0]!;

  it('places a single pass at the track delay', () => {
    const track = createTrack('box', 'fade', { duration: 2, delay: 0.5 });
    const frames = expandChannel(channel, track);
    expect(frames.map((f) => f.time)).toEqual([0.5, 2.5]);
    expect(frames.map((f) => f.value)).toEqual([0, 1]);
  });

  it('repeats a finite loop without stacking keyframes on the seam', () => {
    const track = createTrack('box', 'fade', { duration: 1, loop: { mode: 'loop', count: 2 } });
    const frames = expandChannel(channel, track);
    // 0 -> 1 then 1 -> 2; the shared keyframe at t=1 appears once.
    expect(frames.map((f) => f.time)).toEqual([0, 1, 2]);
  });

  it('bakes the return leg of a ping-pong so a player can loop it', () => {
    const track = createTrack('box', 'fade', { duration: 1, loop: { mode: 'pingpong' } });
    const frames = expandChannel(channel, track);
    expect(frames.map((f) => f.time)).toEqual([0, 1, 2]);
    expect(frames.map((f) => f.value)).toEqual([0, 1, 0]);
  });
});

describe('bounce preset', () => {
  const node = parsed().nodes[0]!;
  const channel = PRESETS.bounce.build(createTrack(node.id, 'bounce'), node)[0]!;

  it('starts and ends on the floor', () => {
    expect(channel.keyframes[0]!.t).toBe(0);
    expect(channel.keyframes[0]!.value).toBe(0);
    const last = channel.keyframes[channel.keyframes.length - 1]!;
    expect(last.t).toBe(1);
    expect(last.value).toBe(0);
  });

  it('decays each hop', () => {
    const peaks = channel.keyframes.filter((k) => k.value < 0).map((k) => Math.abs(k.value));
    expect(peaks.length).toBe(3);
    for (let i = 1; i < peaks.length; i += 1) {
      expect(peaks[i]!).toBeLessThan(peaks[i - 1]!);
    }
  });

  it('keeps every keyframe inside the track', () => {
    for (const keyframe of channel.keyframes) {
      expect(keyframe.t).toBeGreaterThanOrEqual(0);
      expect(keyframe.t).toBeLessThanOrEqual(1);
    }
  });
});

describe('resolveSpec', () => {
  it('warns about a stroke draw on a shape with no stroke', () => {
    const spec = createSpec(parsed());
    // "box" is a filled rect with no stroke.
    spec.tracks = [createTrack('box', 'strokeDraw')];
    const resolved = resolveSpec(spec);
    expect(resolved.warnings.some((w) => w.subject === 'box')).toBe(true);
  });

  it('drops tracks pointing at shapes that are not in the document', () => {
    const spec = createSpec(parsed());
    spec.tracks = [createTrack('does-not-exist', 'fade')];
    const resolved = resolveSpec(spec);
    expect(resolved.tracks).toHaveLength(0);
    expect(resolved.warnings).toHaveLength(1);
  });
});
