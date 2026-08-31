import type { AnimationSpec, ParsedSvg, PresetName, SvgNode, Track, Warning } from './types.js';
import { buildTrack, type Channel } from './presets/index.js';
import { DEFAULT_EASING, specDuration } from './timeline.js';

export interface CreateSpecOptions {
  fps?: number;
  /** Timeline length in seconds. Extended automatically if tracks need more. */
  duration?: number;
}

export interface TrackOptions {
  delay?: number;
  duration?: number;
  easing?: Track['easing'];
  loop?: Track['loop'];
  params?: Track['params'];
}

const DEFAULT_FPS = 60;
const DEFAULT_TRACK_DURATION = 1;

/** Builds a spec with no animation on it yet. */
export function createSpec(source: ParsedSvg, options: CreateSpecOptions = {}): AnimationSpec {
  return {
    source,
    fps: options.fps ?? DEFAULT_FPS,
    duration: options.duration ?? 0,
    tracks: [],
  };
}

/** Builds a track with defaults filled in, ready to push onto a spec. */
export function createTrack(
  targetId: string,
  preset: PresetName,
  options: TrackOptions = {},
): Track {
  return {
    targetId,
    preset,
    delay: options.delay ?? 0,
    duration: options.duration ?? DEFAULT_TRACK_DURATION,
    easing: options.easing ?? { ...DEFAULT_EASING },
    loop: options.loop ?? { mode: 'none' },
    params: options.params ?? {},
  };
}

/**
 * Applies one preset to every shape in the document, staggering the start
 * times. This is what the "animate everything" button in the app produces,
 * and the quickest way to get a usable result from an unfamiliar icon.
 */
export function animateAll(
  spec: AnimationSpec,
  preset: PresetName,
  options: TrackOptions & { stagger?: number } = {},
): AnimationSpec {
  const stagger = options.stagger ?? 0.08;
  const tracks = spec.source.nodes.map((node, index) =>
    createTrack(node.id, preset, {
      ...options,
      delay: (options.delay ?? 0) + index * stagger,
    }),
  );
  return { ...spec, tracks };
}

/** A track paired with the node it targets and the channels it produces. */
export interface ResolvedTrack {
  track: Track;
  node: SvgNode;
  channels: Channel[];
}

export interface ResolvedSpec {
  spec: AnimationSpec;
  tracks: ResolvedTrack[];
  /** Total timeline length in seconds, after accounting for delays and loops. */
  duration: number;
  warnings: Warning[];
}

/**
 * Resolves a spec once, so every exporter starts from the same data.
 *
 * Tracks pointing at a shape that is no longer in the document are dropped
 * with a warning rather than throwing: specs outlive the SVG they were built
 * against whenever a user swaps in a new file.
 */
export function resolveSpec(spec: AnimationSpec): ResolvedSpec {
  const byId = new Map(spec.source.nodes.map((node) => [node.id, node]));
  const warnings: Warning[] = [];
  const tracks: ResolvedTrack[] = [];

  for (const track of spec.tracks) {
    const node = byId.get(track.targetId);
    if (!node) {
      warnings.push({
        code: 'unsupported-attribute',
        subject: track.targetId,
        message: `No shape with id "${track.targetId}" exists in this SVG; its animation was skipped.`,
      });
      continue;
    }

    const built = buildTrack(track, node);
    warnings.push(...built.warnings);
    tracks.push({ track, node, channels: built.channels });
  }

  return { spec, tracks, duration: specDuration(spec), warnings };
}
