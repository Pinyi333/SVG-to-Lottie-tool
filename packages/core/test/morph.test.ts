import { describe, expect, it } from 'vitest';
import { parseSvg } from '../src/parse/index.js';
import {
  alignForMorph,
  interpolateSubpaths,
  parseMorphTarget,
  resolveMorph,
} from '../src/parse/morph.js';
import { createSpec, createTrack } from '../src/spec.js';
import { toCss } from '../src/render/css.js';
import { toLottie } from '../src/render/lottie.js';
import { fixture } from './helpers.js';

/** A square, drawn as one closed subpath in the shapes.svg viewBox. */
const SQUARE = 'M60 10 L80 10 L80 30 L60 30 Z';
/** A triangle: same subpath count as the square, fewer segments than a circle. */
const TRIANGLE = 'M70 10 L80 30 L60 30 Z';
/** Two separate subpaths, used to trigger the mismatch warning. */
const TWO_PARTS = 'M0 0 L10 0 M20 0 L30 0';

function specFor(name: string, tracks: ReturnType<typeof createTrack>[]) {
  const spec = createSpec(parseSvg(fixture(name)));
  spec.tracks = tracks;
  return spec;
}

describe('alignForMorph', () => {
  it('subdivides the poorer side until segment counts match', () => {
    const from = parseMorphTarget(TRIANGLE);
    const to = parseMorphTarget(SQUARE);
    const aligned = alignForMorph(from, to)!;
    expect(aligned).not.toBeNull();
    expect(aligned.from[0]!.segments.length).toBe(aligned.to[0]!.segments.length);
  });

  it('preserves the drawn endpoints when subdividing', () => {
    const from = parseMorphTarget(TRIANGLE);
    const to = parseMorphTarget(SQUARE);
    const aligned = alignForMorph(from, to)!;
    const original = from[0]!;
    const subdivided = aligned.from[0]!;
    expect(subdivided.start).toEqual(original.start);
    const lastBefore = original.segments[original.segments.length - 1]!.end;
    const lastAfter = subdivided.segments[subdivided.segments.length - 1]!.end;
    expect(lastAfter).toEqual(lastBefore);
  });

  it('refuses to pair mismatched subpath counts', () => {
    expect(alignForMorph(parseMorphTarget(SQUARE), parseMorphTarget(TWO_PARTS))).toBeNull();
  });

  it('interpolates endpoints exactly at 0 and 1 and midpoints halfway', () => {
    const from = parseMorphTarget('M0 0 L10 0');
    const to = parseMorphTarget('M0 10 L10 10');
    const aligned = alignForMorph(from, to)!;
    expect(interpolateSubpaths(aligned.from, aligned.to, 0)).toEqual(aligned.from);
    expect(interpolateSubpaths(aligned.from, aligned.to, 1)).toEqual(aligned.to);
    const half = interpolateSubpaths(aligned.from, aligned.to, 0.5);
    expect(half[0]!.start.y).toBeCloseTo(5);
  });
});

describe('morph preset validation', () => {
  it('warns when the target is missing', () => {
    const spec = specFor('shapes.svg', [createTrack('dot', 'morph')]);
    const { warnings } = toCss(spec);
    expect(warnings.some((w) => w.code === 'morph-mismatch')).toBe(true);
  });

  it('warns when subpath counts differ', () => {
    const spec = specFor('shapes.svg', [
      createTrack('dot', 'morph', { params: { toPath: TWO_PARTS } }),
    ]);
    const { warnings } = toCss(spec);
    expect(warnings.some((w) => w.code === 'morph-mismatch')).toBe(true);
  });

  it('accepts a well-formed target silently', () => {
    const spec = specFor('shapes.svg', [
      createTrack('dot', 'morph', { params: { toPath: SQUARE } }),
    ]);
    const { warnings } = toCss(spec);
    expect(warnings.filter((w) => w.code === 'morph-mismatch')).toEqual([]);
  });
});

describe('toCss with a morph track', () => {
  it('emits d: path() keyframes ending on the target geometry', () => {
    const spec = specFor('shapes.svg', [
      createTrack('dot', 'morph', { params: { toPath: SQUARE } }),
    ]);
    const { css } = toCss(spec);
    expect(css).toContain('@keyframes svgm-dot-morph');
    expect(css).toContain('d: path("');
    // The 100% stop holds the square's first vertex.
    expect(css).toMatch(/100% \{\s*d: path\("M60 10/);
  });

  it('keeps the base markup structurally identical to the keyframe stops', () => {
    const spec = specFor('shapes.svg', [
      createTrack('dot', 'morph', { params: { toPath: SQUARE } }),
    ]);
    const { css, html } = toCss(spec);
    const baseD = /d="([^"]+)"/.exec(html)![1]!;
    const stopD = /d: path\("([^"]+)"\)/.exec(css)![1]!;
    const commands = (d: string) => d.match(/[MCZ]/g)!.join('');
    // Same command skeleton is what lets the browser interpolate the stops.
    expect(commands(stopD)).toBe(commands(baseD));
  });

  it('falls back to the unmorphed shape when the target cannot be paired', () => {
    const spec = specFor('shapes.svg', [
      createTrack('dot', 'morph', { params: { toPath: TWO_PARTS } }),
    ]);
    const { css } = toCss(spec);
    expect(css).not.toContain('d: path("');
  });
});

describe('toLottie with a morph track', () => {
  it('emits animated shape keyframes with constant vertex counts', () => {
    const spec = specFor('shapes.svg', [
      createTrack('dot', 'morph', { params: { toPath: SQUARE } }),
    ]);
    const { animation, warnings } = toLottie(spec);
    expect(warnings.filter((w) => w.code === 'morph-mismatch')).toEqual([]);

    const layer = animation.layers.find((l) => l.nm === 'dot')!;
    const path = layer.shapes[0]!.it as { ty: string; ks: { a: number; k: unknown } }[];
    const shape = path.find((item) => item.ty === 'sh')!;
    expect(shape.ks.a).toBe(1);

    const keyframes = shape.ks.k as { t: number; s: { v: unknown[] }[] }[];
    expect(keyframes.length).toBeGreaterThanOrEqual(2);
    const counts = keyframes.map((k) => k.s[0]!.v.length);
    expect(new Set(counts).size).toBe(1);
  });

  it('keeps static paths when nothing morphs', () => {
    const spec = specFor('shapes.svg', [createTrack('dot', 'fade')]);
    const { animation } = toLottie(spec);
    const layer = animation.layers.find((l) => l.nm === 'dot')!;
    const path = (layer.shapes[0]!.it as { ty: string; ks: { a: number } }[]).find(
      (item) => item.ty === 'sh',
    )!;
    expect(path.ks.a).toBe(0);
  });
});

describe('resolveMorph', () => {
  it('returns null for a blank or unparsable target', () => {
    const subpaths = parseMorphTarget(SQUARE);
    expect(resolveMorph(undefined, subpaths)).toBeNull();
    expect(resolveMorph('   ', subpaths)).toBeNull();
    expect(resolveMorph('not a path', subpaths)).toBeNull();
  });
});
