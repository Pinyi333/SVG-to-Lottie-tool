import { describe, expect, it } from 'vitest';
import { parseSvg } from '../src/parse/index.js';
import { boundingBox, subpathsToPathData } from '../src/parse/geometry.js';
import { fixture } from './helpers.js';

describe('parseSvg', () => {
  it('reads the viewBox and keeps element ids', () => {
    const parsed = parseSvg(fixture('icon-check.svg'));
    expect(parsed.viewBox).toEqual({ x: 0, y: 0, width: 24, height: 24 });
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0]!.id).toBe('tick');
    expect(parsed.nodes[0]!.sourceTag).toBe('path');
  });

  it('inherits presentation attributes from the root element', () => {
    const { paint } = parseSvg(fixture('icon-check.svg')).nodes[0]!;
    expect(paint.fill).toBeNull();
    expect(paint.stroke).toBe('#2563eb');
    expect(paint.strokeWidth).toBe(2);
    expect(paint.strokeLinecap).toBe('round');
  });

  it('converts every basic shape to cubic subpaths', () => {
    const parsed = parseSvg(fixture('shapes.svg'));
    expect(parsed.nodes.map((n) => n.id)).toEqual(['box', 'dot', 'oval', 'rule', 'tri', 'zig']);

    for (const node of parsed.nodes) {
      expect(node.subpaths.length).toBeGreaterThan(0);
      for (const subpath of node.subpaths) {
        expect(subpath.segments.length).toBeGreaterThan(0);
      }
    }
  });

  it('marks filled shapes closed and open polylines open', () => {
    const parsed = parseSvg(fixture('shapes.svg'));
    const byId = Object.fromEntries(parsed.nodes.map((n) => [n.id, n]));
    expect(byId['box']!.subpaths[0]!.closed).toBe(true);
    expect(byId['dot']!.subpaths[0]!.closed).toBe(true);
    expect(byId['tri']!.subpaths[0]!.closed).toBe(true);
    expect(byId['rule']!.subpaths[0]!.closed).toBe(false);
    expect(byId['zig']!.subpaths[0]!.closed).toBe(false);
  });

  it('computes an exact bounding box for curved shapes', () => {
    const parsed = parseSvg(fixture('shapes.svg'));
    const dot = parsed.nodes.find((n) => n.id === 'dot')!;
    // circle(cx=70, cy=20, r=10) — control points alone would overshoot this.
    expect(dot.bbox.x).toBeCloseTo(60, 3);
    expect(dot.bbox.y).toBeCloseTo(10, 3);
    expect(dot.bbox.width).toBeCloseTo(20, 3);
    expect(dot.bbox.height).toBeCloseTo(20, 3);
  });

  it('approximates outline length within a fraction of a percent', () => {
    const parsed = parseSvg(fixture('shapes.svg'));
    const dot = parsed.nodes.find((n) => n.id === 'dot')!;
    expect(dot.length).toBeCloseTo(2 * Math.PI * 10, 1);

    const rule = parsed.nodes.find((n) => n.id === 'rule')!;
    expect(rule.length).toBeCloseTo(30, 5);
  });
});

describe('transform handling', () => {
  it('bakes nested translate and scale into the geometry', () => {
    const parsed = parseSvg(fixture('grouped.svg'));
    const inner = parsed.nodes.find((n) => n.id === 'inner')!;
    // rect 6x6 at origin, inside translate(12 12) scale(2) -> 12,12 sized 12x12.
    expect(inner.bbox.x).toBeCloseTo(12, 3);
    expect(inner.bbox.y).toBeCloseTo(12, 3);
    expect(inner.bbox.width).toBeCloseTo(12, 3);
    expect(inner.bbox.height).toBeCloseTo(12, 3);
  });

  it('applies rotation about a point and scales stroke width to match', () => {
    const parsed = parseSvg(fixture('grouped.svg'));
    const rotated = parsed.nodes.find((n) => n.id === 'rotated')!;
    // A 6x6 square rotated 45 degrees has a diagonal-sized box, then scaled 2x.
    const diagonal = 6 * Math.SQRT2 * 2;
    expect(rotated.bbox.width).toBeCloseTo(diagonal, 3);
    expect(rotated.bbox.height).toBeCloseTo(diagonal, 3);
    // stroke-width 1 under scale(2) must render as 2 once the scale is baked in.
    expect(rotated.paint.strokeWidth).toBeCloseTo(2, 6);
  });

  it('multiplies group opacity into its children', () => {
    const parsed = parseSvg(fixture('grouped.svg'));
    expect(parsed.nodes.find((n) => n.id === 'inner')!.paint.opacity).toBeCloseTo(0.5, 6);
  });
});

describe('sanitizing', () => {
  const parsed = parseSvg(fixture('hostile.svg'));

  it('drops script elements and event handler attributes', () => {
    const codes = parsed.warnings.filter((w) => w.code === 'removed-for-safety');
    const subjects = codes.map((w) => w.subject);
    expect(subjects).toContain('script');
    expect(subjects).toContain('onload');
    expect(subjects).toContain('onclick');
  });

  it('strips javascript: and remote URL references', () => {
    const subjects = parsed.warnings.map((w) => w.subject);
    expect(subjects).toContain('href');
  });

  it('still parses the legitimate shapes in a hostile document', () => {
    expect(parsed.nodes.map((n) => n.id)).toContain('safe');
  });
});

describe('degraded input', () => {
  it('falls back to width and height when viewBox is missing', () => {
    const parsed = parseSvg(fixture('no-viewbox.svg'));
    expect(parsed.viewBox).toEqual({ x: 0, y: 0, width: 32, height: 16 });
    expect(parsed.warnings.some((w) => w.code === 'missing-viewbox')).toBe(true);
  });

  it('reports an empty document rather than throwing', () => {
    const parsed = parseSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');
    expect(parsed.nodes).toHaveLength(0);
    expect(parsed.warnings.some((w) => w.code === 'empty-document')).toBe(true);
  });

  it('reports non-SVG input rather than throwing', () => {
    const parsed = parseSvg('not markup at all');
    expect(parsed.nodes).toHaveLength(0);
    expect(parsed.warnings.some((w) => w.code === 'empty-document')).toBe(true);
  });
});

describe('path round-tripping', () => {
  it('re-serializes subpaths without moving the geometry', () => {
    const parsed = parseSvg(fixture('shapes.svg'));
    for (const node of parsed.nodes) {
      const reparsed = parseSvg(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
          `<path d="${subpathsToPathData(node.subpaths)}" /></svg>`,
      );
      const before = node.bbox;
      const after = boundingBox(reparsed.nodes[0]!.subpaths);
      expect(after.x).toBeCloseTo(before.x, 2);
      expect(after.y).toBeCloseTo(before.y, 2);
      expect(after.width).toBeCloseTo(before.width, 2);
      expect(after.height).toBeCloseTo(before.height, 2);
    }
  });
});
