import type { Paint, ParsedSvg, Rect, SvgNode, Warning } from '../types.js';
import { parseColor, toHex } from './color.js';
import {
  collectGradients,
  referencedFallback,
  referencedId,
  resolveGradient,
  type GradientFailure,
  type GradientRegistry,
} from './gradient.js';
import { boundingBox, elementToPathData, outlineLength, toSubpaths } from './geometry.js';
import { IDENTITY, multiply, parseTransform, scaleFactor, type Matrix } from './matrix.js';
import { sanitizeElement } from './sanitize.js';
import { INITIAL_STYLE, resolveStyle, toPaint, type StyleState } from './style.js';

export interface ParseOptions {
  /**
   * DOM parser to use. Defaults to the global `DOMParser`, which exists in
   * browsers and in test environments such as jsdom. Node has no global
   * `DOMParser`, so server-side callers pass one in explicitly.
   */
  domParser?: DOMParser;
}

/** Elements that hold drawable geometry. Everything else is a container or metadata. */
const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline']);

/** Containers we descend into without drawing anything ourselves. */
const CONTAINER_TAGS = new Set(['g', 'svg', 'a', 'switch']);

/**
 * Elements the shape walk steps over. They carry no geometry we would draw,
 * and warning about each one would bury the warnings that matter. Gradients
 * are among them because they are read separately, by `collectGradients`.
 */
const IGNORED_TAGS = new Set([
  'title',
  'desc',
  'metadata',
  'defs',
  'symbol',
  'marker',
  'lineargradient',
  'radialgradient',
  'stop',
  'filter',
  'clippath',
  'mask',
  'pattern',
]);

/** Elements we cannot represent, each worth telling the user about once. */
const UNSUPPORTED_TAGS: Record<string, string> = {
  text: 'Text is not converted. Convert text to outlines before uploading.',
  tspan: 'Text is not converted. Convert text to outlines before uploading.',
  image: 'Embedded images are not converted; only vector shapes are.',
  use: '<use> references are not resolved. Flatten the SVG before uploading.',
  style: '<style> blocks are not applied. Use presentation attributes or inline styles.',
};

class IdAllocator {
  private taken = new Set<string>();
  private counter = 0;

  claim(preferred: string | null, tag: string): string {
    const base = preferred && preferred.trim() !== '' ? preferred.trim() : `${tag}-${this.counter}`;
    this.counter += 1;
    if (!this.taken.has(base)) {
      this.taken.add(base);
      return base;
    }
    let suffix = 2;
    while (this.taken.has(`${base}-${suffix}`)) suffix += 1;
    const unique = `${base}-${suffix}`;
    this.taken.add(unique);
    return unique;
  }
}

interface PaintServerContext {
  gradients: GradientRegistry;
  ctm: Matrix;
  /** The shape's bounding box in its own space, before `ctm` is applied. */
  bbox: Rect;
  viewBox: Rect;
  subject: string;
  warn: (key: string, subject: string, message: string) => void;
}

/** Why a `url(#id)` paint could not be resolved, in words a user can act on. */
const PAINT_FAILURES: Record<GradientFailure, string> = {
  'not-found': 'points at an id that is not in this file',
  'not-a-gradient': 'is a pattern rather than a gradient, and patterns are not converted',
  'no-stops': 'is a gradient with no stops, which paints nothing',
  'degenerate-box': 'is sized against a bounding box with no width or height',
};

/**
 * Resolves the `url(#id)` fill and stroke of one shape, mutating its paint.
 *
 * A reference that cannot be resolved falls back to the colour the paint named
 * after it, as SVG intends, and only then to nothing — a shape is far more
 * useful drawn in its fallback colour than dropped for a missing gradient.
 */
function applyPaintServers(paint: Paint, style: StyleState, context: PaintServerContext): void {
  const properties = [
    { property: 'fill', raw: style.fill, gradient: 'fillGradient' },
    { property: 'stroke', raw: style.stroke, gradient: 'strokeGradient' },
  ] as const;

  for (const { property, raw, gradient } of properties) {
    const id = referencedId(raw);
    if (!id) continue;

    const resolution = resolveGradient(id, context.gradients, {
      ctm: context.ctm,
      bbox: context.bbox,
      viewBox: context.viewBox,
    });

    if (resolution.ok) {
      paint[gradient] = resolution.gradient;
      continue;
    }

    const fallback = parseColor(referencedFallback(raw));
    paint[property] = fallback ? toHex(fallback) : null;
    context.warn(
      `paint:${id}`,
      context.subject,
      `The ${property} references "#${id}", which ${PAINT_FAILURES[resolution.reason]}. ` +
        (fallback
          ? `The fallback colour ${paint[property]} was used instead.`
          : 'The shape will be invisible.'),
    );
  }
}

function parseViewBox(root: Element, warnings: Warning[]): Rect {
  const raw = root.getAttribute('viewBox');
  if (raw) {
    const parts = raw
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      const [x, y, width, height] = parts as [number, number, number, number];
      if (width > 0 && height > 0) return { x, y, width, height };
    }
  }

  // Fall back to width/height, then to a square that fits typical icon art.
  const width = parseFloat(root.getAttribute('width') ?? '') || 0;
  const height = parseFloat(root.getAttribute('height') ?? '') || 0;
  if (width > 0 && height > 0) {
    warnings.push({
      code: 'missing-viewbox',
      message: `No viewBox found; using width/height (${width}x${height}) instead.`,
    });
    return { x: 0, y: 0, width, height };
  }

  warnings.push({
    code: 'missing-viewbox',
    message: 'No viewBox or size found; assuming a 24x24 canvas.',
  });
  return { x: 0, y: 0, width: 24, height: 24 };
}

/**
 * Parses SVG markup into the normalized scene graph every exporter consumes.
 *
 * The document is sanitized first, then walked once: transforms accumulate
 * down the tree and are baked into the geometry, styles resolve through
 * inheritance, and every shape becomes cubic bezier subpaths. What comes out
 * has no nesting and no transforms left to apply, which is what lets the
 * Lottie exporter map nodes onto flat shape layers.
 */
export function parseSvg(svgText: string, options: ParseOptions = {}): ParsedSvg {
  const warnings: Warning[] = [];
  const parser = options.domParser ?? globalThis.DOMParser;

  if (!parser) {
    throw new Error(
      'No DOMParser available. Pass one via options.domParser when running outside a browser.',
    );
  }

  const instance = typeof parser === 'function' ? new parser() : parser;
  const document = instance.parseFromString(svgText, 'image/svg+xml');
  const root = document.documentElement;

  if (!root || root.tagName.toLowerCase() !== 'svg') {
    warnings.push({
      code: 'empty-document',
      message: 'Input does not contain an <svg> root element.',
    });
    return {
      viewBox: { x: 0, y: 0, width: 24, height: 24 },
      width: 24,
      height: 24,
      nodes: [],
      warnings,
    };
  }

  sanitizeElement(root, warnings);

  const viewBox = parseViewBox(root, warnings);
  const gradients = collectGradients(root);
  const nodes: SvgNode[] = [];
  const ids = new IdAllocator();
  const reported = new Set<string>();

  const warnUnsupported = (tag: string) => {
    if (reported.has(tag)) return;
    reported.add(tag);
    warnings.push({ code: 'unsupported-element', subject: tag, message: UNSUPPORTED_TAGS[tag]! });
  };

  // One document can reference the same broken paint from a hundred shapes.
  // Reporting it once per reference keeps the list readable.
  const warnPaint = (key: string, subject: string, message: string) => {
    if (reported.has(key)) return;
    reported.add(key);
    warnings.push({ code: 'unsupported-paint', subject, message });
  };

  const walk = (el: Element, parentMatrix: Matrix, parentStyle: StyleState) => {
    const tag = el.tagName.toLowerCase();

    if (IGNORED_TAGS.has(tag)) return;
    if (tag in UNSUPPORTED_TAGS) {
      warnUnsupported(tag);
      return;
    }

    const matrix = multiply(parentMatrix, parseTransform(el.getAttribute('transform')));
    const style = resolveStyle(el, parentStyle);

    if (CONTAINER_TAGS.has(tag)) {
      for (const child of Array.from(el.children)) walk(child, matrix, style);
      return;
    }

    if (!SHAPE_TAGS.has(tag)) {
      // Unknown element: descend in case it wraps shapes, but draw nothing.
      for (const child of Array.from(el.children)) walk(child, matrix, style);
      return;
    }

    const pathData = elementToPathData(el);
    if (!pathData) return;

    const subpaths = toSubpaths(pathData, matrix);
    if (subpaths.length === 0) return;

    const paint = toPaint(style, scaleFactor(matrix) || 1);
    // Gradient references come out of `toPaint` as no colour at all. Resolving
    // them needs the shape's own bounding box, which only exists here — and in
    // the element's own space, before the transform chain has been applied.
    if (referencedId(style.fill) || referencedId(style.stroke)) {
      applyPaintServers(paint, style, {
        gradients,
        ctm: matrix,
        bbox: boundingBox(toSubpaths(pathData, IDENTITY)),
        viewBox,
        subject: tag,
        warn: warnPaint,
      });
    }

    nodes.push({
      id: ids.claim(el.getAttribute('id'), tag),
      sourceTag: tag,
      subpaths,
      paint,
      bbox: boundingBox(subpaths),
      length: outlineLength(subpaths),
    });
  };

  for (const child of Array.from(root.children)) {
    walk(child, IDENTITY, resolveStyle(root, INITIAL_STYLE));
  }

  if (nodes.length === 0) {
    warnings.push({
      code: 'empty-document',
      message: 'No drawable shapes were found in this SVG.',
    });
  }

  return { viewBox, width: viewBox.width, height: viewBox.height, nodes, warnings };
}
