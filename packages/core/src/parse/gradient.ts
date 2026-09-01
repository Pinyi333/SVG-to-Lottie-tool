import type { Gradient, GradientSpread, GradientStop, Point, Rect } from '../types.js';
import { parseColor, toHex } from './color.js';
import { IDENTITY, multiply, parseTransform, type Matrix } from './matrix.js';

/** Every paint server in the document, indexed by id, wherever it was declared. */
export type GradientRegistry = Map<string, Element>;

const GRADIENT_TAGS = new Set(['lineargradient', 'radialgradient']);

/**
 * Patterns are indexed alongside gradients even though they cannot be
 * resolved: knowing a reference points at a pattern is what lets the parser
 * say "patterns are not supported" instead of "this id does not exist".
 */
const PAINT_SERVER_TAGS = new Set([...GRADIENT_TAGS, 'pattern']);

/** How deep an `href` chain is followed before giving up. */
const MAX_HREF_DEPTH = 8;

/**
 * Indexes every paint server in the document by id.
 *
 * They are collected up front rather than looked up through the DOM on
 * demand: a paint reference may point at a gradient declared anywhere —
 * before the shape, after it, or nested inside another `<defs>` — and the
 * shape walk only ever moves forward.
 */
export function collectGradients(root: Element): GradientRegistry {
  const registry: GradientRegistry = new Map();

  const walk = (el: Element) => {
    if (PAINT_SERVER_TAGS.has(el.tagName.toLowerCase())) {
      const id = el.getAttribute('id');
      // First declaration wins, matching how a document with duplicate ids
      // resolves references in every browser.
      if (id && !registry.has(id)) registry.set(id, el);
    }
    for (const child of Array.from(el.children)) walk(child);
  };

  walk(root);
  return registry;
}

/** Extracts the id from a `url(#id)` paint value, or null when it is not one. */
export function referencedId(paint: string | null | undefined): string | null {
  if (!paint) return null;
  const match = /^\s*url\(\s*(?:'([^']*)'|"([^"]*)"|([^)\s]*))\s*\)/.exec(paint);
  const target = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!target || !target.startsWith('#')) return null;
  const id = target.slice(1);
  return id === '' ? null : id;
}

/**
 * The colour after a `url(#id)` reference, if the paint declared one.
 *
 * SVG lets a paint name a fallback for exactly the case this parser hits when
 * a reference cannot be resolved — `fill="url(#missing) #444"` — so honouring
 * it keeps such a shape visible instead of dropping it.
 */
export function referencedFallback(paint: string | null | undefined): string | null {
  if (!paint) return null;
  const match = /^\s*url\([^)]*\)\s*(.*)$/.exec(paint);
  const rest = match?.[1]?.trim();
  return rest === undefined || rest === '' ? null : rest;
}

/** Why a `url(#id)` paint reference could not be turned into a gradient. */
export type GradientFailure = 'not-found' | 'not-a-gradient' | 'no-stops' | 'degenerate-box';

export type GradientResolution =
  { ok: true; gradient: Gradient } | { ok: false; reason: GradientFailure };

export interface ResolveGradientOptions {
  /** Accumulated transform of the referencing element; already baked into its geometry. */
  ctm: Matrix;
  /** The element's bounding box in its own user space, before `ctm` is applied. */
  bbox: Rect;
  /** The document viewBox, which percentage lengths in user space resolve against. */
  viewBox: Rect;
}

/**
 * Resolves a `url(#id)` paint reference into a renderable gradient.
 *
 * The coordinates come out exactly as they were authored; everything that
 * would otherwise have to be folded into them — the element's transform
 * chain, the bounding box behind `objectBoundingBox` units, and
 * `gradientTransform` — is composed into the returned `transform` instead.
 * That keeps the SVG and CSS output exact even under skew or non-uniform
 * scale, where moving the start and end points would quietly change the
 * gradient's direction.
 */
export function resolveGradient(
  id: string,
  registry: GradientRegistry,
  options: ResolveGradientOptions,
): GradientResolution {
  const element = registry.get(id);
  if (!element) return { ok: false, reason: 'not-found' };

  const tag = element.tagName.toLowerCase();
  if (!GRADIENT_TAGS.has(tag)) return { ok: false, reason: 'not-a-gradient' };

  const chain = hrefChain(element, registry);
  const attribute = (name: string): string | null => {
    for (const link of chain) {
      const value = link.getAttribute(name);
      if (value !== null && value.trim() !== '') return value.trim();
    }
    return null;
  };

  const stops = resolveStops(chain);
  if (stops.length === 0) return { ok: false, reason: 'no-stops' };

  const objectBoundingBox =
    (attribute('gradientUnits') ?? 'objectBoundingBox') !== 'userSpaceOnUse';
  // A bounding box with no area gives objectBoundingBox units nothing to
  // resolve against — a straight line filled this way is not rendered at all,
  // rather than rendered in some arbitrary colour.
  if (objectBoundingBox && (options.bbox.width === 0 || options.bbox.height === 0)) {
    return { ok: false, reason: 'degenerate-box' };
  }

  const spread = toSpread(attribute('spreadMethod'));
  const transform = composeTransform(
    options,
    objectBoundingBox,
    parseTransform(attribute('gradientTransform')),
  );

  // The unit square for objectBoundingBox, or the viewBox for user space:
  // whichever one percentage lengths resolve against.
  const box: Rect = objectBoundingBox ? { x: 0, y: 0, width: 1, height: 1 } : options.viewBox;
  const lengthX = (raw: string | null, fallback: number) => length(raw, box.width, fallback);
  const lengthY = (raw: string | null, fallback: number) => length(raw, box.height, fallback);

  if (tag === 'lineargradient') {
    const start: Point = { x: lengthX(attribute('x1'), 0), y: lengthY(attribute('y1'), 0) };
    const end: Point = { x: lengthX(attribute('x2'), box.width), y: lengthY(attribute('y2'), 0) };
    return { ok: true, gradient: { type: 'linear', start, end, stops, spread, transform } };
  }

  // Radial is the only other tag `GRADIENT_TAGS` admits.
  const center: Point = {
    x: lengthX(attribute('cx'), box.width / 2),
    y: lengthY(attribute('cy'), box.height / 2),
  };
  // A radius is a length along both axes at once, which SVG resolves against
  // the normalized diagonal rather than either side.
  const radius = length(attribute('r'), normalizedDiagonal(box), normalizedDiagonal(box) / 2);
  const focus: Point = {
    x: lengthX(attribute('fx'), center.x),
    y: lengthY(attribute('fy'), center.y),
  };
  return {
    ok: true,
    gradient: { type: 'radial', center, radius, focus, stops, spread, transform },
  };
}

/**
 * The element itself followed by everything its `href` chain inherits from.
 *
 * A gradient may carry only stops and borrow its geometry from another, or
 * the reverse. Attributes and stops are therefore looked up along the chain,
 * nearest first, exactly as SVG's own template inheritance does.
 */
function hrefChain(element: Element, registry: GradientRegistry): Element[] {
  const chain: Element[] = [element];
  const seen = new Set<Element>([element]);

  let current = element;
  for (let depth = 0; depth < MAX_HREF_DEPTH; depth += 1) {
    const href = current.getAttribute('href') ?? current.getAttribute('xlink:href');
    const id = href?.startsWith('#') ? href.slice(1) : null;
    if (!id) break;
    const next = registry.get(id);
    // A cycle would otherwise loop until the depth cap; stopping at the repeat
    // keeps the resolved gradient identical to what a browser renders.
    if (!next || seen.has(next)) break;
    chain.push(next);
    seen.add(next);
    current = next;
  }

  return chain;
}

/** The stops of the nearest link in the chain that declares any. */
function resolveStops(chain: Element[]): GradientStop[] {
  for (const link of chain) {
    const elements = Array.from(link.children).filter(
      (child) => child.tagName.toLowerCase() === 'stop',
    );
    if (elements.length === 0) continue;

    const stops: GradientStop[] = [];
    let highest = 0;
    for (const stop of elements) {
      const declared = clamp01(length(stop.getAttribute('offset'), 1, 0));
      // Offsets must not decrease; SVG clamps each one to the highest so far.
      const offset = Math.max(declared, highest);
      highest = offset;

      const style = inlineStyle(stop.getAttribute('style'));
      const color = parseColor(style['stop-color'] ?? stop.getAttribute('stop-color') ?? 'black');
      const declaredOpacity = style['stop-opacity'] ?? stop.getAttribute('stop-opacity');
      const opacity = clamp01(numberOr(declaredOpacity, 1)) * (color?.a ?? 1);

      stops.push({ offset, color: color ? toHex(color) : '#000000', opacity });
    }

    // A single stop paints one flat colour. Doubling it keeps every renderer
    // on the same code path instead of special-casing a degenerate gradient.
    if (stops.length === 1) {
      return [
        { ...stops[0]!, offset: 0 },
        { ...stops[0]!, offset: 1 },
      ];
    }
    return stops;
  }

  return [];
}

/**
 * Composes the matrix that takes the gradient's own space to final viewBox
 * coordinates.
 *
 * For `objectBoundingBox` the unit square maps onto the element's *untransformed*
 * bounding box, and the element's transform is applied after that — the order
 * matters, since the two do not commute once a rotation is involved.
 */
function composeTransform(
  options: ResolveGradientOptions,
  objectBoundingBox: boolean,
  gradientTransform: Matrix,
): [number, number, number, number, number, number] {
  const { bbox } = options;
  const units: Matrix = objectBoundingBox
    ? { a: bbox.width, b: 0, c: 0, d: bbox.height, e: bbox.x, f: bbox.y }
    : IDENTITY;
  const composed = multiply(multiply(options.ctm, units), gradientTransform);
  return [composed.a, composed.b, composed.c, composed.d, composed.e, composed.f];
}

function toSpread(raw: string | null): GradientSpread {
  const value = raw?.toLowerCase();
  return value === 'reflect' || value === 'repeat' ? value : 'pad';
}

/** Resolves an SVG length, where a percentage is a fraction of `reference`. */
function length(raw: string | null | undefined, reference: number, fallback: number): number {
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const text = raw.trim();
  const value = parseFloat(text);
  if (Number.isNaN(value)) return fallback;
  return text.endsWith('%') ? (value / 100) * reference : value;
}

/** SVG's own normalized diagonal, which percentage radii resolve against. */
function normalizedDiagonal(box: Rect): number {
  return Math.hypot(box.width, box.height) / Math.SQRT2;
}

function numberOr(raw: string | null | undefined, fallback: number): number {
  if (raw === null || raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

function inlineStyle(value: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value) return out;
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const propertyValue = declaration.slice(colon + 1).trim();
    if (property && propertyValue) out[property] = propertyValue;
  }
  return out;
}
