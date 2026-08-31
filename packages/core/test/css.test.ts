import { describe, expect, it } from 'vitest';
import { parseSvg } from '../src/parse/index.js';
import { createSpec, createTrack } from '../src/spec.js';
import { toCss } from '../src/render/css.js';
import { toSvg } from '../src/render/svg.js';
import { fixture } from './helpers.js';

function specFor(name: string, tracks: ReturnType<typeof createTrack>[]) {
  const spec = createSpec(parseSvg(fixture(name)));
  spec.tracks = tracks;
  return spec;
}

describe('toCss', () => {
  it('emits a class, a keyframes block and an animation shorthand', () => {
    const { css, html } = toCss(specFor('icon-check.svg', [createTrack('tick', 'fade')]));
    expect(css).toContain('.svgm-tick');
    expect(css).toContain('@keyframes svgm-tick-fade');
    expect(css).toContain('animation: svgm-tick-fade 1s');
    expect(html).toContain('class="svgm-tick"');
  });

  it('carries the resolved paint onto the generated markup', () => {
    const { html } = toCss(specFor('icon-check.svg', [createTrack('tick', 'fade')]));
    expect(html).toContain('stroke="#2563eb"');
    expect(html).toContain('stroke-width="2"');
    expect(html).toContain('stroke-linecap="round"');
    expect(html).toContain('fill="none"');
  });

  it('pivots transforms on the shape rather than the SVG origin', () => {
    const { css } = toCss(specFor('shapes.svg', [createTrack('dot', 'rotate')]));
    // circle(cx=70, cy=20, r=10) — its own centre, not 0 0.
    expect(css).toContain('transform-origin: 70px 20px;');
    expect(css).toContain('transform-box: view-box;');
  });

  it('drives a stroke draw with a dash the length of the outline', () => {
    const spec = specFor('icon-check.svg', [createTrack('tick', 'strokeDraw')]);
    const { css } = toCss(spec);
    const length = spec.source.nodes[0]!.length;
    expect(css).toContain(`stroke-dasharray: ${Number(length.toFixed(3))};`);
    // Fully hidden at the start, fully drawn at the end.
    expect(css).toMatch(/0% \{\s*stroke-dashoffset: 2[0-9.]+;/);
    expect(css).toContain('stroke-dashoffset: 0;');
  });

  it('reverses the dash offset when drawing from the far end', () => {
    const spec = specFor('icon-check.svg', [
      createTrack('tick', 'strokeDraw', { params: { reverse: true } }),
    ]);
    const { css } = toCss(spec);
    expect(css).toMatch(/stroke-dashoffset: -\d/);
  });

  it('maps an endless loop to infinite iterations', () => {
    const { css } = toCss(
      specFor('shapes.svg', [createTrack('dot', 'rotate', { loop: { mode: 'loop' } })]),
    );
    expect(css).toContain('infinite');
    expect(css).not.toContain('alternate');
  });

  it('maps ping-pong to an alternating iteration', () => {
    const { css } = toCss(
      specFor('shapes.svg', [createTrack('dot', 'scale', { loop: { mode: 'pingpong' } })]),
    );
    expect(css).toContain('alternate');
  });

  it('holds the end state of a non-looping animation', () => {
    const { css } = toCss(specFor('shapes.svg', [createTrack('dot', 'fade')]));
    expect(css).toContain('both');
  });

  it('combines several transform channels into one transform declaration', () => {
    const { css } = toCss(
      specFor('shapes.svg', [createTrack('dot', 'scale'), createTrack('dot', 'rotate')]),
    );
    // Two separate animations, each with its own keyframes, is fine; what is
    // not fine is one keyframe block silently dropping the other's transform.
    const transforms = css.match(/transform: [^;]+;/g) ?? [];
    expect(transforms.length).toBeGreaterThan(0);
    for (const declaration of transforms) {
      expect(declaration).not.toContain('undefined');
      expect(declaration).not.toContain('NaN');
    }
  });

  it('declares a per-keyframe timing function so a bounce reads correctly', () => {
    const { css } = toCss(specFor('shapes.svg', [createTrack('dot', 'bounce')]));
    const timings = css.match(/animation-timing-function: [^;]+;/g) ?? [];
    expect(timings.length).toBeGreaterThan(2);
    expect(new Set(timings).size).toBeGreaterThan(1);
  });

  it('still emits shapes that have no animation on them', () => {
    const { html } = toCss(specFor('shapes.svg', [createTrack('dot', 'fade')]));
    expect(html).toContain('svgm-box');
    expect(html).toContain('svgm-dot');
  });

  it('produces no NaN or undefined anywhere in its output', () => {
    for (const preset of ['fade', 'scale', 'rotate', 'bounce', 'strokeDraw'] as const) {
      const { css, html } = toCss(specFor('shapes.svg', [createTrack('rule', preset)]));
      expect(css).not.toMatch(/NaN|undefined/);
      expect(html).not.toMatch(/NaN|undefined/);
    }
  });
});

describe('toSvg', () => {
  const rendered = toSvg(specFor('icon-check.svg', [createTrack('tick', 'strokeDraw')]), {
    respectReducedMotion: true,
  });

  it('inlines the stylesheet inside the svg root', () => {
    expect(rendered.html.startsWith('<svg')).toBe(true);
    expect(rendered.html).toContain('<style>');
    expect(rendered.html.indexOf('<style>')).toBeLessThan(rendered.html.indexOf('<path'));
    expect(rendered.html.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('honours prefers-reduced-motion when asked to', () => {
    expect(rendered.html).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('parses back as valid SVG containing the same shape', () => {
    const reparsed = parseSvg(rendered.html);
    expect(reparsed.nodes).toHaveLength(1);
    expect(reparsed.warnings.filter((w) => w.code === 'empty-document')).toHaveLength(0);
  });
});
