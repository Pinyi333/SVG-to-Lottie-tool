import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { parseSvg } from '../src/parse/index.js';
import { animateAll, createSpec, createTrack } from '../src/spec.js';
import { toDotLottie } from '../src/render/dotlottie.js';
import { toLottie } from '../src/render/lottie.js';
import { fixture } from './helpers.js';

function specFor(tracks: ReturnType<typeof createTrack>[] = []) {
  const spec = createSpec(parseSvg(fixture('icon-check.svg')));
  spec.tracks = tracks;
  return spec;
}

/** Reads an exported archive back the way a player would. */
function unpack(file: Uint8Array) {
  const entries = unzipSync(file);
  const decoder = new TextDecoder();
  const read = (name: string) => {
    const bytes = entries[name];
    if (!bytes) throw new Error(`"${name}" is not in the archive: ${Object.keys(entries)}`);
    return JSON.parse(decoder.decode(bytes)) as unknown;
  };
  return { names: Object.keys(entries).sort(), read };
}

describe('toDotLottie', () => {
  it('writes a manifest and the animation at the paths the format specifies', () => {
    const { file } = toDotLottie(specFor([createTrack('tick', 'fade')]), { name: 'check' });
    const { names } = unpack(file);

    expect(names).toEqual(['animations/check.json', 'manifest.json']);
  });

  it('packs the same animation the Lottie export produces', () => {
    const spec = specFor([createTrack('tick', 'strokeDraw', { duration: 1.5 })]);
    const { file } = toDotLottie(spec, { name: 'check' });

    expect(unpack(file).read('animations/check.json')).toEqual(
      toLottie(spec, { name: 'check' }).animation,
    );
  });

  it('records the loop setting a bare .json has nowhere to put', () => {
    const looping = toDotLottie(
      specFor([createTrack('tick', 'fade', { loop: { mode: 'loop' } })]),
      { name: 'check' },
    );
    const once = toDotLottie(specFor([createTrack('tick', 'fade')]), { name: 'check' });

    expect(looping.manifest.animations[0]!.loop).toBe(true);
    expect(once.manifest.animations[0]!.loop).toBe(false);
    // And the manifest in the archive says the same as the returned one.
    expect(unpack(looping.file).read('manifest.json')).toEqual(looping.manifest);
  });

  it('names the animation entry after the manifest id', () => {
    const { file, manifest, filename } = toDotLottie(specFor(), { id: 'my icon.json' });

    expect(manifest.animations[0]!.id).toBe('my-icon');
    expect(filename).toBe('my-icon.lottie');
    expect(unpack(file).names).toContain('animations/my-icon.json');
  });

  it('falls back to a usable id when the name is empty or unusable', () => {
    expect(toDotLottie(specFor(), { id: '   ' }).manifest.animations[0]!.id).toBe('animation');
    expect(toDotLottie(specFor(), { id: '///' }).manifest.animations[0]!.id).toBe('animation');
  });

  it('carries the playback fields a player reads', () => {
    const { manifest } = toDotLottie(specFor(), { autoplay: false, speed: 2, author: 'Pat' });
    const animation = manifest.animations[0]!;

    expect(manifest.version).toBe('1');
    expect(manifest.generator).toBe('svgmotion');
    expect(manifest.author).toBe('Pat');
    expect(animation.autoplay).toBe(false);
    expect(animation.speed).toBe(2);
    expect(animation.direction).toBe(1);
  });

  it('omits the author rather than writing an empty one', () => {
    expect(toDotLottie(specFor()).manifest).not.toHaveProperty('author');
  });

  it('passes the Lottie export its warnings rather than swallowing them', () => {
    const spec = specFor([createTrack('tick', 'fade', { trigger: 'hover' })]);
    const { warnings } = toDotLottie(spec);

    expect(warnings.map((warning) => warning.code)).toContain('lottie-unsupported');
  });

  it('is byte-for-byte reproducible', () => {
    const spec = specFor([createTrack('tick', 'bounce')]);
    const first = toDotLottie(spec, { name: 'check' }).file;
    const second = toDotLottie(spec, { name: 'check' }).file;

    // A build script that commits its output should see a diff only when the
    // artwork changed, so no clock may leak into the archive.
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it('compresses rather than merely containing the JSON', () => {
    const shapes = createSpec(parseSvg(fixture('shapes.svg')));
    const spec = animateAll(shapes, 'bounce', { duration: 2 });
    const { file, animation } = toDotLottie(spec, { name: 'shapes' });

    // Deflating the JSON is the reason the format exists; on artwork of any
    // size it more than pays for the archive's fixed header overhead.
    expect(file.byteLength).toBeLessThan(JSON.stringify(animation).length / 4);
  });
});
