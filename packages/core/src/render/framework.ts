import { toCss, type CssOptions } from './css.js';
import type { AnimationSpec, Warning } from '../types.js';

export interface ComponentOutput {
  /** The component source, ready to save to a file. */
  code: string;
  /** Suggested filename, including extension. */
  filename: string;
  warnings: Warning[];
}

export interface ComponentOptions extends CssOptions {
  /** Component name. Normalized to PascalCase. */
  name?: string;
}

/** Normalizes an arbitrary string into a valid PascalCase component name. */
export function componentName(raw: string | undefined, fallback: string): string {
  const source = raw && raw.trim() !== '' ? raw : fallback;
  const parts = source.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const pascal = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  // A component name cannot start with a digit, and must not be empty.
  return /^[A-Za-z]/.test(pascal) ? pascal : `Icon${pascal}`;
}

/** Splits generated CSS into a scoped stylesheet and the SVG body. */
export function renderParts(spec: AnimationSpec, options: ComponentOptions) {
  const rendered = toCss(spec, options);
  const openTagEnd = rendered.html.indexOf('>') + 1;
  const rootAttributes = rendered.html.slice('<svg '.length, openTagEnd - 1).trim();
  const body = rendered.html.slice(openTagEnd, rendered.html.lastIndexOf('</svg>')).trim();

  return { css: rendered.css, rootAttributes, body, warnings: rendered.warnings };
}

/** Indents a block of text by `spaces`, leaving blank lines empty. */
export function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : pad + line))
    .join('\n');
}
