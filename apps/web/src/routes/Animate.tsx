import { useCallback, useMemo, useState } from 'react';
import {
  EASING_NAMES,
  PRESET_NAMES,
  createSpec,
  createTrack,
  easing,
  parseSvg,
  toCss,
  toDotLottie,
  toLottie,
  toReact,
  toSvg,
  toVue,
  type AnimationSpec,
  type EasingName,
  type LoopMode,
  type PresetName,
  type Track,
  type TrackTrigger,
} from 'svgmotion';
import { Dropzone } from '../components/Dropzone.js';
import { PreviewPane, type PreviewBackground } from '../components/PreviewPane.js';
import { CodeBlock } from '../components/CodeBlock.js';
import { WarningList } from '../components/WarningList.js';
import { Button, Field, Panel, Select, Slider, Tabs, Toggle } from '../components/ui.js';
import { useI18n } from '../i18n/index.js';
import { downloadBytes } from '../lib/download.js';
import { SAMPLES } from '../lib/samples.js';

type ExportFormat = 'lottie' | 'css' | 'svg' | 'react' | 'vue';

interface Settings {
  preset: PresetName;
  duration: number;
  delay: number;
  stagger: number;
  easingName: EasingName;
  loop: LoopMode;
  trigger: TrackTrigger;
  degrees: number;
  height: number;
  reverse: boolean;
  toPath: string;
}

const DEFAULT_SETTINGS: Settings = {
  preset: 'strokeDraw',
  duration: 1.2,
  delay: 0,
  stagger: 0.12,
  easingName: 'easeInOut',
  loop: 'none',
  trigger: 'auto',
  degrees: 360,
  height: 8,
  reverse: false,
  toPath: '',
};

/** Builds the parameters a preset actually reads, so unrelated knobs stay out. */
function paramsFor(settings: Settings): Track['params'] {
  switch (settings.preset) {
    case 'rotate':
      return { degrees: settings.degrees };
    case 'bounce':
      return { height: settings.height };
    case 'strokeDraw':
      return { reverse: settings.reverse };
    case 'morph':
      return { toPath: settings.toPath };
    default:
      return {};
  }
}

export function Animate({ onSendToPlayground }: { onSendToPlayground: (data: unknown) => void }) {
  const { t } = useI18n();
  const [source, setSource] = useState<{ text: string; name: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [format, setFormat] = useState<ExportFormat>('lottie');
  const [background, setBackground] = useState<PreviewBackground>('transparent');
  const [zoom, setZoom] = useState(0.7);
  const [replayKey, setReplayKey] = useState(0);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const parsed = useMemo(() => (source ? parseSvg(source.text) : null), [source]);

  const loadSvg = useCallback((text: string, name: string) => {
    setSource({ text, name });
    const nextParsed = parseSvg(text);
    // Selecting everything up front means the tool does something useful the
    // moment a file lands, rather than showing an inert preview.
    setSelected(new Set(nextParsed.nodes.map((node) => node.id)));
    setReplayKey((key) => key + 1);
  }, []);

  const spec = useMemo<AnimationSpec | null>(() => {
    if (!parsed) return null;
    const next = createSpec(parsed, { fps: 60 });
    const targets = parsed.nodes.filter((node) => selected.has(node.id));

    next.tracks = targets.map((node, index) =>
      createTrack(node.id, settings.preset, {
        duration: settings.duration,
        delay: settings.delay + index * settings.stagger,
        easing: easing(settings.easingName),
        loop: { mode: settings.loop },
        trigger: settings.trigger,
        params: paramsFor(settings),
      }),
    );
    return next;
  }, [parsed, selected, settings]);

  const componentName = useMemo(
    () => (source ? source.name.replace(/\.svg$/i, '') : 'AnimatedIcon'),
    [source],
  );

  const outputs = useMemo(() => {
    if (!spec) return null;
    const lottie = toLottie(spec, { name: componentName });
    // The archive wraps the same animation, so it costs one more zip of work
    // and nothing else; building it here keeps the download instant.
    const dotLottie = toDotLottie(spec, { name: componentName });
    const css = toCss(spec);
    const svg = toSvg(spec, { respectReducedMotion: true });
    const react = toReact(spec, { name: componentName });
    const vue = toVue(spec, { name: componentName });
    return { lottie, dotLottie, css, svg, react, vue };
  }, [spec, componentName]);

  const warnings = useMemo(() => {
    if (!outputs) return [];
    return [...outputs.svg.warnings, ...outputs.lottie.warnings];
  }, [outputs]);

  const replay = () => setReplayKey((key) => key + 1);

  if (!parsed || !spec || !outputs) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-10">
        <Dropzone
          accept=".svg,image/svg+xml"
          title={t.drop.title}
          hint={t.drop.hint}
          rejectMessage={t.drop.reject}
          onFile={loadSvg}
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-slate-500">{t.drop.sample}</span>
          {SAMPLES.map((sample) => (
            <Button key={sample.id} onClick={() => loadSvg(sample.svg, `${sample.id}.svg`)}>
              {sample.label}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const exportView = {
    lottie: {
      code: JSON.stringify(outputs.lottie.animation, null, 2),
      filename: `${componentName}.json`,
      mime: 'application/json',
    },
    css: {
      code: `${outputs.css.css}\n\n<!-- markup -->\n${outputs.css.html}`,
      filename: `${componentName}.css`,
      mime: 'text/css',
    },
    svg: { code: outputs.svg.html, filename: `${componentName}.svg`, mime: 'image/svg+xml' },
    react: { code: outputs.react.code, filename: outputs.react.filename, mime: 'text/plain' },
    vue: { code: outputs.vue.code, filename: outputs.vue.filename, mime: 'text/plain' },
  }[format];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Panel
          title={t.preview.title}
          action={<Button onClick={replay}>{t.preview.replay}</Button>}
        >
          <div className="space-y-3">
            <PreviewPane
              svg={outputs.svg.html}
              background={background}
              zoom={zoom}
              replayKey={replayKey}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.preview.background}>
                <Select
                  value={background}
                  onChange={(value) => setBackground(value)}
                  options={[
                    { value: 'transparent' as const, label: t.preview.transparent },
                    { value: 'light' as const, label: t.preview.light },
                    { value: 'dark' as const, label: t.preview.dark },
                  ]}
                />
              </Field>
              <Field label={t.preview.zoom}>
                <Slider value={zoom} min={0.2} max={1} step={0.05} onChange={setZoom} />
              </Field>
            </div>
          </div>
        </Panel>

        <WarningList warnings={warnings} />

        <Panel title={t.exportPanel.title}>
          <div className="space-y-3">
            <Tabs
              value={format}
              onChange={setFormat}
              options={(['lottie', 'css', 'svg', 'react', 'vue'] as const).map((value) => ({
                value,
                label: t.exportPanel.formats[value],
              }))}
            />
            <CodeBlock
              code={exportView.code}
              filename={exportView.filename}
              mime={exportView.mime}
              actions={
                format === 'lottie' ? (
                  <>
                    <Button
                      onClick={() =>
                        downloadBytes(
                          outputs.dotLottie.filename,
                          outputs.dotLottie.file,
                          'application/zip',
                        )
                      }
                    >
                      {t.exportPanel.downloadDotLottie}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => onSendToPlayground(outputs.lottie.animation)}
                    >
                      {t.exportPanel.openInPlayground}
                    </Button>
                  </>
                ) : null
              }
            />
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel
          title={t.shapes.title}
          action={
            <div className="flex gap-1">
              <Button
                variant="ghost"
                onClick={() => setSelected(new Set(parsed.nodes.map((node) => node.id)))}
              >
                {t.shapes.animateAll}
              </Button>
              <Button variant="ghost" onClick={() => setSelected(new Set())}>
                {t.shapes.clear}
              </Button>
            </div>
          }
        >
          {parsed.nodes.length === 0 ? (
            <p className="text-sm text-slate-500">{t.shapes.empty}</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto">
              {parsed.nodes.map((node) => (
                <li key={node.id}>
                  <Toggle
                    checked={selected.has(node.id)}
                    label={`${node.id}  ·  ${node.sourceTag}`}
                    onChange={(checked) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (checked) next.add(node.id);
                        else next.delete(node.id);
                        return next;
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t.animation.title}>
          <div className="space-y-3">
            <Field label={t.animation.preset}>
              <Select
                value={settings.preset}
                onChange={(value) => update('preset', value)}
                options={PRESET_NAMES.map((name) => ({ value: name, label: t.presets[name] }))}
              />
            </Field>

            <Field label={t.animation.duration}>
              <Slider
                value={settings.duration}
                min={0.2}
                max={5}
                step={0.1}
                suffix="s"
                onChange={(value) => update('duration', value)}
              />
            </Field>

            <Field label={t.animation.delay}>
              <Slider
                value={settings.delay}
                min={0}
                max={3}
                step={0.05}
                suffix="s"
                onChange={(value) => update('delay', value)}
              />
            </Field>

            <Field label={t.animation.stagger}>
              <Slider
                value={settings.stagger}
                min={0}
                max={1}
                step={0.02}
                suffix="s"
                onChange={(value) => update('stagger', value)}
              />
            </Field>

            <Field label={t.animation.easing}>
              <Select
                value={settings.easingName}
                onChange={(value) => update('easingName', value)}
                options={EASING_NAMES.map((name) => ({ value: name, label: name }))}
              />
            </Field>

            <Field label={t.animation.loop}>
              <Select
                value={settings.loop}
                onChange={(value) => update('loop', value)}
                options={[
                  { value: 'none' as const, label: t.animation.none },
                  { value: 'loop' as const, label: t.animation.loopForever },
                  { value: 'pingpong' as const, label: t.animation.pingpong },
                ]}
              />
            </Field>

            <Field label={t.animation.trigger}>
              <Select
                value={settings.trigger}
                onChange={(value) => update('trigger', value)}
                options={[
                  { value: 'auto' as const, label: t.animation.triggerAuto },
                  { value: 'hover' as const, label: t.animation.triggerHover },
                  { value: 'scroll' as const, label: t.animation.triggerScroll },
                ]}
              />
            </Field>

            {settings.preset === 'rotate' ? (
              <Field label={t.animation.degrees}>
                <Slider
                  value={settings.degrees}
                  min={-720}
                  max={720}
                  step={15}
                  suffix="°"
                  onChange={(value) => update('degrees', value)}
                />
              </Field>
            ) : null}

            {settings.preset === 'bounce' ? (
              <Field label={t.animation.height}>
                <Slider
                  value={settings.height}
                  min={1}
                  max={40}
                  step={1}
                  onChange={(value) => update('height', value)}
                />
              </Field>
            ) : null}

            {settings.preset === 'morph' ? (
              <Field label={t.animation.morphTarget} hint={t.animation.morphTargetHint}>
                <textarea
                  className="h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                  value={settings.toPath}
                  placeholder="M60 10 L80 10 L80 30 L60 30 Z"
                  spellCheck={false}
                  onChange={(event) => update('toPath', event.target.value)}
                />
              </Field>
            ) : null}

            {settings.preset === 'strokeDraw' ? (
              <Toggle
                checked={settings.reverse}
                label={t.animation.reverse}
                onChange={(value) => update('reverse', value)}
              />
            ) : null}

            <Button onClick={() => setSource(null)} variant="ghost">
              ← {t.drop.title}
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
