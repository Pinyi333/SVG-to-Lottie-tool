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

/**
 * Every point the player ended up drawing, in canvas coordinates.
 *
 * lottie-web writes each layer's transform onto the `<g>` elements around the
 * path, so the drawn position is the path data with those matrices applied —
 * which is the only place a mistake in anchor or position becomes visible
 * without a rendering engine.
 */
function drawnPoints(container: HTMLElement): [number, number][] {
  const points: [number, number][] = [];

  for (const path of container.querySelectorAll('path')) {
    let matrix = [1, 0, 0, 1, 0, 0];
    for (let node = path.parentElement; node; node = node.parentElement) {
      const found = /matrix\(([^)]*)\)/.exec(node.getAttribute('transform') ?? '');
      if (!found) continue;
      const m = found[1]!.split(',').map(Number);
      matrix = [
        matrix[0]! * m[0]! + matrix[2]! * m[1]!,
        matrix[1]! * m[0]! + matrix[3]! * m[1]!,
        matrix[0]! * m[2]! + matrix[2]! * m[3]!,
        matrix[1]! * m[2]! + matrix[3]! * m[3]!,
        matrix[0]! * m[4]! + matrix[2]! * m[5]! + matrix[4]!,
        matrix[1]! * m[4]! + matrix[3]! * m[5]! + matrix[5]!,
      ];
    }

    const numbers = (path.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? [];
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      const x = Number(numbers[i]);
      const y = Number(numbers[i + 1]);
      points.push([
        matrix[0]! * x + matrix[2]! * y + matrix[4]!,
        matrix[1]! * x + matrix[3]! * y + matrix[5]!,
      ]);
    }
  }

  return points;
}

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

  it('draws the icon where it sat in the source, not around the origin', () => {
    const spec = createSpec(parseSvg(fixture('icon-check.svg')));
    const { animation } = toLottie(spec);
    const { instance, container, errors } = play(animation);
    instance.goToAndStop(0, true);
    expect(errors).toHaveLength(0);

    // The geometry is exported around the shape's own centre, so it is the
    // layer transform that has to put it back. Getting that wrong draws the
    // icon in the canvas corner, a quarter of it visible — which every
    // snapshot and structural assertion still passes.
    const points = drawnPoints(container);
    expect(points.length).toBeGreaterThan(0);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(animation.w);
      expect(y).toBeLessThanOrEqual(animation.h);
    }

    instance.destroy();
  });

  it('builds real gradient elements from an exported gf item', () => {
    const spec = animateAll(createSpec(parseSvg(fixture('gradients.svg'))), 'fade', {
      duration: 1,
    });

    const { animation } = toLottie(spec);
    const { instance, container, errors } = play(animation);
    instance.goToAndStop(0, true);

    expect(errors).toHaveLength(0);
    // A `gf` item the player did not understand leaves no gradient behind, so
    // the presence of these is what proves the ramp and points were readable.
    const linear = container.querySelectorAll('linearGradient');
    const radial = container.querySelectorAll('radialGradient');
    expect(linear.length).toBe(2);
    expect(radial.length).toBe(2);
    expect(linear[0]!.querySelectorAll('stop').length).toBeGreaterThan(1);

    for (const frame of [0, 10, 25]) {
      expect(() => instance.goToAndStop(frame, true)).not.toThrow();
    }
    expect(errors).toHaveLength(0);
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
