import { unzipSync } from 'fflate';

/**
 * Minimal structural validation for a file claiming to be Lottie.
 *
 * A full schema check would be heavier than it is worth here: the player is
 * the real validator, and it reports its own errors. What this catches is the
 * common case of a visitor dropping some other JSON file, where failing early
 * with a clear message beats an opaque player error.
 */
export interface LottieFileSummary {
  width: number;
  height: number;
  frameRate: number;
  totalFrames: number;
  durationSeconds: number;
  layerCount: number;
  name: string | null;
}

export interface ParsedLottieFile {
  data: Record<string, unknown>;
  summary: LottieFileSummary;
}

/** What a `.lottie` archive carries beyond the animation itself. */
export interface DotLottieContents {
  /** The animation JSON, ready for `parseLottieFile`. */
  text: string;
  /** The manifest's loop setting, which a bare `.json` cannot express. */
  loop: boolean | null;
}

/**
 * Reads the animation out of a `.lottie` archive.
 *
 * A dotLottie file is a ZIP whose manifest names the animations and whose JSON
 * lives under `animations/`. The manifest decides which entry to play; a file
 * whose manifest is missing or disagrees is still worth playing when it holds
 * exactly one animation, so that is the fallback.
 */
export function readDotLottie(bytes: Uint8Array): DotLottieContents | null {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    return null;
  }

  const decoder = new TextDecoder();
  const animations = Object.keys(entries).filter(
    (name) => name.startsWith('animations/') && name.endsWith('.json'),
  );
  if (animations.length === 0) return null;

  let chosen = animations.length === 1 ? animations[0]! : null;
  let loop: boolean | null = null;

  const manifestBytes = entries['manifest.json'];
  if (manifestBytes) {
    try {
      const manifest = JSON.parse(decoder.decode(manifestBytes)) as {
        animations?: { id?: unknown; loop?: unknown }[];
      };
      const first = manifest.animations?.[0];
      if (typeof first?.loop === 'boolean') loop = first.loop;
      if (typeof first?.id === 'string') {
        const named = `animations/${first.id}.json`;
        if (entries[named]) chosen = named;
      }
    } catch {
      // A malformed manifest is not a reason to refuse a playable animation.
    }
  }

  // With several animations and nothing naming one, the first is as good a
  // guess as any — the alternative is refusing a file that plays fine.
  chosen ??= animations.sort()[0]!;
  return { text: decoder.decode(entries[chosen]!), loop };
}

export function parseLottieFile(text: string): ParsedLottieFile | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;

  const frameRate = Number(record.fr);
  const inPoint = Number(record.ip);
  const outPoint = Number(record.op);
  const width = Number(record.w);
  const height = Number(record.h);

  // `layers` is what separates a Lottie file from arbitrary JSON that happens
  // to have a few numeric fields.
  if (!Array.isArray(record.layers)) return null;
  if (![frameRate, inPoint, outPoint, width, height].every(Number.isFinite)) return null;
  if (frameRate <= 0 || outPoint <= inPoint) return null;

  const totalFrames = outPoint - inPoint;

  return {
    data: record,
    summary: {
      width,
      height,
      frameRate,
      totalFrames,
      durationSeconds: totalFrames / frameRate,
      layerCount: record.layers.length,
      name: typeof record.nm === 'string' ? record.nm : null,
    },
  };
}
