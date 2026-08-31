import {
  componentName,
  indent,
  renderParts,
  type ComponentOptions,
  type ComponentOutput,
} from './framework.js';
import type { AnimationSpec } from '../types.js';

/**
 * Renders the animation as a self-contained React component.
 *
 * The stylesheet ships inside the component in a `<style>` element rather than
 * as a separate file, so the component can be dropped into any project without
 * a CSS build step or an import the bundler has to be told about.
 *
 * Class names are generated from the SVG's own element ids and prefixed, which
 * keeps them stable across re-exports but does not isolate them: two different
 * icons exported with the same prefix and overlapping ids will collide. Pass a
 * distinct `prefix` per icon when that matters.
 */
export function toReact(spec: AnimationSpec, options: ComponentOptions = {}): ComponentOutput {
  const name = componentName(options.name, 'AnimatedIcon');
  const { css, rootAttributes, body, warnings } = renderParts(spec, {
    ...options,
    prefix: options.prefix ?? name.toLowerCase(),
  });

  // React passes hyphenated SVG presentation attributes straight through, so
  // stroke-width and friends need no rewriting. `class` is the exception: React
  // warns on it and expects `className`.
  const jsxBody = body.replace(/\bclass=/g, 'className=');

  const code = `import type { SVGProps } from 'react';

const css = \`
${indent(escapeTemplate(css), 0)}
\`;

export function ${name}(props: SVGProps<SVGSVGElement>) {
  return (
    <svg ${rootAttributes} {...props}>
      <style>{css}</style>
${indent(jsxBody, 6)}
    </svg>
  );
}

export default ${name};
`;

  return { code, filename: `${name}.tsx`, warnings };
}

/** Escapes the sequences that would terminate a template literal. */
function escapeTemplate(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}
