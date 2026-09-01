import { zipSync } from 'fflate';
import type { AnimationSpec, Warning } from '../types.js';
import { toLottie, type LottieAnimation, type LottieOptions } from './lottie.js';

/** One animation's entry in the archive manifest. */
export interface DotLottieManifestAnimation {
  /** Matches the filename under `animations/`, without the extension. */
  id: string;
  /** Whether a player should repeat the animation. */
  loop: boolean;
  /** Playback rate multiplier. */
  speed: number;
  /** 1 plays forwards, -1 backwards. */
  direction: number;
  playMode: 'normal' | 'bounce';
  autoplay: boolean;
}

export interface DotLottieManifest {
  version: string;
  revision: number;
  generator: string;
  author?: string;
  animations: DotLottieManifestAnimation[];
}

export interface DotLottieOptions extends LottieOptions {
  /** Animation id inside the archive. Defaults to the animation name. */
  id?: string;
  /** Author recorded in the manifest. */
  author?: string;
  /** Whether a player should start on load. Defaults to true. */
  autoplay?: boolean;
  /** Playback rate recorded in the manifest. Defaults to 1. */
  speed?: number;
}

export interface DotLottieOutput {
  /** The `.lottie` archive itself. */
  file: Uint8Array;
  filename: string;
  /** What went into the archive, so callers can assert on it without unzipping. */
  manifest: DotLottieManifest;
  /** The animation the archive wraps, identical to what `toLottie` returns. */
  animation: LottieAnimation;
  warnings: Warning[];
}

/**
 * The ZIP epoch, used as every entry's timestamp.
 *
 * Exporting the same animation twice produces a byte-identical file, which is
 * what lets a build script commit its output and see a diff only when the
 * artwork actually changed. A real clock would make every run look like a
 * change. 1980-01-01 is the earliest a ZIP can express.
 */
const ZIP_EPOCH = new Date(Date.UTC(1980, 0, 1));

/** Strips anything that would be awkward as a filename inside the archive. */
function toArchiveId(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\.(json|lottie)$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned === '' ? 'animation' : cleaned;
}

/**
 * Renders a spec as a `.lottie` archive.
 *
 * dotLottie is a ZIP holding the same Lottie JSON plus a manifest. The
 * manifest is the reason to prefer it: a bare `.json` has nowhere to say
 * whether it should loop, so every embed has to be told separately and the
 * ping-pong and loop settings chosen here are lost the moment the file leaves
 * this tool. Here they travel with it.
 *
 * The JSON is deflated, which typically takes an icon to a fraction of its
 * size — the reason the format exists at all.
 */
export function toDotLottie(spec: AnimationSpec, options: DotLottieOptions = {}): DotLottieOutput {
  const rendered = toLottie(spec, options);
  const id = toArchiveId(options.id ?? options.name ?? rendered.animation.nm);

  const manifest: DotLottieManifest = {
    // dotLottie's own manifest version, not this package's.
    version: '1',
    revision: 1,
    generator: 'svgmotion',
    ...(options.author !== undefined ? { author: options.author } : {}),
    animations: [
      {
        id,
        loop: rendered.loop,
        speed: options.speed ?? 1,
        direction: 1,
        playMode: 'normal',
        autoplay: options.autoplay ?? true,
      },
    ],
  };

  const encoder = new TextEncoder();
  // Flat keys rather than a nested object: the nested form also writes a
  // directory entry for `animations/`, which the format does not ask for.
  const file = zipSync(
    {
      'manifest.json': encoder.encode(JSON.stringify(manifest)),
      [`animations/${id}.json`]: encoder.encode(JSON.stringify(rendered.animation)),
    },
    { level: 9, mtime: ZIP_EPOCH },
  );

  return {
    file,
    filename: `${id}.lottie`,
    manifest,
    animation: rendered.animation,
    warnings: rendered.warnings,
  };
}
