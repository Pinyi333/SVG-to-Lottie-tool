/**
 * lottie-web probes for a 2D canvas context when its module loads, to build a
 * one-pixel scratch surface. jsdom has no canvas implementation, so the probe
 * throws before any test runs.
 *
 * The stub below satisfies that probe and nothing else. The playback tests use
 * lottie-web's SVG renderer, which never touches canvas, so a real
 * implementation would add a native build to CI without testing anything more.
 */
const context = {
  fillStyle: '',
  strokeStyle: '',
  fillRect: () => {},
  clearRect: () => {},
  drawImage: () => {},
  getImageData: (_x: number, _y: number, width: number, height: number) => ({
    data: new Uint8ClampedArray(Math.max(1, width * height * 4)),
    width,
    height,
  }),
  putImageData: () => {},
  createImageData: (width: number, height: number) => ({
    data: new Uint8ClampedArray(Math.max(1, width * height * 4)),
    width,
    height,
  }),
  setTransform: () => {},
  transform: () => {},
  save: () => {},
  restore: () => {},
  beginPath: () => {},
  closePath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  bezierCurveTo: () => {},
  fill: () => {},
  stroke: () => {},
  clip: () => {},
  canvas: null as unknown,
};

HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
  return { ...context, canvas: this };
} as unknown as HTMLCanvasElement['getContext'];
