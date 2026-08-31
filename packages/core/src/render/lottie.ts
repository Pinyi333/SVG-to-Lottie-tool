import type { AnimationSpec, SvgNode, Warning } from '../types.js';
import { resolveSpec, type ResolvedTrack } from '../spec.js';
import { expandChannel, loopsForever, type AbsoluteKeyframe } from '../timeline.js';
import { CHANNEL_RESTING_VALUE, type ChannelName } from '../presets/channels.js';
import {
  animatedProperty,
  animatedVectorProperty,
  sampleAt,
  staticProperty,
  type LottieProperty,
} from './lottie/keyframe.js';
import {
  fillItem,
  nodeCenter,
  pathItemsFor,
  strokeItem,
  transformItem,
  trimItem,
  type LottieShapeItem,
} from './lottie/shapes.js';

/**
 * The Lottie schema version this exporter targets.
 *
 * 5.7.x is the widest-compatibility choice: it predates the features that
 * older native players reject, and every current web, iOS and Android player
 * reads it.
 */
const LOTTIE_VERSION = '5.7.4';

export interface LottieAnimation {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  ddd: number;
  assets: unknown[];
  layers: LottieLayer[];
  /** Not part of the format; a hint for players about how to loop this file. */
  markers: unknown[];
}

export interface LottieLayer {
  ddd: number;
  ind: number;
  ty: number;
  nm: string;
  sr: number;
  ks: Record<string, LottieProperty>;
  ao: number;
  shapes: LottieShapeItem[];
  ip: number;
  op: number;
  st: number;
  bm: number;
}

export interface LottieOutput {
  animation: LottieAnimation;
  warnings: Warning[];
  /** True when a player should be told to loop this file. */
  loop: boolean;
}

export interface LottieOptions {
  /** Name recorded in the file. Shown by some editors. */
  name?: string;
}

/** Features this exporter cannot represent, each explained once per document. */
const LOTTIE_GAPS: { test: (spec: AnimationSpec) => boolean; message: string }[] = [
  {
    test: (spec) => spec.source.warnings.some((w) => w.code === 'unsupported-paint'),
    message:
      'Gradient and pattern fills are exported as no fill. Convert them to solid colours ' +
      'before uploading, or use the CSS or SVG export instead.',
  },
];

/**
 * Merges the tracks targeting one node into a single set of channels.
 *
 * A node becomes exactly one Lottie layer, and a layer has one transform, so
 * two tracks driving the same property cannot both survive. The later track
 * wins and the collision is reported rather than silently resolved.
 */
function mergeChannels(
  tracks: ResolvedTrack[],
  node: SvgNode,
  warnings: Warning[],
): Map<ChannelName, { keyframes: AbsoluteKeyframe[] }> {
  const merged = new Map<ChannelName, { keyframes: AbsoluteKeyframe[] }>();

  for (const resolved of tracks) {
    for (const channel of resolved.channels) {
      if (merged.has(channel.name)) {
        warnings.push({
          code: 'lottie-unsupported',
          subject: node.id,
          message:
            `Two animations on "${node.id}" both drive ${channel.name}. ` +
            'Lottie gives each shape one transform, so only the last one was kept.',
        });
      }
      merged.set(channel.name, { keyframes: expandChannel(channel, resolved.track) });
    }
  }

  return merged;
}

/**
 * Builds a Lottie property for a channel, or a static resting value when the
 * node does not animate it.
 */
function propertyFor(
  merged: Map<ChannelName, { keyframes: AbsoluteKeyframe[] }>,
  name: ChannelName,
  fps: number,
  transform: (value: number) => number[],
  restingOverride?: number[],
): LottieProperty {
  const channel = merged.get(name);
  if (!channel || channel.keyframes.length === 0) {
    return staticProperty(restingOverride ?? transform(CHANNEL_RESTING_VALUE[name]));
  }
  return animatedProperty(channel.keyframes, fps, transform);
}

function buildLayer(
  node: SvgNode,
  tracks: ResolvedTrack[],
  spec: AnimationSpec,
  index: number,
  totalFrames: number,
  warnings: Warning[],
): LottieLayer {
  const merged = mergeChannels(tracks, node, warnings);
  const centre = nodeCenter(node);
  const fps = spec.fps;

  const items: LottieShapeItem[] = [...pathItemsFor(node)];

  const fill = fillItem(node.paint);
  if (fill) items.push(fill);
  const stroke = strokeItem(node.paint);
  if (stroke) items.push(stroke);

  const hasTrim = merged.has('trimStart') || merged.has('trimEnd');
  if (hasTrim) {
    if (!stroke) {
      warnings.push({
        code: 'lottie-unsupported',
        subject: node.id,
        message:
          `"${node.id}" has no stroke, so its stroke-draw animation produces nothing visible ` +
          'in the Lottie file.',
      });
    }
    // Trim must follow the stroke it modifies, so it is appended last.
    items.push(
      trimItem(
        propertyFor(merged, 'trimStart', fps, (v) => [v * 100], [0]),
        propertyFor(merged, 'trimEnd', fps, (v) => [v * 100], [100]),
        false,
      ),
    );
  }

  // The anchor sits at the shape's centre and the geometry was shifted to
  // match, so the position puts the shape back where it belongs on the canvas.
  const translateX = merged.get('translateX');
  const translateY = merged.get('translateY');

  // The anchor sits at the shape's centre and the geometry was shifted to
  // match, so position is what puts the shape back where it belongs on the
  // canvas. Translation channels move it from there.
  const positionProperty: LottieProperty =
    !translateX && !translateY
      ? staticProperty([centre.x, centre.y])
      : (() => {
          const times = new Set<number>();
          for (const keyframe of translateX?.keyframes ?? []) times.add(keyframe.time);
          for (const keyframe of translateY?.keyframes ?? []) times.add(keyframe.time);
          const ordered = [...times].sort((a, b) => a - b);

          return animatedVectorProperty(
            ordered,
            (time) => [
              centre.x + (translateX ? sampleAt(translateX.keyframes, time) : 0),
              centre.y + (translateY ? sampleAt(translateY.keyframes, time) : 0),
            ],
            (time) =>
              sampleEasing(translateX?.keyframes, time) ??
              sampleEasing(translateY?.keyframes, time) ??
              spec.tracks[0]?.easing ?? { x1: 0, y1: 0, x2: 1, y2: 1 },
            fps,
          );
        })();

  const layer: LottieLayer = {
    ddd: 0,
    ind: index + 1,
    ty: 4,
    nm: node.id,
    sr: 1,
    ks: {
      o: propertyFor(merged, 'opacity', fps, (v) => [v * 100 * node.paint.opacity]),
      r: propertyFor(merged, 'rotation', fps, (v) => [v]),
      p: positionProperty,
      a: staticProperty([centre.x, centre.y]),
      s: propertyFor(merged, 'scale', fps, (v) => [v * 100, v * 100]),
    },
    ao: 0,
    shapes: [
      {
        ty: 'gr',
        it: [
          ...items,
          transformItem({
            anchor: staticProperty([0, 0]),
            position: staticProperty([0, 0]),
            scale: staticProperty([100, 100]),
            rotation: staticProperty(0),
            opacity: staticProperty(100),
          }),
        ],
        nm: node.id,
      },
    ],
    ip: 0,
    op: totalFrames,
    st: 0,
    bm: 0,
  };

  return layer;
}

function sampleEasing(
  keyframes: AbsoluteKeyframe[] | undefined,
  time: number,
): AbsoluteKeyframe['easing'] | null {
  if (!keyframes) return null;
  const exact = keyframes.find((keyframe) => Math.abs(keyframe.time - time) < 1e-9);
  return exact?.easing ?? null;
}

/**
 * Renders a spec as Lottie JSON.
 *
 * Each shape becomes one shape layer whose anchor sits at its own centre, so
 * scale and rotation pivot on the shape rather than the composition origin.
 * Stroke draw uses Lottie's own Trim Paths modifier rather than a dash trick,
 * which is what makes the result editable in After Effects and identical
 * across native players.
 *
 * The returned `warnings` list every place the Lottie format cannot carry
 * something the source SVG had. Read it — silently dropping a gradient is the
 * fastest way to lose trust in an export.
 */
export function toLottie(spec: AnimationSpec, options: LottieOptions = {}): LottieOutput {
  const resolved = resolveSpec(spec);
  const warnings: Warning[] = [...spec.source.warnings, ...resolved.warnings];

  for (const gap of LOTTIE_GAPS) {
    if (gap.test(spec)) warnings.push({ code: 'lottie-unsupported', message: gap.message });
  }

  const byTarget = new Map<string, ResolvedTrack[]>();
  for (const track of resolved.tracks) {
    const existing = byTarget.get(track.node.id);
    if (existing) existing.push(track);
    else byTarget.set(track.node.id, [track]);
  }

  const totalFrames = Math.max(1, Math.round(resolved.duration * spec.fps));

  // Lottie paints the first layer on top, the opposite of SVG's document
  // order, so the layer list is reversed to preserve the original stacking.
  const layers = spec.source.nodes
    .map((node, index) =>
      buildLayer(node, byTarget.get(node.id) ?? [], spec, index, totalFrames, warnings),
    )
    .reverse()
    .map((layer, index) => ({ ...layer, ind: index + 1 }));

  const animation: LottieAnimation = {
    v: LOTTIE_VERSION,
    fr: spec.fps,
    ip: 0,
    op: totalFrames,
    w: Math.round(spec.source.width),
    h: Math.round(spec.source.height),
    nm: options.name ?? 'SVGMotion',
    ddd: 0,
    assets: [],
    layers,
    markers: [],
  };

  return { animation, warnings, loop: loopsForever(spec) };
}
