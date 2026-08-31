import {
  componentName,
  indent,
  renderParts,
  type ComponentOptions,
  type ComponentOutput,
} from './framework.js';
import type { AnimationSpec } from '../types.js';

/**
 * Renders the animation as a Vue single-file component.
 *
 * The stylesheet goes in a `<style scoped>` block, which is stronger isolation
 * than the React output gets: Vue rewrites the selectors with a per-component
 * attribute, so two icons exported with the same prefix cannot collide.
 */
export function toVue(spec: AnimationSpec, options: ComponentOptions = {}): ComponentOutput {
  const name = componentName(options.name, 'AnimatedIcon');
  const { css, rootAttributes, body, warnings } = renderParts(spec, {
    ...options,
    prefix: options.prefix ?? name.toLowerCase(),
  });

  const code = `<template>
  <svg ${rootAttributes}>
${indent(body, 4)}
  </svg>
</template>

<script setup lang="ts">
// No state to hold: the animation runs entirely in CSS.
</script>

<style scoped>
${css}
</style>
`;

  return { code, filename: `${name}.vue`, warnings };
}
