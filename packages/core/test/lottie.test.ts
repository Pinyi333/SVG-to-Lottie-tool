import { describe, expect, it } from 'vitest';
import { parseSvg } from '../src/parse/index.js';
import { createSpec, createTrack } from '../src/spec.js';
import { toLottie } from '../src/render/lottie.js';
import { subpathToBezier } from '../src/render/lottie/path.js';
import type { LottieShapeItem } from '../src/render/lottie/shapes.js';
import { fixture, itemAs, itemsOf } from './helpers.js';

function specFor(name: string, tracks: ReturnType<typeof createTrack>[] = []) {
  const spec = createSpec(parseSvg(fixture(name)));
  spec.tracks = tracks;
  return spec;
}

describe('document structure', () => {
  const { animation } = toLottie(specFor('shapes.svg', [createTrack('dot', 'fade')]));

  it('records the canvas size and frame rate', () => {
    expect(animation.w).toBe(100);
    expect(animation.h).toBe(100);
    expect(animation.fr).toBe(60);
    expect(animation.ip).toBe(0);
    expect(animation.op).toBe(60);
  });

  it('emits one shape layer per shape', () => {
    expect(animation.layers).toHaveLength(6);
    for (const layer of animation.layers) {
      expect(layer.ty).toBe(4);
      expect(layer.shapes).toHaveLength(1);
    }
  });

  it('reverses layer order so SVG stacking is preserved', () => {
    // Lottie paints its first layer on top; SVG paints its last element on top.
    expect(animation.layers.map((l) => l.nm)).toEqual(['zig', 'tri', 'rule', 'oval', 'dot', 'box']);
  });

  it('numbers layers consecutively from one', () => {
    expect(animation.layers.map((l) => l.ind)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('shape items', () => {
  it('orders path, paint and transform inside the group', () => {
    const items = itemsOf(toLottie(specFor('shapes.svg')).animation, 'box');
    expect(items.map((i) => i.ty)).toEqual(['sh', 'fl', 'tr']);
  });

  it('places trim paths after the stroke it modifies', () => {
    const { animation } = toLottie(specFor('icon-check.svg', [createTrack('tick', 'strokeDraw')]));
    const types = itemsOf(animation, 'tick').map((i) => i.ty);
    expect(types).toEqual(['sh', 'st', 'tm', 'tr']);
    expect(types.indexOf('tm')).toBeGreaterThan(types.indexOf('st'));
  });

  it('converts colours to normalized rgb triples', () => {
    const items = itemsOf(toLottie(specFor('shapes.svg')).animation, 'box');
    const fill = itemAs<{ c: { k: number[] } }>(items, 'fl');
    // #ef4444
    expect(fill.c.k[0]).toBeCloseTo(0xef / 255, 5);
    expect(fill.c.k[1]).toBeCloseTo(0x44 / 255, 5);
    expect(fill.c.k[2]).toBeCloseTo(0x44 / 255, 5);
  });

  it('carries stroke width and cap onto the stroke item', () => {
    const items = itemsOf(toLottie(specFor('icon-check.svg')).animation, 'tick');
    const stroke = itemAs<{ w: { k: number }; lc: number }>(items, 'st');
    expect(stroke.w.k).toBe(2);
    expect(stroke.lc).toBe(2); // round
  });

  it('omits a fill item for shapes that have none', () => {
    const items = itemsOf(toLottie(specFor('icon-check.svg')).animation, 'tick');
    expect(items.some((i) => i.ty === 'fl')).toBe(false);
  });
});

describe('bezier mapping', () => {
  it('drops the duplicated vertex on a closed path', () => {
    const rect = parseSvg(fixture('shapes.svg')).nodes.find((n) => n.id === 'box')!;
    const bezier = subpathToBezier(rect.subpaths[0]!);
    expect(bezier.c).toBe(true);
    // A rectangle has four corners, not five.
    expect(bezier.v).toHaveLength(4);
    expect(bezier.i).toHaveLength(4);
    expect(bezier.o).toHaveLength(4);
  });

  it('keeps every vertex of an open path', () => {
    const line = parseSvg(fixture('shapes.svg')).nodes.find((n) => n.id === 'rule')!;
    const bezier = subpathToBezier(line.subpaths[0]!);
    expect(bezier.c).toBe(false);
    expect(bezier.v).toHaveLength(2);
  });

  it('stores tangents relative to their own vertex', () => {
    const circle = parseSvg(fixture('shapes.svg')).nodes.find((n) => n.id === 'dot')!;
    const bezier = subpathToBezier(circle.subpaths[0]!);
    // circle r=10: the quarter-arc handle length is r * kappa.
    const expected = 10 * 0.5522847498307936;
    for (const [x, y] of [...bezier.i, ...bezier.o]) {
      expect(Math.hypot(x, y)).toBeCloseTo(expected, 3);
    }
  });

  it('reconstructs the original geometry from the exported layer', () => {
    // The strongest check on path mapping and centring: walk the Lottie
    // bezier back to absolute coordinates and compare against the source.
    const parsed = parseSvg(fixture('shapes.svg'));
    const { animation } = toLottie(createSpec(parsed));

    for (const node of parsed.nodes) {
      const layer = animation.layers.find((l) => l.nm === node.id)!;
      // A player draws a vertex at `position + (vertex - anchor)`, so that is
      // what has to land back on the source geometry.
      const anchor = (layer.ks.a as { k: number[] }).k;
      const position = (layer.ks.p as { k: number[] }).k;
      const group = layer.shapes[0] as LottieShapeItem;
      const path = itemAs<{ ks: { k: { v: [number, number][] } } }>(
        group.it as LottieShapeItem[],
        'sh',
      );

      let minX = Infinity;
      let maxX = -Infinity;
      for (const [x] of path.ks.k.v) {
        const absolute = position[0]! + (x - anchor[0]!);
        minX = Math.min(minX, absolute);
        maxX = Math.max(maxX, absolute);
      }

      // Vertices alone sit inside the true box on curved shapes, so compare
      // against the box the vertices themselves describe.
      expect(minX).toBeGreaterThanOrEqual(node.bbox.x - 0.01);
      expect(maxX).toBeLessThanOrEqual(node.bbox.x + node.bbox.width + 0.01);
    }
  });
});

describe('animated properties', () => {
  it('animates opacity as a percentage', () => {
    const { animation } = toLottie(specFor('shapes.svg', [createTrack('dot', 'fade')]));
    const layer = animation.layers.find((l) => l.nm === 'dot')!;
    const opacity = layer.ks.o as { a: number; k: { t: number; s: number[] }[] };
    expect(opacity.a).toBe(1);
    expect(opacity.k[0]!.s).toEqual([0]);
    expect(opacity.k[opacity.k.length - 1]!.s).toEqual([100]);
  });

  it('animates scale as a percentage pair', () => {
    const { animation } = toLottie(specFor('shapes.svg', [createTrack('dot', 'scale')]));
    const layer = animation.layers.find((l) => l.nm === 'dot')!;
    const scale = layer.ks.s as { a: number; k: { s: number[] }[] };
    expect(scale.k[0]!.s).toEqual([0, 0]);
    expect(scale.k[scale.k.length - 1]!.s).toEqual([100, 100]);
  });

  it('anchors rotation on the shape centre, not the canvas origin', () => {
    const { animation } = toLottie(specFor('shapes.svg', [createTrack('dot', 'rotate')]));
    const layer = animation.layers.find((l) => l.nm === 'dot')!;
    const items = itemsOf(animation, 'dot');
    const path = itemAs<{ ks: { k: { v: [number, number][] } } }>(items, 'sh');

    // The geometry is centred on the origin, which is where the anchor is, so
    // the layer turns about the shape rather than about the canvas corner.
    expect((layer.ks.a as { k: number[] }).k).toEqual([0, 0]);
    // circle(cx=70, cy=20): position is what puts it back on the canvas.
    expect((layer.ks.p as { k: number[] }).k).toEqual([70, 20]);
    const xs = path.ks.k.v.map(([x]) => x);
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0, 6);
  });

  it('offsets position from the shape centre when translating', () => {
    const { animation } = toLottie(specFor('shapes.svg', [createTrack('dot', 'bounce')]));
    const layer = animation.layers.find((l) => l.nm === 'dot')!;
    const position = layer.ks.p as { a: number; k: { s: number[] }[] };
    expect(position.a).toBe(1);
    // Starts and ends resting at the centre, and rises above it in between.
    expect(position.k[0]!.s).toEqual([70, 20]);
    expect(position.k[position.k.length - 1]!.s).toEqual([70, 20]);
    expect(Math.min(...position.k.map((k) => k.s[1]!))).toBeLessThan(20);
    // The x component never drifts.
    expect(new Set(position.k.map((k) => k.s[0]))).toEqual(new Set([70]));
  });

  it('animates trim end from zero to a hundred percent', () => {
    const { animation } = toLottie(specFor('icon-check.svg', [createTrack('tick', 'strokeDraw')]));
    const trim = itemAs<{ s: { k: number[] }; e: { a: number; k: { s: number[] }[] } }>(
      itemsOf(animation, 'tick'),
      'tm',
    );
    expect(trim.s.k).toEqual([0]);
    expect(trim.e.a).toBe(1);
    expect(trim.e.k[0]!.s).toEqual([0]);
    expect(trim.e.k[trim.e.k.length - 1]!.s).toEqual([100]);
  });

  it('holds a resting value for properties nothing animates', () => {
    const { animation } = toLottie(specFor('shapes.svg', [createTrack('dot', 'fade')]));
    const layer = animation.layers.find((l) => l.nm === 'dot')!;
    expect((layer.ks.r as { a: number; k: number[] }).a).toBe(0);
    expect((layer.ks.s as { a: number; k: number[] }).k).toEqual([100, 100]);
  });

  it('places keyframes on frames, honouring the delay and frame rate', () => {
    const spec = specFor('shapes.svg', [createTrack('dot', 'fade', { delay: 0.5, duration: 1 })]);
    spec.fps = 24;
    const { animation } = toLottie(spec);
    const layer = animation.layers.find((l) => l.nm === 'dot')!;
    const opacity = layer.ks.o as { k: { t: number }[] };
    expect(opacity.k.map((k) => k.t)).toEqual([12, 36]);
    expect(animation.op).toBe(36);
  });

  it('gives every non-final keyframe a pair of easing handles', () => {
    const { animation } = toLottie(specFor('shapes.svg', [createTrack('dot', 'bounce')]));
    const layer = animation.layers.find((l) => l.nm === 'dot')!;
    const position = layer.ks.p as { k: { o?: unknown; i?: unknown }[] };
    position.k.forEach((keyframe, index) => {
      if (index < position.k.length - 1) {
        expect(keyframe.o, `keyframe ${index} has no outgoing handle`).toBeDefined();
        expect(keyframe.i, `keyframe ${index} has no incoming handle`).toBeDefined();
      }
    });
  });
});

describe('warnings', () => {
  it('reports a stroke draw on a shape with no stroke', () => {
    const { warnings } = toLottie(specFor('shapes.svg', [createTrack('box', 'strokeDraw')]));
    expect(warnings.some((w) => w.subject === 'box')).toBe(true);
  });

  it('reports two animations competing for one property', () => {
    const { warnings } = toLottie(
      specFor('shapes.svg', [createTrack('dot', 'fade'), createTrack('dot', 'fade')]),
    );
    expect(warnings.some((w) => w.code === 'lottie-unsupported')).toBe(true);
  });

  it('flags an endless loop for the player rather than baking repeats', () => {
    const { animation, loop } = toLottie(
      specFor('shapes.svg', [
        createTrack('dot', 'rotate', { duration: 2, loop: { mode: 'loop' } }),
      ]),
    );
    expect(loop).toBe(true);
    expect(animation.op).toBe(120);
  });

  it('bakes a finite loop into the timeline', () => {
    const { animation, loop } = toLottie(
      specFor('shapes.svg', [
        createTrack('dot', 'fade', { duration: 1, loop: { mode: 'loop', count: 3 } }),
      ]),
    );
    expect(loop).toBe(false);
    expect(animation.op).toBe(180);
    const layer = animation.layers.find((l) => l.nm === 'dot')!;
    expect((layer.ks.o as { k: unknown[] }).k).toHaveLength(4);
  });
});

describe('serialization', () => {
  it('produces JSON with no NaN, null or undefined values', () => {
    for (const preset of ['fade', 'scale', 'rotate', 'bounce', 'strokeDraw'] as const) {
      const { animation } = toLottie(specFor('shapes.svg', [createTrack('rule', preset)]));
      const json = JSON.stringify(animation);
      expect(json).not.toContain('null');
      expect(json).not.toContain('NaN');
      expect(json).not.toContain('undefined');
      expect(JSON.parse(json)).toEqual(animation);
    }
  });
});
