import { describe, expect, it } from 'vitest';
import { parseSvg } from '../src/parse/index.js';
import { createSpec, createTrack } from '../src/spec.js';
import { toCss } from '../src/render/css.js';
import { toSvg } from '../src/render/svg.js';
import { toLottie } from '../src/render/lottie.js';
import { flattenGradient, isSimilarity } from '../src/render/gradient.js';
import type { LinearGradient, RadialGradient, SvgNode } from '../src/types.js';
import { fixture, itemAs, itemsOf } from './helpers.js';

const parsed = () => parseSvg(fixture('gradients.svg'));

function node(id: string): SvgNode {
  const found = parsed().nodes.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No node "${id}" in the gradients fixture`);
  return found;
}

describe('parseSvg with gradients', () => {
  it('resolves an objectBoundingBox gradient against the shape it paints', () => {
    const gradient = node('backdrop').paint.fillGradient as LinearGradient;

    expect(gradient.type).toBe('linear');
    // Coordinates stay in the unit square; the box lives in the transform.
    expect(gradient.start).toEqual({ x: 0, y: 0 });
    expect(gradient.end).toEqual({ x: 1, y: 1 });
    expect(gradient.transform).toEqual([100, 0, 0, 50, 0, 0]);
  });

  it('keeps userSpaceOnUse coordinates as authored', () => {
    const gradient = node('sun-disc').paint.fillGradient as RadialGradient;

    expect(gradient.type).toBe('radial');
    expect(gradient.center).toEqual({ x: 20, y: 20 });
    expect(gradient.radius).toBe(10);
    expect(gradient.focus).toEqual({ x: 16, y: 18 });
    expect(gradient.transform).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('reads stop colours, percentage offsets and stop-opacity', () => {
    expect(node('backdrop').paint.fillGradient?.stops).toEqual([
      { offset: 0, color: '#38bdf8', opacity: 1 },
      { offset: 1, color: '#1e3a8a', opacity: 0.4 },
    ]);
    expect(node('sun-disc').paint.fillGradient?.stops.map((stop) => stop.offset)).toEqual([0, 1]);
  });

  it('inherits stops through an xlink:href chain', () => {
    const borrowed = node('banner').paint.fillGradient!;
    expect(borrowed.stops).toEqual(node('backdrop').paint.fillGradient!.stops);
    // Its own gradientTransform is composed after the bounding box, so the
    // rotation happens in the unit square rather than in viewBox space.
    expect(borrowed.transform).not.toEqual(node('backdrop').paint.fillGradient!.transform);
  });

  it('resolves a gradient on a stroke as well as a fill', () => {
    const edge = node('edge').paint;
    expect(edge.strokeGradient?.type).toBe('radial');
    expect(edge.fillGradient).toBeUndefined();
  });

  it('falls back to the colour named after an unresolvable reference', () => {
    expect(node('patterned').paint.fill).toBe('#64748b');
    expect(node('patterned').paint.fillGradient).toBeUndefined();
  });

  it('warns once per reference, saying which one and why', () => {
    const messages = parsed()
      .warnings.filter((warning) => warning.code === 'unsupported-paint')
      .map((warning) => warning.message);

    expect(messages).toHaveLength(2);
    expect(messages.join('\n')).toContain('"#checks", which is a pattern rather than a gradient');
    expect(messages.join('\n')).toContain('"#nope", which points at an id that is not in this file');
  });

  it('leaves a shape with an unresolvable reference and no fallback unpainted', () => {
    expect(node('missing').paint.fill).toBeNull();
    expect(node('missing').paint.fillGradient).toBeUndefined();
  });

  it('bakes an ancestor transform into the gradient rather than the coordinates', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      <defs>
        <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="10" y2="0">
          <stop offset="0" stop-color="#000" /><stop offset="1" stop-color="#fff" />
        </linearGradient>
      </defs>
      <g transform="translate(5 5) scale(2)">
        <rect id="box" width="10" height="10" fill="url(#g)" />
      </g>
    </svg>`;
    const gradient = parseSvg(svg).nodes[0]!.paint.fillGradient as LinearGradient;

    expect(gradient.end).toEqual({ x: 10, y: 0 });
    expect(gradient.transform).toEqual([2, 0, 0, 2, 5, 5]);
    // Which is the same as having moved the points there.
    expect(flattenGradient(gradient).end).toEqual({ x: 25, y: 5 });
  });

  it('does not resolve an objectBoundingBox gradient against a flat shape', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <defs>
        <linearGradient id="g"><stop offset="0" stop-color="#000" /></linearGradient>
      </defs>
      <path id="line" d="M0 10 20 10" stroke="url(#g)" />
    </svg>`;
    const result = parseSvg(svg);

    expect(result.nodes[0]!.paint.strokeGradient).toBeUndefined();
    expect(result.warnings.map((warning) => warning.message).join('\n')).toContain(
      'bounding box with no width or height',
    );
  });

  it('paints a single-stop gradient as the flat colour it is', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <defs>
        <linearGradient id="g"><stop offset="0.5" stop-color="#ff0000" /></linearGradient>
      </defs>
      <rect id="box" width="20" height="20" fill="url(#g)" />
    </svg>`;

    expect(parseSvg(svg).nodes[0]!.paint.fillGradient?.stops).toEqual([
      { offset: 0, color: '#ff0000', opacity: 1 },
      { offset: 1, color: '#ff0000', opacity: 1 },
    ]);
  });

  it('stops following an href cycle instead of spinning', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <defs>
        <linearGradient id="a" href="#b" />
        <linearGradient id="b" href="#a"><stop offset="0" stop-color="#0f0" /></linearGradient>
      </defs>
      <rect id="box" width="20" height="20" fill="url(#a)" />
    </svg>`;

    expect(parseSvg(svg).nodes[0]!.paint.fillGradient?.stops[0]?.color).toBe('#00ff00');
  });
});

describe('toCss with gradients', () => {
  const spec = () => createSpec(parsed());

  it('declares each gradient once in defs and paints through it', () => {
    const { html } = toCss(spec());

    expect(html).toContain('<defs>');
    expect(html).toContain('<linearGradient id="svgm-gradient-1" gradientUnits="userSpaceOnUse"');
    expect(html).toContain('fill="url(#svgm-gradient-1)"');
    // #sun paints both the disc's fill and the edge's stroke: one definition.
    expect(html.match(/<radialGradient /g)).toHaveLength(1);
    expect(html).toContain('stroke="url(#svgm-gradient-2)"');
  });

  it('writes the composed matrix rather than moving the coordinates', () => {
    const { html } = toCss(spec());
    expect(html).toContain('gradientTransform="matrix(100 0 0 50 0 0)"');
  });

  it('carries stop colour and opacity onto the stops', () => {
    const { html } = toCss(spec());
    expect(html).toContain('<stop offset="0" stop-color="#38bdf8" />');
    expect(html).toContain('<stop offset="1" stop-color="#1e3a8a" stop-opacity="0.4" />');
  });

  it('emits no defs block for artwork without gradients', () => {
    expect(toCss(createSpec(parseSvg(fixture('icon-check.svg')))).html).not.toContain('<defs>');
  });

  it('keeps the defs inside the standalone SVG file', () => {
    const { html } = toSvg(spec());
    expect(html.indexOf('<defs>')).toBeGreaterThan(html.indexOf('<style>'));
    expect(html.indexOf('<defs>')).toBeLessThan(html.indexOf('<path'));
  });
});

describe('toLottie with gradients', () => {
  const spec = () => createSpec(parsed());

  it('exports a gradient fill as a native gf item', () => {
    const fill = itemAs<Record<string, unknown>>(
      itemsOf(toLottie(spec()).animation, 'sun-disc'),
      'gf',
    );

    // 2 is radial. The centre sits at the origin because the group is built
    // around the shape's own centre.
    expect(fill.t).toBe(2);
    expect(fill.s).toEqual({ a: 0, k: [0, 0] });
    expect(fill.e).toEqual({ a: 0, k: [10, 0] });
    expect(fill.g).toEqual({
      p: 2,
      k: { a: 0, k: [0, 0.9922, 0.8784, 0.2784, 1, 0.9765, 0.4510, 0.0863] },
    });
  });

  it('states a moved focal point as a highlight offset', () => {
    const fill = itemAs<{ h: { k: number }; a: { k: number } }>(
      itemsOf(toLottie(spec()).animation, 'sun-disc'),
      'gf',
    );

    // (16,18) is 4.47 from (20,20): 44.7% of the radius, up and to the left.
    expect(fill.h.k).toBeCloseTo(44.72, 1);
    expect(fill.a.k).toBeCloseTo(-153.43, 1);
  });

  it('appends an alpha ramp only when a stop is transparent', () => {
    const { animation } = toLottie(spec());
    const rampOf = (layer: string) =>
      itemAs<{ g: { p: number; k: { k: number[] } } }>(itemsOf(animation, layer), 'gf').g;

    // Two colour stops, then two opacity stops carrying the 0.4.
    const transparent = rampOf('backdrop');
    expect(transparent.p).toBe(2);
    expect(transparent.k.k).toHaveLength(12);
    expect(transparent.k.k.slice(-4)).toEqual([0, 1, 1, 0.4]);

    expect(rampOf('sun-disc').k.k).toHaveLength(8);
  });

  it('exports a gradient stroke as a gs item that keeps the stroke settings', () => {
    const items = itemsOf(toLottie(spec()).animation, 'edge');

    expect(itemAs<{ w: { k: number } }>(items, 'gs').w.k).toBe(2);
    // The solid stroke it replaces must not be written as well.
    expect(items.some((item) => item.ty === 'st')).toBe(false);
  });

  it('says which gradients it had to approximate', () => {
    const messages = toLottie(spec())
      .warnings.filter((warning) => warning.code === 'lottie-unsupported')
      .map((warning) => warning.message)
      .join('\n');

    // backdrop (100x50 box) and banner (100x10, rotated) are both stretched;
    // the two circular ones are not.
    expect(messages).toContain('2 gradient(s) are stretched or skewed');
  });

  it('warns about a spread method it cannot carry', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <defs>
        <linearGradient id="g" x2="0.2" spreadMethod="repeat">
          <stop offset="0" stop-color="#000" /><stop offset="1" stop-color="#fff" />
        </linearGradient>
      </defs>
      <rect id="box" width="20" height="20" fill="url(#g)" />
    </svg>`;
    const messages = toLottie(createSpec(parseSvg(svg)))
      .warnings.map((warning) => warning.message)
      .join('\n');

    expect(messages).toContain('repeat or reflect beyond their end stops');
  });

  it('no longer claims gradients are dropped', () => {
    const messages = toLottie(spec())
      .warnings.map((warning) => warning.message)
      .join('\n');
    expect(messages).not.toContain('exported as no fill');
  });
});

describe('isSimilarity', () => {
  it('accepts rotation, uniform scale and translation', () => {
    expect(isSimilarity([1, 0, 0, 1, 0, 0])).toBe(true);
    expect(isSimilarity([3, 0, 0, 3, 12, -4])).toBe(true);
    expect(isSimilarity([0, 2, -2, 0, 0, 0])).toBe(true);
  });

  it('rejects non-uniform scale and skew', () => {
    expect(isSimilarity([2, 0, 0, 1, 0, 0])).toBe(false);
    expect(isSimilarity([1, 0, 0.5, 1, 0, 0])).toBe(false);
    expect(isSimilarity([0, 0, 0, 0, 0, 0])).toBe(false);
  });
});

describe('stroke draw on a gradient stroke', () => {
  it('is not reported as a missing stroke', () => {
    const spec = createSpec(parsed());
    spec.tracks = [createTrack('edge', 'strokeDraw')];

    const messages = toCss(spec)
      .warnings.filter((warning) => warning.code === 'unsupported-paint')
      .map((warning) => warning.message)
      .join('\n');
    expect(messages).not.toContain('has no stroke');
  });
});
