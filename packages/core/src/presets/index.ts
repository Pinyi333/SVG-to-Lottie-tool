import { EASINGS } from '../easing.js';
import { alignForMorph, parseMorphTarget } from '../parse/morph.js';
import type { PresetName, SvgNode, Track, Warning } from '../types.js';
import type { Channel, Keyframe } from './channels.js';

export * from './channels.js';

export interface PresetDefinition {
  name: PresetName;
  /** Short description used by the UI and the generated documentation. */
  summary: string;
  /** Whether Lottie can express this preset at all. */
  lottieSupported: boolean;
  build(track: Track, node: SvgNode): Channel[];
  /** Reports conditions that make this preset a no-op on a given node. */
  validate?(track: Track, node: SvgNode): Warning[];
}

const fade: PresetDefinition = {
  name: 'fade',
  summary: 'Fades the shape in from fully transparent.',
  lottieSupported: true,
  build: (track) => {
    const from = track.params.from ?? 0;
    const to = track.params.to ?? 1;
    return [
      {
        name: 'opacity',
        keyframes: [
          { t: 0, value: from },
          { t: 1, value: to },
        ],
      },
    ];
  },
};

const scale: PresetDefinition = {
  name: 'scale',
  summary: 'Grows the shape from a smaller size to its natural size.',
  lottieSupported: true,
  build: (track) => {
    const from = track.params.from ?? 0;
    const to = track.params.to ?? 1;
    return [
      {
        name: 'scale',
        keyframes: [
          { t: 0, value: from },
          { t: 1, value: to },
        ],
      },
    ];
  },
};

const rotate: PresetDefinition = {
  name: 'rotate',
  summary: 'Spins the shape about its own centre.',
  lottieSupported: true,
  build: (track) => {
    const degrees = track.params.degrees ?? 360;
    return [
      {
        name: 'rotation',
        keyframes: [
          { t: 0, value: 0 },
          { t: 1, value: degrees },
        ],
      },
    ];
  },
};

/**
 * Number of hops in a bounce, and how much height each one keeps relative to
 * the one before. The decay is what makes it read as a bounce rather than a
 * repeated hop.
 */
const BOUNCE_HOPS = 3;
const BOUNCE_DECAY = 0.45;

const bounce: PresetDefinition = {
  name: 'bounce',
  summary: 'Drops the shape through a few decaying hops.',
  lottieSupported: true,
  build: (track, node) => {
    // Default the hop height to a quarter of the shape, so the motion reads at
    // any icon size without the caller having to tune it.
    const peak = track.params.height ?? Math.max(node.bbox.height, 1) * 0.25;

    // A keyframe's easing governs the segment leaving it, so the floor
    // keyframes carry the rise curve and the peaks carry the fall curve.
    const keyframes: Keyframe[] = [{ t: 0, value: 0, easing: EASINGS.easeOut }];
    let height = peak;
    // Each hop takes less time than the last, in proportion to its height.
    const weights: number[] = [];
    for (let hop = 0; hop < BOUNCE_HOPS; hop += 1) weights.push(Math.pow(BOUNCE_DECAY, hop / 2));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) * 2;

    let elapsed = 0;
    for (let hop = 0; hop < BOUNCE_HOPS; hop += 1) {
      const half = weights[hop]! / totalWeight;
      elapsed += half;
      // Leaving the peak means falling, which accelerates.
      keyframes.push({ t: elapsed, value: -height, easing: EASINGS.easeIn });
      elapsed += half;
      // Leaving the floor means rising, which decelerates into the next peak.
      keyframes.push({ t: elapsed, value: 0, easing: EASINGS.easeOut });
      height *= BOUNCE_DECAY;
    }

    // Absorb rounding drift so the final keyframe lands exactly on the end.
    keyframes[keyframes.length - 1]!.t = 1;

    return [{ name: 'translateY', keyframes }];
  },
};

const strokeDraw: PresetDefinition = {
  name: 'strokeDraw',
  summary: 'Draws the outline on as if by a pen.',
  lottieSupported: true,
  build: (track) => {
    // Drawing forward grows the visible span from the start of the path;
    // drawing in reverse pulls the start back towards a fixed end instead.
    if (track.params.reverse) {
      return [
        {
          name: 'trimStart',
          keyframes: [
            { t: 0, value: 1 },
            { t: 1, value: 0 },
          ],
        },
      ];
    }
    return [
      {
        name: 'trimEnd',
        keyframes: [
          { t: 0, value: 0 },
          { t: 1, value: 1 },
        ],
      },
    ];
  },
  validate: (_track, node) => {
    if (node.paint.stroke === null) {
      return [
        {
          code: 'unsupported-paint',
          subject: node.id,
          message:
            `"${node.id}" has no stroke, so the stroke-draw animation will not be visible. ` +
            'Give the shape a stroke colour, or pick a different animation.',
        },
      ];
    }
    return [];
  },
};

const morph: PresetDefinition = {
  name: 'morph',
  summary: 'Reshapes the path into a target path.',
  lottieSupported: true,
  build: () => [
    {
      name: 'morphProgress',
      keyframes: [
        { t: 0, value: 0 },
        { t: 1, value: 1 },
      ],
    },
  ],
  validate: (track, node) => {
    const raw = track.params.toPath;
    if (!raw || raw.trim() === '') {
      return [
        {
          code: 'morph-mismatch',
          subject: node.id,
          message:
            `The morph on "${node.id}" has no target path, so the shape will not change. ` +
            'Set params.toPath to the path data to morph into.',
        },
      ];
    }

    const target = parseMorphTarget(raw);
    if (target.length === 0) {
      return [
        {
          code: 'morph-mismatch',
          subject: node.id,
          message: `The morph target for "${node.id}" could not be parsed as path data.`,
        },
      ];
    }

    if (!alignForMorph(node.subpaths, target)) {
      return [
        {
          code: 'morph-mismatch',
          subject: node.id,
          message:
            `"${node.id}" has ${node.subpaths.length} subpath(s) but its morph target has ` +
            `${target.length}. There is no sensible way to pair them, so the morph was skipped. ` +
            'Redraw the target with the same number of subpaths.',
        },
      ];
    }

    return [];
  },
};

export const PRESETS: Record<PresetName, PresetDefinition> = {
  fade,
  scale,
  rotate,
  bounce,
  strokeDraw,
  morph,
};

export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

/** Builds the channels for one track, plus any warnings the preset raised. */
export function buildTrack(
  track: Track,
  node: SvgNode,
): { channels: Channel[]; warnings: Warning[] } {
  const preset = PRESETS[track.preset];
  return {
    channels: preset.build(track, node),
    warnings: preset.validate?.(track, node) ?? [],
  };
}
