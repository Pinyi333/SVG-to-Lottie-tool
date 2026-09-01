import { useMemo } from 'react';

export type PreviewBackground = 'transparent' | 'light' | 'dark';

const BACKGROUNDS: Record<PreviewBackground, string> = {
  transparent: 'transparent',
  light: '#ffffff',
  dark: '#0f172a',
};

/**
 * Renders generated SVG inside an iframe.
 *
 * The isolation is the point, twice over. The generated stylesheet uses class
 * names taken from the source file's own ids, so injecting it into the app's
 * document would let a crafted icon restyle the surrounding UI. And the iframe
 * is what makes "replay" honest: remounting it restarts CSS animations from
 * frame zero, which no amount of class toggling reliably does.
 */
export function PreviewPane({
  svg,
  background,
  zoom,
  replayKey,
}: {
  svg: string;
  background: PreviewBackground;
  zoom: number;
  replayKey: number;
}) {
  const document = useMemo(() => {
    const scale = Math.round(zoom * 100);
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; height: 100%; }
  body {
    display: grid;
    place-items: center;
    background: ${BACKGROUNDS[background]};
  }
  svg { width: ${scale}%; height: auto; max-width: 100%; max-height: 100%; overflow: visible; }
</style>
</head>
<body>${svg}</body>
</html>`;
  }, [svg, background, zoom]);

  return (
    <div
      className={`aspect-square w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 ${
        background === 'transparent' ? 'preview-checkerboard' : ''
      }`}
    >
      <iframe
        // Remounting on replay is what restarts the CSS animations.
        key={replayKey}
        title="Animation preview"
        srcDoc={document}
        // The preview renders a file the visitor supplied. It needs no script,
        // no network, and no access to this page, so it is given none.
        sandbox=""
        className="h-full w-full border-0"
      />
    </div>
  );
}
