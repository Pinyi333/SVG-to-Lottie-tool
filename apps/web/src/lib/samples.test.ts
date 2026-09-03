import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { createSpec, createTrack, parseSvg, toCss } from 'svgmotion';
import { SAMPLES } from './samples.js';

const domParser = new new JSDOM().window.DOMParser();

/** Builds exactly what the Animate workspace builds when a sample is clicked. */
function animateSample(sample: (typeof SAMPLES)[number]) {
  const parsed = parseSvg(sample.svg, { domParser });
  const spec = createSpec(parsed, { fps: 60 });
  spec.tracks = parsed.nodes.map((node, index) =>
    createTrack(node.id, sample.effect, { duration: 1.2, delay: index * 0.08 }),
  );
  return { parsed, ...toCss(spec) };
}

describe('the sample icons', () => {
  it.each(SAMPLES.map((sample) => [sample.label, sample] as const))(
    '%s parses into shapes the tool can address',
    (_label, sample) => {
      const { parsed } = animateSample(sample);
      expect(parsed.nodes.length).toBeGreaterThan(0);
      // Ids are hand-written so tracks can name them; a generated id here
      // would mean the artwork lost one.
      for (const node of parsed.nodes) expect(node.id).not.toMatch(/^(path|rect|circle)-\d+$/);
    },
  );

  it.each(SAMPLES.map((sample) => [sample.label, sample] as const))(
    '%s animates visibly with the effect it ships with',
    (_label, sample) => {
      const { css, warnings } = animateSample(sample);

      // The failure this guards against is silent: stroke draw on filled
      // artwork produces a perfectly valid stroke-dashoffset animation of a
      // stroke that is not there, so the sample renders and does nothing.
      // The engine says so in a warning rather than in the output, which is
      // why the assertion is on the warning rather than on the CSS.
      const invisible = warnings.filter((warning) => warning.code === 'unsupported-paint');
      expect(invisible.map((warning) => `${warning.subject ?? ''}: ${warning.message}`)).toEqual(
        [],
      );
      expect(css).toContain('@keyframes');
    },
  );
});
