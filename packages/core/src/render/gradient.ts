import type { Gradient, Point, Transform2D } from '../types.js';

const IDENTITY_TRANSFORM: Transform2D = [1, 0, 0, 1, 0, 0];

/** Applies a gradient's own transform to one of its coordinates. */
export function applyTransform(transform: Transform2D, point: Point): Point {
  const [a, b, c, d, e, f] = transform;
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}

/** How much a transform scales a length, averaged over both axes. */
export function transformScale(transform: Transform2D): number {
  const [a, b, c, d] = transform;
  return Math.sqrt(Math.abs(a * d - b * c));
}

/**
 * Whether a transform is a similarity — rotation, uniform scale and
 * translation only.
 *
 * It is the dividing line for the Lottie exporter: Lottie describes a gradient
 * by two points, which can express any similarity exactly, but not the ellipse
 * a non-uniform scale makes of a radial gradient, nor the slanted colour bands
 * a skew makes of a linear one. The tolerance is loose enough that rounding in
 * the source file does not trip it.
 */
export function isSimilarity(transform: Transform2D): boolean {
  const [a, b, c, d] = transform;
  const columnX = Math.hypot(a, b);
  const columnY = Math.hypot(c, d);
  if (columnX === 0 || columnY === 0) return false;
  // Equal axis scales, and axes still at right angles.
  if (Math.abs(columnX - columnY) > 0.02 * Math.max(columnX, columnY)) return false;
  return Math.abs(a * c + b * d) <= 0.02 * columnX * columnY;
}

/**
 * A gradient with its transform folded into its coordinates.
 *
 * This is the form Lottie needs, and it is lossy whenever the transform is not
 * a similarity — see `isSimilarity`.
 */
export interface FlatGradient {
  type: Gradient['type'];
  /** Linear: the start. Radial: the centre. */
  start: Point;
  /** Linear: the end. Radial: a point one radius away, which is how Lottie states it. */
  end: Point;
  /** Radial only: the focal point, equal to `start` unless the source moved it. */
  focus: Point;
}

/**
 * Resolves a gradient into absolute coordinates, offset by `origin`.
 *
 * `origin` exists because Lottie shape groups are built around their own
 * centre: the geometry is shifted there, so the gradient has to move with it
 * or it would paint from the wrong place.
 */
export function flattenGradient(gradient: Gradient, origin: Point = { x: 0, y: 0 }): FlatGradient {
  const shift = (point: Point): Point => {
    const moved = applyTransform(gradient.transform, point);
    return { x: moved.x - origin.x, y: moved.y - origin.y };
  };

  if (gradient.type === 'linear') {
    const start = shift(gradient.start);
    return { type: 'linear', start, end: shift(gradient.end), focus: start };
  }

  const center = shift(gradient.center);
  const radius = gradient.radius * transformScale(gradient.transform);
  return {
    type: 'radial',
    start: center,
    // Lottie has no radius field: the distance from the centre to `e` is the
    // radius, and the direction of that vector is the gradient's own x axis.
    end: { x: center.x + radius, y: center.y },
    focus: shift(gradient.focus),
  };
}

/**
 * Collects the gradients an SVG export needs, deduplicated, and renders the
 * `<defs>` block that declares them.
 *
 * Gradients are emitted in `userSpaceOnUse` with the composed matrix on
 * `gradientTransform`, which is exactly the space the parser resolved them in.
 * Round-tripping them through `objectBoundingBox` would re-derive the box from
 * the exported path and drift.
 */
export class GradientDefs {
  private readonly entries: { id: string; markup: string }[] = [];
  private readonly ids = new Map<string, string>();

  constructor(
    private readonly prefix: string,
    private readonly precision: number,
  ) {}

  /** Registers a gradient and returns the paint value that references it. */
  reference(gradient: Gradient): string {
    const key = JSON.stringify(gradient);
    let id = this.ids.get(key);
    if (id === undefined) {
      id = `${this.prefix}-gradient-${this.entries.length + 1}`;
      this.ids.set(key, id);
      this.entries.push({ id, markup: this.render(gradient, id) });
    }
    return `url(#${id})`;
  }

  get size(): number {
    return this.entries.length;
  }

  /** The `<defs>` block, indented by `pad`, or an empty string when unused. */
  markup(pad: string): string {
    if (this.entries.length === 0) return '';
    const body = this.entries.map((entry) => entry.markup).join('\n');
    return `${pad}<defs>\n${indentBlock(body, `${pad}  `)}\n${pad}</defs>`;
  }

  private render(gradient: Gradient, id: string): string {
    const round = (n: number): string => String(Number(n.toFixed(this.precision)));
    const attributes: string[] = [`id="${id}"`, 'gradientUnits="userSpaceOnUse"'];

    if (gradient.type === 'linear') {
      attributes.push(
        `x1="${round(gradient.start.x)}"`,
        `y1="${round(gradient.start.y)}"`,
        `x2="${round(gradient.end.x)}"`,
        `y2="${round(gradient.end.y)}"`,
      );
    } else {
      attributes.push(
        `cx="${round(gradient.center.x)}"`,
        `cy="${round(gradient.center.y)}"`,
        `r="${round(gradient.radius)}"`,
      );
      // A focal point equal to the centre is the default; saying so again only
      // makes the output harder to read.
      if (gradient.focus.x !== gradient.center.x || gradient.focus.y !== gradient.center.y) {
        attributes.push(`fx="${round(gradient.focus.x)}"`, `fy="${round(gradient.focus.y)}"`);
      }
    }

    if (!isIdentityTransform(gradient.transform)) {
      attributes.push(`gradientTransform="matrix(${gradient.transform.map(round).join(' ')})"`);
    }
    if (gradient.spread !== 'pad') attributes.push(`spreadMethod="${gradient.spread}"`);

    const tag = gradient.type === 'linear' ? 'linearGradient' : 'radialGradient';
    const stops = gradient.stops.map((stop) => {
      const parts = [`offset="${round(stop.offset)}"`, `stop-color="${stop.color}"`];
      if (stop.opacity !== 1) parts.push(`stop-opacity="${round(stop.opacity)}"`);
      return `  <stop ${parts.join(' ')} />`;
    });

    return `<${tag} ${attributes.join(' ')}>\n${stops.join('\n')}\n</${tag}>`;
  }
}

function isIdentityTransform(transform: Transform2D): boolean {
  return transform.every((value, index) => value === IDENTITY_TRANSFORM[index]);
}

function indentBlock(text: string, pad: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n');
}
