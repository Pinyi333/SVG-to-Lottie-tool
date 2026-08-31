import type { Paint } from '../types.js';
import { parseColor, toHex } from './color.js';

/**
 * The subset of presentation properties this library understands.
 * Values are kept as raw strings here; they are resolved into a `Paint`
 * only once the full inheritance chain has been walked.
 */
export interface StyleState {
  fill: string;
  fillOpacity: string;
  stroke: string;
  strokeOpacity: string;
  strokeWidth: string;
  strokeLinecap: string;
  strokeLinejoin: string;
  /** Accumulated group opacity. Unlike the others this is multiplied, not replaced. */
  opacity: number;
}

/** SVG's own initial values, so an element with no attributes renders correctly. */
export const INITIAL_STYLE: StyleState = {
  fill: 'black',
  fillOpacity: '1',
  stroke: 'none',
  strokeOpacity: '1',
  strokeWidth: '1',
  strokeLinecap: 'butt',
  strokeLinejoin: 'miter',
  opacity: 1,
};

const PROPERTY_TO_KEY: Record<string, keyof StyleState> = {
  fill: 'fill',
  'fill-opacity': 'fillOpacity',
  stroke: 'stroke',
  'stroke-opacity': 'strokeOpacity',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
};

function parseStyleAttribute(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const propertyValue = declaration.slice(colon + 1).trim();
    if (property && propertyValue) out[property] = propertyValue;
  }
  return out;
}

/**
 * Produces the style an element sees, given the style inherited from its parent.
 *
 * Precedence follows the CSS cascade for the cases that matter here: the
 * `style` attribute beats the matching presentation attribute, which beats
 * whatever was inherited. Stylesheets in `<style>` blocks are not resolved —
 * `parseSvg` warns when it finds one.
 */
export function resolveStyle(el: Element, inherited: StyleState): StyleState {
  const next: StyleState = { ...inherited };
  const inline = parseStyleAttribute(el.getAttribute('style') ?? '');

  for (const [property, key] of Object.entries(PROPERTY_TO_KEY)) {
    const value = inline[property] ?? el.getAttribute(property);
    if (value !== null && value !== undefined && value !== '' && value !== 'inherit') {
      // Every property in this table is a string field on StyleState.
      (next[key] as string) = value;
    }
  }

  const rawOpacity = inline['opacity'] ?? el.getAttribute('opacity');
  if (rawOpacity !== null && rawOpacity !== undefined && rawOpacity !== '') {
    const parsed = parseFloat(rawOpacity);
    if (!Number.isNaN(parsed)) {
      // Group opacity is composited, not inherited. Multiplying it into children
      // matches the rendered result whenever siblings do not overlap, which
      // holds for the flat icon artwork this tool targets.
      next.opacity = inherited.opacity * Math.max(0, Math.min(1, parsed));
    }
  }

  return next;
}

function numberOr(raw: string, fallback: number): number {
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const LINECAPS = new Set(['butt', 'round', 'square']);
const LINEJOINS = new Set(['miter', 'round', 'bevel']);

/**
 * Flattens a resolved style into the `Paint` the renderers consume.
 * `strokeScale` bakes in the scaling introduced by any ancestor transform,
 * since the geometry has already had that transform applied.
 */
export function toPaint(style: StyleState, strokeScale = 1): Paint {
  const fill = parseColor(style.fill);
  const stroke = parseColor(style.stroke);
  const linecap = style.strokeLinecap.trim().toLowerCase();
  const linejoin = style.strokeLinejoin.trim().toLowerCase();

  return {
    fill: fill ? toHex(fill) : null,
    fillOpacity: (fill?.a ?? 1) * numberOr(style.fillOpacity, 1),
    stroke: stroke ? toHex(stroke) : null,
    strokeOpacity: (stroke?.a ?? 1) * numberOr(style.strokeOpacity, 1),
    strokeWidth: numberOr(style.strokeWidth, 1) * strokeScale,
    strokeLinecap: (LINECAPS.has(linecap) ? linecap : 'butt') as Paint['strokeLinecap'],
    strokeLinejoin: (LINEJOINS.has(linejoin) ? linejoin : 'miter') as Paint['strokeLinejoin'],
    opacity: style.opacity,
  };
}
