import { describe, expect, it } from 'vitest';
import { parseSvg } from '../src/parse/index.js';
import { createSpec, createTrack } from '../src/spec.js';
import { toCss } from '../src/render/css.js';
import { toSvg } from '../src/render/svg.js';
import { toLottie } from '../src/render/lottie.js';
import { fixture } from './helpers.js';

function specFor(tracks: ReturnType<typeof createTrack>[]) {
  const spec = createSpec(parseSvg(fixture('icon-check.svg')));
  spec.tracks = tracks;
  return spec;
}

describe('toCss with hover-triggered tracks', () => {
  it('puts the animation behind :hover on a root class', () => {
    const { css, html } = toCss(specFor([createTrack('tick', 'fade', { trigger: 'hover' })]));
    expect(css).toContain('.svgm-icon:hover .svgm-tick {');
    expect(html).toContain('<svg class="svgm-icon"');
    // The resting rule must not autoplay what only hover should start.
    expect(css).not.toMatch(/^\.svgm-tick \{[^}]*animation:/m);
  });

  it('re-lists always-on animations inside the hover rule', () => {
    const { css } = toCss(
      specFor([
        createTrack('tick', 'fade'),
        createTrack('tick', 'strokeDraw', { trigger: 'hover' }),
      ]),
    );
    // Base rule keeps the fade.
    expect(css).toMatch(/\.svgm-tick \{[^}]*animation: svgm-tick-fade/);
    // Hover rule carries both, or setting `animation` would cancel the fade.
    const hover = /\.svgm-icon:hover \.svgm-tick \{[^}]*\}/.exec(css)![0];
    expect(hover).toContain('svgm-tick-fade');
    expect(hover).toContain('svgm-tick-strokeDraw');
  });

  it('adds no root class when nothing is hover-triggered', () => {
    const { html } = toCss(specFor([createTrack('tick', 'fade')]));
    expect(html).not.toContain('svgm-icon');
  });
});

describe('toCss with scroll-triggered tracks', () => {
  it('drives the animation from a view() timeline', () => {
    const { css } = toCss(specFor([createTrack('tick', 'strokeDraw', { trigger: 'scroll' })]));
    expect(css).toMatch(/\.svgm-tick \{[^}]*animation: svgm-tick-strokeDraw/);
    expect(css).toContain('animation-timeline: view();');
  });

  it('pairs each animation with its own timeline entry when mixed', () => {
    const { css } = toCss(
      specFor([
        createTrack('tick', 'fade'),
        createTrack('tick', 'strokeDraw', { trigger: 'scroll' }),
      ]),
    );
    const rule = /\.svgm-tick \{[^}]*\}/.exec(css)![0];
    expect(rule).toContain('animation: svgm-tick-fade');
    expect(rule).toContain('svgm-tick-strokeDraw');
    expect(rule).toContain('animation-timeline: auto, view();');
  });
});

describe('toSvg with scroll-triggered tracks', () => {
  it('warns that an image embed has no scroller', () => {
    const { warnings } = toSvg(specFor([createTrack('tick', 'fade', { trigger: 'scroll' })]));
    expect(warnings.some((w) => w.code === 'trigger-unsupported')).toBe(true);
  });
});

describe('toLottie with hover-triggered tracks', () => {
  it('drops them with a warning instead of baking them as autoplay', () => {
    const { animation, warnings } = toLottie(
      specFor([createTrack('tick', 'fade', { trigger: 'hover' })]),
    );
    expect(warnings.some((w) => w.code === 'lottie-unsupported' && /hover/i.test(w.message))).toBe(
      true,
    );
    // The opacity stays static: the hover fade must not play on load.
    const layer = animation.layers[0]!;
    expect((layer.ks.o as { a: number }).a).toBe(0);
  });

  it('does not report a loop for a file whose only loop is hover-triggered', () => {
    const { loop } = toLottie(
      specFor([createTrack('tick', 'fade', { trigger: 'hover', loop: { mode: 'loop' } })]),
    );
    expect(loop).toBe(false);
  });

  it('drops scroll tracks with the same warning', () => {
    const { animation, warnings } = toLottie(
      specFor([createTrack('tick', 'fade', { trigger: 'scroll' })]),
    );
    expect(warnings.some((w) => w.code === 'lottie-unsupported' && /scroll/i.test(w.message))).toBe(
      true,
    );
    expect((animation.layers[0]!.ks.o as { a: number }).a).toBe(0);
  });

  it('keeps auto tracks playing when a hover track is dropped', () => {
    const { animation } = toLottie(
      specFor([
        createTrack('tick', 'fade'),
        createTrack('tick', 'strokeDraw', { trigger: 'hover' }),
      ]),
    );
    const layer = animation.layers[0]!;
    expect((layer.ks.o as { a: number }).a).toBe(1);
  });
});
