/** A colour resolved to sRGB components in the 0..1 range Lottie expects. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * The full CSS named-colour table.
 *
 * Shipping the complete list rather than a "common colours" subset is
 * deliberate: a missing entry would silently export the wrong colour, and
 * icon sets use the long tail of these names more than you would expect.
 */
const NAMED: Record<string, string> = {
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aqua: '#00ffff',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  beige: '#f5f5dc',
  bisque: '#ffe4c4',
  black: '#000000',
  blanchedalmond: '#ffebcd',
  blue: '#0000ff',
  blueviolet: '#8a2be2',
  brown: '#a52a2a',
  burlywood: '#deb887',
  cadetblue: '#5f9ea0',
  chartreuse: '#7fff00',
  chocolate: '#d2691e',
  coral: '#ff7f50',
  cornflowerblue: '#6495ed',
  cornsilk: '#fff8dc',
  crimson: '#dc143c',
  cyan: '#00ffff',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9',
  darkgreen: '#006400',
  darkgrey: '#a9a9a9',
  darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b',
  darkolivegreen: '#556b2f',
  darkorange: '#ff8c00',
  darkorchid: '#9932cc',
  darkred: '#8b0000',
  darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f',
  darkslategrey: '#2f4f4f',
  darkturquoise: '#00ced1',
  darkviolet: '#9400d3',
  deeppink: '#ff1493',
  deepskyblue: '#00bfff',
  dimgray: '#696969',
  dimgrey: '#696969',
  dodgerblue: '#1e90ff',
  firebrick: '#b22222',
  floralwhite: '#fffaf0',
  forestgreen: '#228b22',
  fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff',
  gold: '#ffd700',
  goldenrod: '#daa520',
  gray: '#808080',
  green: '#008000',
  greenyellow: '#adff2f',
  grey: '#808080',
  honeydew: '#f0fff0',
  hotpink: '#ff69b4',
  indianred: '#cd5c5c',
  indigo: '#4b0082',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd',
  lightblue: '#add8e6',
  lightcoral: '#f08080',
  lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2',
  lightgray: '#d3d3d3',
  lightgreen: '#90ee90',
  lightgrey: '#d3d3d3',
  lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0',
  lime: '#00ff00',
  limegreen: '#32cd32',
  linen: '#faf0e6',
  magenta: '#ff00ff',
  maroon: '#800000',
  mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd',
  mediumorchid: '#ba55d3',
  mediumpurple: '#9370db',
  mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585',
  midnightblue: '#191970',
  mintcream: '#f5fffa',
  mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5',
  navajowhite: '#ffdead',
  navy: '#000080',
  oldlace: '#fdf5e6',
  olive: '#808000',
  olivedrab: '#6b8e23',
  orange: '#ffa500',
  orangered: '#ff4500',
  orchid: '#da70d6',
  palegoldenrod: '#eee8aa',
  palegreen: '#98fb98',
  paleturquoise: '#afeeee',
  palevioletred: '#db7093',
  papayawhip: '#ffefd5',
  peachpuff: '#ffdab9',
  peru: '#cd853f',
  pink: '#ffc0cb',
  plum: '#dda0dd',
  powderblue: '#b0e0e6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#ff0000',
  rosybrown: '#bc8f8f',
  royalblue: '#4169e1',
  saddlebrown: '#8b4513',
  salmon: '#fa8072',
  sandybrown: '#f4a460',
  seagreen: '#2e8b57',
  seashell: '#fff5ee',
  sienna: '#a0522d',
  silver: '#c0c0c0',
  skyblue: '#87ceeb',
  slateblue: '#6a5acd',
  slategray: '#708090',
  slategrey: '#708090',
  snow: '#fffafa',
  springgreen: '#00ff7f',
  steelblue: '#4682b4',
  tan: '#d2b48c',
  teal: '#008080',
  thistle: '#d8bfd8',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  white: '#ffffff',
  whitesmoke: '#f5f5f5',
  yellow: '#ffff00',
  yellowgreen: '#9acd32',
};

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Parses a CSS/SVG colour into sRGB components.
 *
 * Returns `null` for `none`, `transparent` and anything unrecognised
 * (gradients, patterns, `url(#...)` paint servers). Callers treat `null` as
 * "this element has no paint of this kind" and warn where that loses fidelity.
 */
export function parseColor(input: string | null | undefined): Rgba | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();
  if (value === '' || value === 'none' || value === 'transparent') return null;
  if (value.startsWith('url(')) return null;

  const named = NAMED[value];
  const hex = named ?? value;

  if (hex.startsWith('#')) return fromHex(hex);
  if (hex.startsWith('rgb')) return fromRgbFunction(hex);
  return null;
}

function fromHex(hex: string): Rgba | null {
  const body = hex.slice(1);
  const expand = (c: string) => parseInt(c + c, 16) / 255;
  const pair = (i: number) => parseInt(body.slice(i, i + 2), 16) / 255;

  if (!/^[0-9a-f]+$/.test(body)) return null;

  if (body.length === 3 || body.length === 4) {
    return {
      r: expand(body[0]!),
      g: expand(body[1]!),
      b: expand(body[2]!),
      a: body.length === 4 ? expand(body[3]!) : 1,
    };
  }
  if (body.length === 6 || body.length === 8) {
    return {
      r: pair(0),
      g: pair(2),
      b: pair(4),
      a: body.length === 8 ? pair(6) : 1,
    };
  }
  return null;
}

function fromRgbFunction(value: string): Rgba | null {
  const inner = value.slice(value.indexOf('(') + 1, value.lastIndexOf(')'));
  // Both the legacy comma syntax and the modern space syntax show up in the wild.
  const parts = inner.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const channel = (raw: string): number =>
    raw.endsWith('%') ? clamp01(parseFloat(raw) / 100) : clamp01(parseFloat(raw) / 255);

  const alpha = (raw: string | undefined): number => {
    if (raw === undefined) return 1;
    return raw.endsWith('%') ? clamp01(parseFloat(raw) / 100) : clamp01(parseFloat(raw));
  };

  const [r, g, b] = [channel(parts[0]!), channel(parts[1]!), channel(parts[2]!)];
  if ([r, g, b].some(Number.isNaN)) return null;
  return { r, g, b, a: alpha(parts[3]) };
}

/** Serializes back to `#rrggbb`, dropping alpha (callers carry it separately). */
export function toHex(color: Rgba): string {
  const part = (n: number) =>
    Math.round(clamp01(n) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${part(color.r)}${part(color.g)}${part(color.b)}`;
}

/** Lottie stores colours as a `[r, g, b]` triple of 0..1 floats. */
export function toLottieColor(color: Rgba): [number, number, number] {
  return [color.r, color.g, color.b];
}
