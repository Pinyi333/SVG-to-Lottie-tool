/** The URL a visitor is told to replace with their own hosted animation. */
export const ANIMATION_URL_PLACEHOLDER = 'https://example.com/animation.json';

const PLAYER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.13.0/lottie.min.js';

export interface EmbedOptions {
  url: string;
  loop: boolean;
  speed: number;
  width: number;
  background: string;
}

/**
 * Embed snippets point at a URL rather than inlining the animation.
 *
 * A Lottie file is routinely tens of kilobytes of JSON; pasting that into a
 * page makes the snippet unreadable and unmaintainable. Every snippet below
 * therefore fetches from a URL the visitor hosts, which is also what lets them
 * update the animation without redeploying the page.
 */
export function htmlEmbed(options: EmbedOptions): string {
  return `<div id="lottie-container" style="width:${options.width}px;background:${options.background}"></div>
<script src="${PLAYER_CDN}"></script>
<script>
  const animation = lottie.loadAnimation({
    container: document.getElementById('lottie-container'),
    renderer: 'svg',
    loop: ${options.loop},
    autoplay: true,
    path: '${options.url}',
  });
  animation.setSpeed(${options.speed});
</script>`;
}

export function iframeEmbed(options: EmbedOptions): string {
  // srcdoc keeps the embed to a single file with nothing to host but the
  // animation itself. The quotes inside have to be escaped for the attribute.
  const inner = htmlEmbed(options).replace(/"/g, '&quot;');
  return `<iframe
  title="Lottie animation"
  width="${options.width}"
  height="${options.width}"
  style="border:0"
  srcdoc="${inner}"
></iframe>`;
}

export function reactEmbed(options: EmbedOptions): string {
  return `import { useEffect, useRef } from 'react';
import lottie from 'lottie-web';

export function LottieAnimation() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const animation = lottie.loadAnimation({
      container: container.current,
      renderer: 'svg',
      loop: ${options.loop},
      autoplay: true,
      path: '${options.url}',
    });
    animation.setSpeed(${options.speed});
    // Destroying on unmount is required: lottie-web keeps a rAF loop running
    // for every animation it has loaded.
    return () => animation.destroy();
  }, []);

  return <div ref={container} style={{ width: ${options.width}, background: '${options.background}' }} />;
}`;
}

export function vueEmbed(options: EmbedOptions): string {
  return `<template>
  <div ref="container" :style="{ width: '${options.width}px', background: '${options.background}' }" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import lottie, { type AnimationItem } from 'lottie-web';

const container = ref<HTMLDivElement | null>(null);
let animation: AnimationItem | null = null;

onMounted(() => {
  if (!container.value) return;
  animation = lottie.loadAnimation({
    container: container.value,
    renderer: 'svg',
    loop: ${options.loop},
    autoplay: true,
    path: '${options.url}',
  });
  animation.setSpeed(${options.speed});
});

// lottie-web keeps a rAF loop per animation, so it has to be destroyed.
onBeforeUnmount(() => animation?.destroy());
</script>`;
}
