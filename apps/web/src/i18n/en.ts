export const en = {
  appName: 'SVGMotion',
  tagline: 'Animate SVG icons. Export to Lottie, CSS, React or Vue.',
  nav: { animate: 'Animate', playground: 'Lottie Playground' },

  drop: {
    title: 'Drop an SVG here',
    hint: 'or click to choose a file. Nothing is uploaded — everything runs in your browser.',
    sample: 'Try a sample icon',
    reject: 'That file is not an SVG.',
    tooLarge: 'That file is larger than {size}. Try a simpler icon.',
  },

  dropLottie: {
    title: 'Drop a Lottie file here',
    hint: 'or click to choose a .json or .lottie file.',
    reject: 'That file is not valid Lottie JSON or a .lottie archive.',
  },

  shapes: {
    title: 'Shapes',
    empty: 'No shapes found in this file.',
    animateAll: 'Animate all',
    clear: 'Clear all',
  },

  animation: {
    title: 'Animation',
    preset: 'Effect',
    duration: 'Duration',
    delay: 'Delay',
    easing: 'Easing',
    loop: 'Loop',
    stagger: 'Stagger',
    none: 'Play once',
    loopForever: 'Loop forever',
    pingpong: 'Back and forth',
    degrees: 'Rotation',
    from: 'From',
    to: 'To',
    height: 'Hop height',
    reverse: 'Draw from the far end',
    trigger: 'Play on',
    triggerAuto: 'Load',
    triggerHover: 'Hover',
    triggerScroll: 'Scroll',
    morphTarget: 'Morph into (path data)',
    morphTargetHint:
      'Paste the `d` of the path to morph into, drawn in the same viewBox. ' +
      'It must have the same number of subpaths as the shape.',
  },

  presets: {
    strokeDraw: 'Stroke draw',
    fade: 'Fade',
    scale: 'Scale',
    rotate: 'Rotate',
    bounce: 'Bounce',
    morph: 'Path morph',
  },

  preview: {
    title: 'Preview',
    replay: 'Replay',
    background: 'Background',
    transparent: 'Transparent',
    light: 'Light',
    dark: 'Dark',
    zoom: 'Zoom',
  },

  exportPanel: {
    title: 'Export',
    copy: 'Copy',
    copied: 'Copied',
    download: 'Download',
    downloadDotLottie: 'Download .lottie',
    openInPlayground: 'Open in Playground',
    formats: {
      lottie: 'Lottie JSON',
      css: 'CSS',
      svg: 'SVG',
      react: 'React',
      vue: 'Vue',
    },
  },

  player: {
    title: 'Player',
    speed: 'Speed',
    direction: 'Direction',
    forward: 'Forward',
    reverse: 'Reverse',
    loop: 'Loop',
    size: 'Size',
    play: 'Play',
    pause: 'Pause',
    frames: '{current} / {total} frames',
  },

  embed: {
    title: 'Embed',
    html: 'HTML',
    iframe: 'iframe',
    react: 'React',
    vue: 'Vue',
    hostedNote:
      'These snippets load the player from a CDN and fetch your animation from a URL you host. Replace {placeholder} with that URL.',
  },

  warnings: {
    title: 'Notes about this file',
    dismiss: 'Dismiss',
    lottieGap: 'Not everything in an SVG can become Lottie.',
  },

  footer: {
    source: 'Source',
    docs: 'Docs',
    license: 'MIT licensed',
  },

  empty: {
    title: 'Nothing loaded yet',
    body: 'Drop a file to get started.',
  },
};

export type Dictionary = typeof en;
