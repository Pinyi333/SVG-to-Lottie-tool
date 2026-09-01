import { useEffect, useRef, useState } from 'react';
import type { AnimationItem } from 'lottie-web';

export interface PlayerControls {
  speed: number;
  loop: boolean;
  direction: 1 | -1;
  playing: boolean;
}

/**
 * Wraps lottie-web's imperative player in a component.
 *
 * The animation is destroyed and rebuilt when the data changes, but only the
 * relevant setter is called when a control changes — reloading on every speed
 * tweak would restart playback and make the controls feel broken.
 */
export function LottiePlayer({
  animationData,
  controls,
  background,
  onFrame,
  onLoaded,
}: {
  animationData: unknown;
  controls: PlayerControls;
  background: string;
  onFrame?: (frame: number, total: number) => void;
  onLoaded?: (total: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setError(null);
    let instance: AnimationItem | null = null;
    // The effect can be torn down before the player finishes loading, in which
    // case the instance has to be destroyed as soon as it exists.
    let cancelled = false;

    // lottie-web is around half the app's bundle and only the Playground needs
    // it, so it is fetched on demand rather than shipped in the entry chunk.
    void import('lottie-web')
      .then(({ default: lottie }) => {
        if (cancelled) return;

        instance = lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop: controls.loop,
          autoplay: controls.playing,
          // The player mutates what it is given, so it gets a copy rather than
          // the object the rest of the app is holding.
          animationData: JSON.parse(JSON.stringify(animationData)),
        });

        animationRef.current = instance;
        instance.setSpeed(controls.speed);
        instance.setDirection(controls.direction);

        instance.addEventListener('enterFrame', () => {
          if (!instance) return;
          onFrame?.(Math.round(instance.currentFrame), Math.round(instance.totalFrames));
        });
        instance.addEventListener('DOMLoaded', () => {
          if (instance) onLoaded?.(Math.round(instance.totalFrames));
        });
        instance.addEventListener('error', () => setError('This animation could not be played.'));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      cancelled = true;
      instance?.destroy();
      animationRef.current = null;
    };
    // Controls are applied by the effects below; reloading on every change
    // would restart playback mid-scrub.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationData]);

  useEffect(() => {
    animationRef.current?.setSpeed(controls.speed);
  }, [controls.speed]);

  useEffect(() => {
    animationRef.current?.setDirection(controls.direction);
  }, [controls.direction]);

  useEffect(() => {
    const instance = animationRef.current;
    if (!instance) return;
    instance.loop = controls.loop;
  }, [controls.loop]);

  useEffect(() => {
    const instance = animationRef.current;
    if (!instance) return;
    if (controls.playing) instance.play();
    else instance.pause();
  }, [controls.playing]);

  if (error) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-lg border border-red-300 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="aspect-square w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"
      style={{ background }}
    />
  );
}
