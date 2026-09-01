import { describe, expect, it } from 'vitest';
import { parseSvg } from '../src/parse/index.js';
import { createSpec, createTrack } from '../src/spec.js';
import { toLottie } from '../src/render/lottie.js';
import { toCss } from '../src/render/css.js';
import { toSvg } from '../src/render/svg.js';
import { PRESET_NAMES } from '../src/presets/index.js';
import { fixture } from './helpers.js';

/**
 * Golden files. These do not assert that the output is *correct* — the
 * behavioural tests do that — but they make any unintended change to it
 * visible in a diff, which is what keeps a refactor from quietly altering
 * every file the tool has ever produced.
 *
 * Update deliberately with `pnpm test -- -u` and read the diff before
 * accepting it.
 */
/** Params that make each preset actually animate; most need none. */
const GOLDEN_PARAMS: Partial<Record<(typeof PRESET_NAMES)[number], Record<string, unknown>>> = {
  // A morph without a target is a validated no-op, which would freeze an
  // empty golden file. Morph the tick into a plain diagonal stroke instead.
  morph: { toPath: 'M4 4 20 20' },
};

describe.each(PRESET_NAMES)('%s output stays stable', (preset) => {
  const spec = createSpec(parseSvg(fixture('icon-check.svg')), { fps: 30 });
  spec.tracks = [
    createTrack('tick', preset, { duration: 1, delay: 0.25, params: GOLDEN_PARAMS[preset] }),
  ];

  it('renders the same Lottie JSON', () => {
    expect(toLottie(spec, { name: preset }).animation).toMatchSnapshot();
  });

  it('renders the same CSS', () => {
    expect(toCss(spec).css).toMatchSnapshot();
  });

  it('renders the same standalone SVG', () => {
    expect(toSvg(spec).html).toMatchSnapshot();
  });
});
