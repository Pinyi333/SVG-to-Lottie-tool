import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { parseLottieFile, readDotLottie } from './lottie-file.js';

const VALID = JSON.stringify({
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 60,
  w: 100,
  h: 100,
  nm: 'Example',
  layers: [{ ty: 4 }, { ty: 4 }],
});

describe('parseLottieFile', () => {
  it('summarizes a valid file', () => {
    const parsed = parseLottieFile(VALID);
    expect(parsed).not.toBeNull();
    expect(parsed!.summary).toEqual({
      width: 100,
      height: 100,
      frameRate: 30,
      totalFrames: 60,
      durationSeconds: 2,
      layerCount: 2,
      name: 'Example',
    });
  });

  it('measures duration from the in and out points, not from zero', () => {
    const offset = JSON.stringify({ fr: 30, ip: 30, op: 90, w: 10, h: 10, layers: [] });
    expect(parseLottieFile(offset)!.summary.durationSeconds).toBe(2);
  });

  it('rejects things that are not JSON', () => {
    expect(parseLottieFile('not json')).toBeNull();
    expect(parseLottieFile('')).toBeNull();
  });

  it('rejects JSON that is not an object', () => {
    expect(parseLottieFile('[1, 2, 3]')).toBeNull();
    expect(parseLottieFile('"a string"')).toBeNull();
    expect(parseLottieFile('null')).toBeNull();
  });

  it('rejects JSON that has no layers, which is what separates it from any other file', () => {
    const noLayers = JSON.stringify({ fr: 30, ip: 0, op: 60, w: 10, h: 10 });
    expect(parseLottieFile(noLayers)).toBeNull();
  });

  it('rejects a file whose timing could not be played', () => {
    const zeroFps = JSON.stringify({ fr: 0, ip: 0, op: 60, w: 10, h: 10, layers: [] });
    const backwards = JSON.stringify({ fr: 30, ip: 60, op: 30, w: 10, h: 10, layers: [] });
    const missing = JSON.stringify({ fr: 30, w: 10, h: 10, layers: [] });
    expect(parseLottieFile(zeroFps)).toBeNull();
    expect(parseLottieFile(backwards)).toBeNull();
    expect(parseLottieFile(missing)).toBeNull();
  });

  it('accepts a file with no name', () => {
    const unnamed = JSON.stringify({ fr: 30, ip: 0, op: 30, w: 10, h: 10, layers: [] });
    expect(parseLottieFile(unnamed)!.summary.name).toBeNull();
  });
});

/** Builds a `.lottie` the way the exporter does, so the reader is tested against it. */
function archive(entries: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  return zipSync(
    Object.fromEntries(Object.entries(entries).map(([name, body]) => [name, encoder.encode(body)])),
  );
}

const MANIFEST = JSON.stringify({
  version: '1',
  animations: [{ id: 'check', loop: true }],
});

describe('readDotLottie', () => {
  it('reads the animation the manifest names', () => {
    const file = archive({
      'manifest.json': MANIFEST,
      'animations/check.json': VALID,
      'animations/other.json': '{"not":"this one"}',
    });

    const contents = readDotLottie(file)!;
    expect(parseLottieFile(contents.text)!.summary.name).toBe('Example');
  });

  it('carries the loop setting the manifest records', () => {
    expect(
      readDotLottie(archive({ 'manifest.json': MANIFEST, 'animations/check.json': VALID }))!.loop,
    ).toBe(true);
    const off = JSON.stringify({ animations: [{ id: 'check', loop: false }] });
    expect(
      readDotLottie(archive({ 'manifest.json': off, 'animations/check.json': VALID }))!.loop,
    ).toBe(false);
  });

  it('plays a lone animation even when the manifest is missing or broken', () => {
    expect(readDotLottie(archive({ 'animations/only.json': VALID }))!.text).toBe(VALID);
    const broken = archive({ 'manifest.json': 'not json', 'animations/only.json': VALID });
    expect(readDotLottie(broken)!.loop).toBeNull();
  });

  it('refuses an archive with no animation in it', () => {
    expect(readDotLottie(archive({ 'manifest.json': MANIFEST }))).toBeNull();
  });

  it('refuses bytes that are not a ZIP at all', () => {
    expect(readDotLottie(new TextEncoder().encode(VALID))).toBeNull();
  });
});
