import type { AnimationSpec, Gradient, SvgNode, Warning } from '../types.js';
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
  animatedPathItem,
  fillItem,
  gradientFillItem,
  gradientStrokeItem,
  nodeCenter,
  pathItemsFor,
  strokeItem,
  transformItem,
  trimItem,
  type LottieShapeItem,
  type PathKeyframe,
} from './lottie/shapes.js';
import { isSimilarity } from './gradient.js';
import { subpathToBezier, translateBezier } from './lottie/path.js';
import { interpolateSubpaths, resolveMorph } from '../parse/morph.js';

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

/**
 * Reports the ways a document's gradients do not survive the trip to Lottie.
 *
 * Lottie carries gradients natively, but describes them with two points and a
 * colour ramp — which is less than SVG says. Each shortfall is reported once
 * per document rather than once per shape.
 */
function warnAboutGradients(spec: AnimationSpec, warnings: Warning[]): void {
  const gradients = spec.source.nodes.flatMap((node) =>
    [node.paint.fillGradient, node.paint.strokeGradient].filter(
      (gradient): gradient is Gradient => gradient !== undefined,
    ),
  );
  if (gradients.length === 0) return;

  const spread = gradients.filter((gradient) => gradient.spread !== 'pad').length;
  if (spread > 0) {
    warnings.push({
      code: 'lottie-unsupported',
      message:
        `${spread} gradient(s) repeat or reflect beyond their end stops. Lottie always ` +
        'pads, so the area past the last stop will be a flat colour.',
    });
  }

  const distorted = gradients.filter((gradient) => !isSimilarity(gradient.transform)).length;
  if (distorted > 0) {
    warnings.push({
      code: 'lottie-unsupported',
      message:
        `${distorted} gradient(s) are stretched or skewed by a transform or a non-square ` +
        'bounding box. Lottie states a gradient as two points, so those were approximated ' +
        'with an unstretched one. Use the SVG or CSS export to keep them exact.',
    });
  }
}

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

/**
 * Builds the path items for a node: static beziers normally, or animated
 * shape keyframes when a morph track targets it.
 *
 * Lottie has native geometry interpolation — a `sh` item's `ks` can carry one
 * complete bezier per keyframe — so a morph maps onto exactly the feature the
 * format designed for it, and stays editable in After Effects.
 */
function morphOrStaticPathItems(
  node: SvgNode,
  tracks: ResolvedTrack[],
  fps: number,
): LottieShapeItem[] {
  for (const resolved of tracks) {
    const progress = resolved.channels.find((channel) => channel.name === 'morphProgress');
    if (!progress) continue;
    const aligned = resolveMorph(resolved.track.params.toPath, node.subpaths);
    if (!aligned) continue;

    const centre = nodeCenter(node);
    // Every repetition of a loop has to exist as data on Lottie's timeline.
    const keyframes = expandChannel(progress, resolved.track);
    if (keyframes.length === 0) break;

    // A delayed morph still needs its resting shape from frame 0.
    if (keyframes[0]!.time > 0) {
      keyframes.unshift({ time: 0, value: keyframes[0]!.value, easing: resolved.track.easing });
    }

    return aligned.from.map((_, index) => {
      const pathKeyframes: PathKeyframe[] = keyframes.map((keyframe) => ({
        time: keyframe.time,
        bezier: translateBezier(
          subpathToBezier(interpolateSubpaths(aligned.from, aligned.to, keyframe.value)[index]!),
          centre,
        ),
        easing: keyframe.easing,
      }));
      return animatedPathItem(pathKeyframes, fps, index);
    });
  }

  return pathItemsFor(node);
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

  const items: LottieShapeItem[] = [...morphOrStaticPathItems(node, tracks, fps)];

  // The geometry was shifted onto the group's centre, so the gradient has to
  // move with it or it would paint from the shape's old position.
  const fill = gradientFillItem(node.paint, centre) ?? fillItem(node.paint);
  if (fill) items.push(fill);
  const stroke = gradientStrokeItem(node.paint, centre) ?? strokeItem(node.paint);
  if (stroke) items.push(stroke);

  const hasTrim = merged.has('trimStart') || merged.has('trimEnd');
  if (hasTrim) {
    // A missing stroke is not reported here: the stroke-draw preset already
    // validates it, and saying the same thing twice in different words reads
    // like two separate problems.

    // Trim must follow the stroke it modifies, so it is appended last.
    items.push(
      trimItem(
        propertyFor(merged, 'trimStart', fps, (v) => [v * 100], [0]),
        propertyFor(merged, 'trimEnd', fps, (v) => [v * 100], [100]),
        false,
      ),
    );
  }

  // The geometry was shifted onto the origin, so the anchor is already there
  // and position is what puts the shape back where it belongs on the canvas:
  // a player transforms a layer as `translate(position) · rotate · scale ·
  // translate(-anchor)`, which would cancel out if both were the centre.
  // Translation channels move the shape from there.
  const translateX = merged.get('translateX');
  const translateY = merged.get('translateY');
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
      a: staticProperty([0, 0]),
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
  // Lottie has no model for input events, so hover and scroll tracks cannot
  // exist in the file at all — baking them in as autoplay would misrepresent
  // the animation. They are dropped before resolution so they cannot stretch
  // the timeline.
  const isInteractive = (trigger: AnimationSpec['tracks'][number]['trigger']) =>
    trigger === 'hover' || trigger === 'scroll';
  const interactiveCount = spec.tracks.filter((track) => isInteractive(track.trigger)).length;
  const playable: AnimationSpec =
    interactiveCount === 0
      ? spec
      : { ...spec, tracks: spec.tracks.filter((track) => !isInteractive(track.trigger)) };

  const resolved = resolveSpec(playable);
  const warnings: Warning[] = [...spec.source.warnings, ...resolved.warnings];

  if (interactiveCount > 0) {
    warnings.push({
      code: 'lottie-unsupported',
      message:
        `${interactiveCount} hover- or scroll-triggered animation(s) were left out: Lottie ` +
        'has no concept of input events. Use the CSS export for those effects.',
    });
  }

  warnAboutGradients(spec, warnings);

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

  return { animation, warnings, loop: loopsForever(playable) };
}
