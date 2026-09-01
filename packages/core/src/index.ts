export * from './types.js';
export { parseSvg, type ParseOptions } from './parse/index.js';
export { subpathsToPathData } from './parse/geometry.js';
export {
  collectGradients,
  referencedFallback,
  referencedId,
  resolveGradient,
  type GradientFailure,
  type GradientRegistry,
  type GradientResolution,
  type ResolveGradientOptions,
} from './parse/gradient.js';
export {
  alignForMorph,
  interpolateSubpaths,
  parseMorphTarget,
  resolveMorph,
  type AlignedMorph,
} from './parse/morph.js';
export {
  EASINGS,
  EASING_NAMES,
  easing,
  evaluateEasing,
  toCssEasing,
  toLottieHandles,
  type EasingName,
} from './easing.js';
export {
  PRESETS,
  PRESET_NAMES,
  buildTrack,
  type Channel,
  type ChannelName,
  type Keyframe,
  type PresetDefinition,
} from './presets/index.js';
export {
  animateAll,
  createSpec,
  createTrack,
  resolveSpec,
  type CreateSpecOptions,
  type ResolvedSpec,
  type ResolvedTrack,
  type TrackOptions,
} from './spec.js';
export {
  cycleCount,
  cycleDuration,
  expandChannel,
  loopsForever,
  specDuration,
  trackDuration,
  type AbsoluteKeyframe,
} from './timeline.js';
export { toCss, type CssOptions, type CssOutput } from './render/css.js';
export {
  GradientDefs,
  applyTransform,
  flattenGradient,
  isSimilarity,
  transformScale,
  type FlatGradient,
} from './render/gradient.js';
export { toSvg, type SvgOptions } from './render/svg.js';
export {
  toLottie,
  type LottieAnimation,
  type LottieLayer,
  type LottieOptions,
  type LottieOutput,
} from './render/lottie.js';
export { toReact } from './render/react.js';
export { toVue } from './render/vue.js';
export { componentName, type ComponentOptions, type ComponentOutput } from './render/framework.js';
