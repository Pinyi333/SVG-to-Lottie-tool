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
