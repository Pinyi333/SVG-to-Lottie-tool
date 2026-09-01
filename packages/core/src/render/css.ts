import { subpathsToPathData } from '../parse/geometry.js';
import { interpolateSubpaths, resolveMorph, type AlignedMorph } from '../parse/morph.js';
import { toCssEasing } from '../easing.js';
import type { Channel, Keyframe } from '../presets/channels.js';
import { CHANNEL_RESTING_VALUE, isTransformChannel } from '../presets/channels.js';
import { resolveSpec, type ResolvedTrack } from '../spec.js';
import { cycleCount } from '../timeline.js';
import type { AnimationSpec, Paint, SvgNode, Warning } from '../types.js';
import { GradientDefs } from './gradient.js';

export interface CssOutput {
  /** The stylesheet, with no surrounding `<style>` tag. */
  css: string;
  /** SVG markup carrying the class names the stylesheet targets. */
  html: string;
  warnings: Warning[];
}

export interface CssOptions {
  /** Prefix for every generated class and keyframe name. */
  prefix?: string;
  /** Decimal places kept in path data. */
  precision?: number;
}

const round = (n: number, places = 4): number => Number(n.toFixed(places));

/** Turns an arbitrary SVG id into something safe to embed in a class name. */
function slug(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+/, '');
  return cleaned === '' ? 'shape' : cleaned;
}

function paintAttributes(paint: Paint, defs: GradientDefs): string {
  const parts: string[] = [];
  // A gradient becomes a `<defs>` entry the paint points at; a solid colour
  // stays inline. Both go through the same attributes so the rest of the
  // markup does not have to care which one a shape uses.
  const fill = paint.fillGradient ? defs.reference(paint.fillGradient) : paint.fill;
  const stroke = paint.strokeGradient ? defs.reference(paint.strokeGradient) : paint.stroke;

  parts.push(`fill="${fill ?? 'none'}"`);
  if (fill !== null && paint.fillOpacity !== 1) {
    parts.push(`fill-opacity="${round(paint.fillOpacity)}"`);
  }
  if (stroke !== null) {
    parts.push(`stroke="${stroke}"`);
    parts.push(`stroke-width="${round(paint.strokeWidth)}"`);
    parts.push(`stroke-linecap="${paint.strokeLinecap}"`);
    parts.push(`stroke-linejoin="${paint.strokeLinejoin}"`);
    if (paint.strokeOpacity !== 1) parts.push(`stroke-opacity="${round(paint.strokeOpacity)}"`);
  }
  if (paint.opacity !== 1) parts.push(`opacity="${round(paint.opacity)}"`);
  return parts.join(' ');
}

/**
 * Combines the transform channels of a track into one CSS `transform` value
 * at a given keyframe position.
 *
 * CSS has a single `transform` property, so channels that map to it cannot be
 * emitted independently: a scale and a rotation on the same element have to
 * appear together in every keyframe, or the later declaration wins and the
 * earlier one silently disappears.
 */
function transformAt(channels: Channel[], t: number): string | null {
  const transformChannels = channels.filter((c) => isTransformChannel(c.name));
  if (transformChannels.length === 0) return null;

  const parts: string[] = [];
  for (const channel of transformChannels) {
    const value = valueAt(channel, t);
    switch (channel.name) {
      case 'translateX':
        parts.push(`translateX(${round(value)}px)`);
        break;
      case 'translateY':
        parts.push(`translateY(${round(value)}px)`);
        break;
      case 'rotation':
        parts.push(`rotate(${round(value)}deg)`);
        break;
      case 'scale':
        parts.push(`scale(${round(value)})`);
        break;
      default:
        break;
    }
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

/** Linearly reads a channel at position `t`; keyframe easing is applied by CSS itself. */
function valueAt(channel: Channel, t: number): number {
  const frames = channel.keyframes;
  if (frames.length === 0) return CHANNEL_RESTING_VALUE[channel.name];

  const exact = frames.find((frame) => Math.abs(frame.t - t) < 1e-9);
  if (exact) return exact.value;

  if (t <= frames[0]!.t) return frames[0]!.value;
  const last = frames[frames.length - 1]!;
  if (t >= last.t) return last.value;

  for (let i = 1; i < frames.length; i += 1) {
    const previous = frames[i - 1]!;
    const next = frames[i]!;
    if (t <= next.t) {
      const span = next.t - previous.t;
      const ratio = span === 0 ? 0 : (t - previous.t) / span;
      return previous.value + (next.value - previous.value) * ratio;
    }
  }
  return last.value;
}

/** Every distinct keyframe position across a track's channels, in order. */
function keyframePositions(channels: Channel[]): number[] {
  const positions = new Set<number>([0, 1]);
  for (const channel of channels) {
    for (const frame of channel.keyframes) positions.add(frame.t);
  }
  return [...positions].sort((a, b) => a - b);
}

/**
 * Finds the easing that governs the segment starting at `t`.
 *
 * CSS attaches the timing function to the keyframe a segment starts from, so
 * a per-keyframe easing has to be re-declared inside each keyframe block.
 */
function easingAt(channels: Channel[], t: number, fallback: string): string {
  for (const channel of channels) {
    const frame = channel.keyframes.find((k: Keyframe) => Math.abs(k.t - t) < 1e-9);
    if (frame?.easing) return toCssEasing(frame.easing);
  }
  return fallback;
}

/**
 * Resolves the aligned morph geometry for one track, or null when the track
 * does not morph or its target cannot be paired with the node.
 *
 * The failure cases are already reported by the preset's `validate`, so this
 * quietly renders the shape unmorphed rather than warning a second time.
 */
function morphFor(track: ResolvedTrack): AlignedMorph | null {
  if (!track.channels.some((c) => c.name === 'morphProgress')) return null;
  return resolveMorph(track.track.params.toPath, track.node.subpaths);
}

function declarationsAt(
  channels: Channel[],
  node: SvgNode,
  t: number,
  morph: AlignedMorph | null,
  precision: number,
): string[] {
  const declarations: string[] = [];

  const opacity = channels.find((c) => c.name === 'opacity');
  if (opacity) declarations.push(`opacity: ${round(valueAt(opacity, t))};`);

  const progress = channels.find((c) => c.name === 'morphProgress');
  if (progress && morph) {
    // CSS interpolates `d: path()` between keyframes on its own, but only when
    // every stop has the same command structure — which the aligned geometry
    // guarantees. The browser does the in-between frames; the stops here only
    // pin the values the keyframes were authored at.
    const shape = interpolateSubpaths(morph.from, morph.to, valueAt(progress, t));
    declarations.push(`d: path("${subpathsToPathData(shape, precision)}");`);
  }

  const transform = transformAt(channels, t);
  if (transform) declarations.push(`transform: ${transform};`);

  const trimEnd = channels.find((c) => c.name === 'trimEnd');
  const trimStart = channels.find((c) => c.name === 'trimStart');
  if (trimEnd || trimStart) {
    // CSS has no trim-path. A dash pattern the length of the whole outline,
    // offset by the hidden fraction, produces the same reveal.
    const visible = trimEnd ? valueAt(trimEnd, t) : 1 - valueAt(trimStart!, t);
    const hidden = 1 - visible;
    // A negative offset slides the gap the other way, so a reverse draw
    // reveals from the end of the path rather than the start.
    const sign = trimStart ? -1 : 1;
    declarations.push(`stroke-dashoffset: ${round(sign * hidden * node.length, 3)};`);
  }

  return declarations;
}

/**
 * Renders a spec as a stylesheet plus the SVG markup it animates.
 *
 * The two are returned separately so callers can place them wherever they
 * need — the app injects both into a preview iframe, and the SVG exporter
 * inlines the stylesheet into a single self-contained file.
 */
export function toCss(spec: AnimationSpec, options: CssOptions = {}): CssOutput {
  const prefix = options.prefix ?? 'svgm';
  const precision = options.precision ?? 3;
  const resolved = resolveSpec(spec);

  const byTarget = new Map<string, ResolvedTrack[]>();
  for (const track of resolved.tracks) {
    const existing = byTarget.get(track.node.id);
    if (existing) existing.push(track);
    else byTarget.set(track.node.id, [track]);
  }

  const rules: string[] = [];
  const keyframeBlocks: string[] = [];
  const markup: string[] = [];
  const defs = new GradientDefs(prefix, precision);

  for (const node of spec.source.nodes) {
    const tracks = byTarget.get(node.id) ?? [];
    const className = `${prefix}-${slug(node.id)}`;

    const morphs = new Map<ResolvedTrack, AlignedMorph | null>();
    for (const track of tracks) morphs.set(track, morphFor(track));

    // A morphing path's base `d` uses the aligned source geometry: it draws
    // the same shape, but shares its command structure with every keyframe
    // stop so the browser agrees to interpolate them.
    const firstMorph = [...morphs.values()].find((m) => m !== null);
    const d = subpathsToPathData(firstMorph ? firstMorph.from : node.subpaths, precision);

    markup.push(`  <path class="${className}" d="${d}" ${paintAttributes(node.paint, defs)} />`);

    if (tracks.length === 0) continue;

    const animations: string[] = [];
    const scrollAnimations: string[] = [];
    const hoverAnimations: string[] = [];
    const shared: string[] = [];
    let usesDash = false;

    tracks.forEach((resolvedTrack, index) => {
      const { track, channels } = resolvedTrack;
      const name = `${prefix}-${slug(node.id)}-${track.preset}${index > 0 ? `-${index}` : ''}`;
      const fallbackEasing = toCssEasing(track.easing);

      const steps = keyframePositions(channels)
        .map((t) => {
          const body = declarationsAt(
            channels,
            node,
            t,
            morphs.get(resolvedTrack) ?? null,
            precision,
          );
          if (body.length === 0) return null;
          const timing = easingAt(channels, t, fallbackEasing);
          // Declaring the timing function inside each stop is what lets a
          // bounce decelerate upward and accelerate downward in one animation.
          return `  ${round(t * 100, 2)}% {\n    ${body.join('\n    ')}\n    animation-timing-function: ${timing};\n  }`;
        })
        .filter((step): step is string => step !== null);

      if (steps.length === 0) return;

      keyframeBlocks.push(`@keyframes ${name} {\n${steps.join('\n')}\n}`);

      const count = cycleCount(track);
      const iterations = Number.isFinite(count) ? String(count) : 'infinite';
      const direction = track.loop.mode === 'pingpong' ? ' alternate' : '';
      const fill = track.loop.mode === 'none' ? ' both' : '';
      const shorthand =
        `${name} ${round(track.duration, 3)}s ${fallbackEasing} ${round(track.delay, 3)}s ` +
        `${iterations}${direction}${fill}`.trimEnd();
      if (track.trigger === 'hover') hoverAnimations.push(shorthand);
      else if (track.trigger === 'scroll') scrollAnimations.push(shorthand);
      else animations.push(shorthand);

      if (channels.some((c) => c.name === 'trimStart' || c.name === 'trimEnd')) usesDash = true;
      if (channels.some((c) => isTransformChannel(c.name))) {
        // Transforms must pivot on the shape itself, not the SVG origin.
        const cx = round(node.bbox.x + node.bbox.width / 2, 3);
        const cy = round(node.bbox.y + node.bbox.height / 2, 3);
        shared.push(`transform-origin: ${cx}px ${cy}px;`);
        shared.push('transform-box: view-box;');
      }
    });

    if (animations.length === 0 && scrollAnimations.length === 0 && hoverAnimations.length === 0) {
      continue;
    }

    if (usesDash) {
      // A dash as long as the outline leaves exactly one gap to slide.
      shared.push(`stroke-dasharray: ${round(node.length, 3)};`);
    }

    // `animation-timeline` is a coordinated list: one entry per animation, in
    // the same order. `view()` scrubs the animation as the icon crosses the
    // viewport; browsers without scroll-driven animations ignore the property
    // and simply autoplay, which is the least surprising fallback.
    const timelineList = (auto: number, scroll: number, trailing = 0) =>
      [
        ...Array<string>(auto).fill('auto'),
        ...Array<string>(scroll).fill('view()'),
        ...Array<string>(trailing).fill('auto'),
      ].join(', ');

    const unique = [...new Set(shared)];
    const body = [...unique];
    const base = [...animations, ...scrollAnimations];
    if (base.length > 0) {
      body.push(`animation: ${base.join(', ')};`);
      if (scrollAnimations.length > 0) {
        body.push(
          `animation-timeline: ${timelineList(animations.length, scrollAnimations.length)};`,
        );
      }
    }
    if (body.length > 0) rules.push(`.${className} {\n  ${body.join('\n  ')}\n}`);

    if (hoverAnimations.length > 0) {
      // The hover rule re-lists the other animations: `animation` is one
      // property, so a hover-only value would silently cancel them instead.
      const combined = [...animations, ...scrollAnimations, ...hoverAnimations].join(', ');
      const hoverBody = [`animation: ${combined};`];
      if (scrollAnimations.length > 0) {
        hoverBody.push(
          `animation-timeline: ${timelineList(
            animations.length,
            scrollAnimations.length,
            hoverAnimations.length,
          )};`,
        );
      }
      rules.push(`.${prefix}-icon:hover .${className} {\n  ${hoverBody.join('\n  ')}\n}`);
    }
  }

  const css = [...rules, ...keyframeBlocks].join('\n\n');
  const { viewBox } = spec.source;
  // Hovering anywhere on the icon should trigger every hover track at once,
  // so the hover selector hangs off a class on the root rather than the shape.
  const hasHover = resolved.tracks.some((track) => track.track.trigger === 'hover');
  const rootClass = hasHover ? `class="${prefix}-icon" ` : '';
  // `<defs>` has to precede the shapes that reference it for the markup to
  // stay valid when it is streamed or truncated, even though SVG itself would
  // resolve a forward reference.
  const defsMarkup = defs.markup('  ');
  const body = defsMarkup === '' ? markup.join('\n') : `${defsMarkup}\n${markup.join('\n')}`;
  const html =
    `<svg ${rootClass}xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}" ` +
    `width="${spec.source.width}" height="${spec.source.height}">\n` +
    `${body}\n</svg>`;

  return { css, html, warnings: [...spec.source.warnings, ...resolved.warnings] };
}
