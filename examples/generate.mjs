#!/usr/bin/env node
/**
 * Generates every export format for each icon in `icons/`.
 *
 * This doubles as the Node-side check on the library: Node has no global
 * DOMParser, so a caller outside a browser has to supply one, and this is the
 * only place that path is exercised end to end.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import {
  animateAll,
  createSpec,
  parseSvg,
  toCss,
  toLottie,
  toReact,
  toSvg,
  toVue,
} from 'svgmotion';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, 'icons');
const outDir = join(here, 'generated');

const { window } = new JSDOM();
const domParser = new window.DOMParser();

/** Which effect suits which icon. Bars bounce; outlines draw themselves on. */
const EFFECTS = {
  'check-circle': 'strokeDraw',
  bars: 'bounce',
};

async function main() {
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(iconsDir)).filter((name) => name.endsWith('.svg'));
  if (files.length === 0) throw new Error('No icons to generate from.');

  for (const file of files) {
    const name = basename(file, '.svg');
    const markup = await readFile(join(iconsDir, file), 'utf8');

    const parsed = parseSvg(markup, { domParser });
    const spec = animateAll(createSpec(parsed, { fps: 60 }), EFFECTS[name] ?? 'fade', {
      duration: 1.2,
      stagger: 0.15,
    });

    const lottie = toLottie(spec, { name });
    const css = toCss(spec);
    const svg = toSvg(spec, { respectReducedMotion: true });
    const react = toReact(spec, { name });
    const vue = toVue(spec, { name });

    await Promise.all([
      writeFile(join(outDir, `${name}.json`), JSON.stringify(lottie.animation, null, 2)),
      writeFile(join(outDir, `${name}.css`), `${css.css}\n`),
      writeFile(join(outDir, `${name}.animated.svg`), `${svg.html}\n`),
      writeFile(join(outDir, react.filename), react.code),
      writeFile(join(outDir, vue.filename), vue.code),
    ]);

    console.log(`${name}: ${parsed.nodes.length} shapes, ${lottie.animation.op} frames`);

    // Warnings are the part worth reading. A build script that ignores them
    // ships artwork with pieces silently missing.
    for (const warning of [...svg.warnings, ...lottie.warnings]) {
      console.warn(`  ! ${warning.subject ? `${warning.subject}: ` : ''}${warning.message}`);
    }
  }

  console.log(`\nWrote ${files.length * 5} files to examples/generated/`);
}

await main();
