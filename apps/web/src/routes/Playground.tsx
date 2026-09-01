import { useCallback, useEffect, useState } from 'react';
import { Dropzone } from '../components/Dropzone.js';
import { LottiePlayer } from '../components/LottiePlayer.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { Button, Field, Panel, Select, Slider, Tabs, Toggle } from '../components/ui.js';
import { useI18n } from '../i18n/index.js';
import { parseLottieFile, type LottieFileSummary } from '../lib/lottie-file.js';
import {
  ANIMATION_URL_PLACEHOLDER,
  htmlEmbed,
  iframeEmbed,
  reactEmbed,
  vueEmbed,
} from '../lib/embed.js';

type EmbedFormat = 'html' | 'iframe' | 'react' | 'vue';

const BACKGROUNDS = {
  transparent: 'transparent',
  light: '#ffffff',
  dark: '#0f172a',
} as const;

type BackgroundName = keyof typeof BACKGROUNDS;

export function Playground({
  incoming,
  onConsumeIncoming,
}: {
  incoming: unknown | null;
  onConsumeIncoming: () => void;
}) {
  const { t, format: formatMessage } = useI18n();
  const [loaded, setLoaded] = useState<{ data: unknown; summary: LottieFileSummary } | null>(null);
  const [speed, setSpeed] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [size, setSize] = useState(320);
  const [background, setBackground] = useState<BackgroundName>('transparent');
  const [embedFormat, setEmbedFormat] = useState<EmbedFormat>('html');
  const [frame, setFrame] = useState({ current: 0, total: 0 });

  // An animation handed over from the Animate workspace arrives already built,
  // so it skips the file-reading path entirely. Clearing it is the parent's
  // state, which is why this runs in an effect rather than during render.
  useEffect(() => {
    if (!incoming) return;
    const parsed = parseLottieFile(JSON.stringify(incoming));
    if (parsed) {
      setLoaded({ data: parsed.data, summary: parsed.summary });
      setPlaying(true);
    }
    onConsumeIncoming();
  }, [incoming, onConsumeIncoming]);

  const loadFile = useCallback((text: string) => {
    const parsed = parseLottieFile(text);
    if (!parsed) throw new Error('not lottie');
    setLoaded({ data: parsed.data, summary: parsed.summary });
    setPlaying(true);
  }, []);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <Dropzone
          accept=".json,.lottie,application/json"
          title={t.dropLottie.title}
          hint={t.dropLottie.hint}
          rejectMessage={t.dropLottie.reject}
          onFile={loadFile}
        />
      </div>
    );
  }

  const embedOptions = {
    url: ANIMATION_URL_PLACEHOLDER,
    loop,
    speed,
    width: size,
    background: BACKGROUNDS[background],
  };

  const embedCode = {
    html: { code: htmlEmbed(embedOptions), filename: 'embed.html', mime: 'text/html' },
    iframe: { code: iframeEmbed(embedOptions), filename: 'embed.html', mime: 'text/html' },
    react: { code: reactEmbed(embedOptions), filename: 'LottieAnimation.tsx', mime: 'text/plain' },
    vue: { code: vueEmbed(embedOptions), filename: 'LottieAnimation.vue', mime: 'text/plain' },
  }[embedFormat];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Panel
          title={t.preview.title}
          action={
            <span className="font-mono text-xs text-slate-500">
              {formatMessage(t.player.frames, {
                current: frame.current,
                total: frame.total || loaded.summary.totalFrames,
              })}
            </span>
          }
        >
          <div
            className={`mx-auto ${background === 'transparent' ? 'preview-checkerboard rounded-lg' : ''}`}
            style={{ width: size, maxWidth: '100%' }}
          >
            <LottiePlayer
              animationData={loaded.data}
              background={BACKGROUNDS[background]}
              controls={{ speed, loop, direction, playing }}
              onFrame={(current, total) => setFrame({ current, total })}
            />
          </div>
        </Panel>

        <Panel title={t.embed.title}>
          <div className="space-y-3">
            <Tabs
              value={embedFormat}
              onChange={setEmbedFormat}
              options={(['html', 'iframe', 'react', 'vue'] as const).map((value) => ({
                value,
                label: t.embed[value],
              }))}
            />
            <p className="text-xs text-slate-500">
              {formatMessage(t.embed.hostedNote, { placeholder: ANIMATION_URL_PLACEHOLDER })}
            </p>
            <CodeBlock code={embedCode.code} filename={embedCode.filename} mime={embedCode.mime} />
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title={t.player.title}>
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-1 text-xs text-slate-600 dark:text-slate-400">
              <dt>Size</dt>
              <dd className="text-right font-mono">
                {loaded.summary.width}×{loaded.summary.height}
              </dd>
              <dt>Frame rate</dt>
              <dd className="text-right font-mono">{loaded.summary.frameRate} fps</dd>
              <dt>Duration</dt>
              <dd className="text-right font-mono">{loaded.summary.durationSeconds.toFixed(2)}s</dd>
              <dt>Layers</dt>
              <dd className="text-right font-mono">{loaded.summary.layerCount}</dd>
            </dl>

            <Button variant="primary" onClick={() => setPlaying((value) => !value)}>
              {playing ? t.player.pause : t.player.play}
            </Button>

            <Field label={t.player.speed}>
              <Slider value={speed} min={0.1} max={3} step={0.1} suffix="×" onChange={setSpeed} />
            </Field>

            <Field label={t.player.direction}>
              <Select
                value={direction === 1 ? 'forward' : 'reverse'}
                onChange={(value) => setDirection(value === 'forward' ? 1 : -1)}
                options={[
                  { value: 'forward' as const, label: t.player.forward },
                  { value: 'reverse' as const, label: t.player.reverse },
                ]}
              />
            </Field>

            <Field label={t.player.size}>
              <Slider value={size} min={80} max={640} step={8} suffix="px" onChange={setSize} />
            </Field>

            <Field label={t.preview.background}>
              <Select
                value={background}
                onChange={setBackground}
                options={[
                  { value: 'transparent' as const, label: t.preview.transparent },
                  { value: 'light' as const, label: t.preview.light },
                  { value: 'dark' as const, label: t.preview.dark },
                ]}
              />
            </Field>

            <Toggle checked={loop} label={t.player.loop} onChange={setLoop} />

            <Button variant="ghost" onClick={() => setLoaded(null)}>
              ← {t.dropLottie.title}
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
