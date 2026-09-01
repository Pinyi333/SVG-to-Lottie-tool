import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { toLottie } from '../src/render/lottie.js';
import type { LottieShapeItem } from '../src/render/lottie/shapes.js';

const here = dirname(fileURLToPath(import.meta.url));

export function fixture(name: string): string {
  return readFileSync(join(here, 'fixtures', name), 'utf8');
}

/** Pulls the shape items out of a layer's single group. */
export function itemsOf(
  animation: ReturnType<typeof toLottie>['animation'],
  layerName: string,
): LottieShapeItem[] {
  const layer = animation.layers.find((candidate) => candidate.nm === layerName);
  if (!layer) throw new Error(`layer "${layerName}" is missing`);
  return (layer.shapes[0] as LottieShapeItem).it as LottieShapeItem[];
}

/** Narrows a shape item to the fields a given assertion needs. */
export function itemAs<T>(items: LottieShapeItem[], ty: string): T {
  const found = items.find((item) => item.ty === ty);
  if (!found) throw new Error(`no "${ty}" item in group`);
  return found as unknown as T;
}
