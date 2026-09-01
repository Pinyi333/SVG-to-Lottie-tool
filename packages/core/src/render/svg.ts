import { toCss, type CssOptions, type CssOutput } from './css.js';
import type { AnimationSpec } from '../types.js';

export interface SvgOptions extends CssOptions {
  /** Adds a `prefers-reduced-motion` block that holds the final frame. */
  respectReducedMotion?: boolean;
}

/**
 * Renders a single self-contained `.svg` file with the animation inlined.
 *
 * CSS animations are used rather than SMIL: SMIL is deprecated in Chromium
 * and never shipped in Edge's original engine, while an inline `<style>`
 * block animates in every current browser and in most SVG-aware design tools.
 *
 * The file works as an `<img src>`, an `<object>`, or pasted inline. Note that
 * `<img>` isolates the SVG's own styles, which is exactly why the stylesheet
 * has to live inside the file rather than alongside it.
 */
export function toSvg(spec: AnimationSpec, options: SvgOptions = {}): CssOutput {
  const rendered = toCss(spec, options);

  // The stylesheet carries the `view()` timeline anyway — pasted inline into a
  // scrolling page it works — but the common uses of a standalone file
  // (`<img>`, `<object>`) isolate it from any scroller, so say so up front.
  const scrollCount = spec.tracks.filter((track) => track.trigger === 'scroll').length;
  if (scrollCount > 0) {
    rendered.warnings.push({
      code: 'trigger-unsupported',
      message:
        `${scrollCount} scroll-triggered animation(s) only scrub when this SVG is pasted ` +
        'inline into a scrolling page. Used as an image it has no scroller, so they will ' +
        'simply autoplay.',
    });
  }
  const indentedCss = rendered.css
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `    ${line}`))
    .join('\n');

  const reducedMotion = options.respectReducedMotion
    ? '\n\n    @media (prefers-reduced-motion: reduce) {\n' +
      '      * { animation: none !important; }\n' +
      '    }'
    : '';

  const styleBlock = `  <style>\n${indentedCss}${reducedMotion}\n  </style>`;

  // Insert the stylesheet as the first child of the root element.
  const openTagEnd = rendered.html.indexOf('>') + 1;
  const svg =
    rendered.html.slice(0, openTagEnd) + '\n' + styleBlock + rendered.html.slice(openTagEnd);

  return { ...rendered, html: svg };
}
