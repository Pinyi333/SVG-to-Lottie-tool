import { afterEach, describe, expect, it } from 'vitest';
import lottie from 'lottie-web';
import { parseSvg } from '../src/parse/index.js';
import { animateAll, createSpec, createTrack } from '../src/spec.js';
import { toLottie } from '../src/render/lottie.js';
import { PRESET_NAMES } from '../src/presets/index.js';
import { fixture } from './helpers.js';

/**
 * Structural assertions prove the JSON has the right shape. They do not prove
 * a player will accept it — a wrong property code or a malformed keyframe
 * passes every snapshot and still renders nothing. These tests load the output
 * into lottie-web itself and check it builds a real render tree.
 */

const containers: HTMLElement[] = [];

function play(animationData: unknown) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  containers.push(container);

  const errors: unknown[] = [];
  const instance = lottie.loadAnimation({
    container,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    animationData: JSON.parse(JSON.stringify(animationData)),
  });
  instance.addEventListener('error', (event) => errors.push(event));

  return { instance, container, errors };
}

afterEach(() => {
  for (const container of containers.splice(0)) container.remove();
});

describe('lottie-web accepts the exported files', () => {
  it.each(PRESET_NAMES)('plays a %s animation end to end', (preset) => {
    const spec = createSpec(parseSvg(fixture('icon-check.svg')));
    spec.tracks = [createTrack('tick', preset, { duration: 1 })];

    const { animation } = toLottie(spec);
    const { instance, container, errors } = play(animation);

    expect(errors).toHaveLength(0);
    expect(instance.totalFrames).toBe(60);

    // The renderer only builds its DOM once a frame has been drawn.
    instance.goToAndStop(0, true);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);

    // Stepping through the timeline must not throw on any frame.
    for (const frame of [0, 15, 30, 45, 59]) {
      expect(() => instance.goToAndStop(frame, true)).not.toThrow();
    }
    expect(errors).toHaveLength(0);

    instance.destroy();
  });

  it('renders every shape of a multi-shape document', () => {
    const parsed = parseSvg(fixture('shapes.svg'));
    const spec = animateAll(createSpec(parsed), 'fade', { duration: 1 });

    const { animation } = toLottie(spec);
    const { instance, container, errors } = play(animation);
    instance.goToAndStop(animation.op - 1, true);

    expect(errors).toHaveLength(0);
    // One group per source shape survives into the render tree.
    expect(container.querySelectorAll('g[class], g').length).toBeGreaterThanOrEqual(
      parsed.nodes.length,
    );
    instance.destroy();
  });

  it('reports the frame count the spec asked for', () => {
    const spec = createSpec(parseSvg(fixture('icon-check.svg')), { fps: 30 });
    spec.tracks = [createTrack('tick', 'fade', { duration: 2, delay: 0.5 })];

    const { animation } = toLottie(spec);
    const { instance } = play(animation);
    // 2.5s at 30fps.
    expect(instance.totalFrames).toBe(75);
    instance.destroy();
  });

  it('plays a baked ping-pong without error at the seam', () => {
    const spec = createSpec(parseSvg(fixture('icon-check.svg')));
    spec.tracks = [
      createTrack('tick', 'scale', { duration: 1, loop: { mode: 'pingpong', count: 2 } }),
    ];

    const { animation } = toLottie(spec);
    const { instance, errors } = play(animation);
    expect(instance.totalFrames).toBe(240);
    for (let frame = 0; frame < 240; frame += 20) {
      expect(() => instance.goToAndStop(frame, true)).not.toThrow();
    }
    expect(errors).toHaveLength(0);
    instance.destroy();
  });
});
