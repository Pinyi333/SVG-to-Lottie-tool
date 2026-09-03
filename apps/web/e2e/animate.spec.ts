import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';

const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
  <path id="tick" d="M20 6 9 17l-5-5" />
</svg>`;

/** Drops an SVG onto the page the way a visitor would, via the file input. */
async function uploadSvg(page: Page, markup = CHECK_ICON) {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'check.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(markup),
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('loads with the animate workspace ready for a file', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'SVGMotion' })).toBeVisible();
  await expect(page.getByText('Drop an SVG here')).toBeVisible();
});

test('animates a sample icon and previews it', async ({ page }) => {
  await page.getByRole('button', { name: 'Check' }).click();

  await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();

  // The preview is an isolated iframe; the generated animation lives inside it.
  const preview = page.frameLocator('iframe[title="Animation preview"]');
  await expect(preview.locator('svg')).toBeVisible();
  await expect(preview.locator('path').first()).toBeVisible();
});

test('a sample brings the effect its own artwork can show', async ({ page }) => {
  // The Chart sample is filled bars with no stroke. Stroke draw runs on it
  // perfectly well and displays nothing, so loading it has to switch the
  // effect as well as the artwork or the tool looks broken on first use.
  await page.getByRole('button', { name: 'Chart' }).click();
  await expect(page.getByLabel('Effect')).toHaveValue('bounce');
  await expect(page.getByText('has no stroke')).toHaveCount(0);

  // The sample buttons only exist in the empty state, so the stroked sample
  // is checked from a fresh load rather than by switching in place.
  await page.goto('./');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByLabel('Effect')).toHaveValue('strokeDraw');
});

test('exports Lottie JSON that parses and describes the animation', async ({ page }) => {
  await uploadSvg(page);

  await page.getByRole('tab', { name: 'Lottie JSON' }).click();
  const code = await page.locator('pre code').innerText();

  const animation = JSON.parse(code);
  expect(animation.layers).toHaveLength(1);
  expect(animation.layers[0].nm).toBe('tick');
  expect(animation.w).toBe(24);
  // A stroke draw is the default preset, so trim paths must be present.
  const items = animation.layers[0].shapes[0].it;
  expect(items.map((item: { ty: string }) => item.ty)).toContain('tm');
});

test('downloads a .lottie archive holding the manifest and the animation', async ({ page }) => {
  await uploadSvg(page);
  await page.getByRole('tab', { name: 'Lottie JSON' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download .lottie' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('check.lottie');

  const path = await download.path();
  const archive = unzipSync(new Uint8Array(await readFile(path)));
  const decoder = new TextDecoder();

  // Reading the archive back is what proves the browser wrote real bytes: a
  // ZIP handed through a text encode still downloads, and is still corrupt.
  const manifest = JSON.parse(decoder.decode(archive['manifest.json']!));
  expect(manifest.animations[0].id).toBe('check');
  const animation = JSON.parse(decoder.decode(archive['animations/check.json']!));
  expect(animation.layers[0].nm).toBe('tick');
});

test('switches export format without losing the loaded file', async ({ page }) => {
  await uploadSvg(page);

  for (const [format, expected] of [
    ['CSS', '@keyframes'],
    ['SVG', '<svg'],
    ['React', 'export function'],
    ['Vue', '<template>'],
  ] as const) {
    await page.getByRole('tab', { name: format, exact: true }).click();
    await expect(page.locator('pre code')).toContainText(expected);
  }
});

test('changing the effect changes the exported animation', async ({ page }) => {
  await uploadSvg(page);
  await page.getByRole('tab', { name: 'CSS' }).click();

  await expect(page.locator('pre code')).toContainText('stroke-dashoffset');

  await page.getByLabel('Effect').selectOption('rotate');
  await expect(page.locator('pre code')).toContainText('rotate(');
  await expect(page.locator('pre code')).not.toContainText('stroke-dashoffset');
});

test('warns rather than silently producing an invisible animation', async ({ page }) => {
  // A filled rect with no stroke cannot show a stroke-draw animation.
  await uploadSvg(
    page,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect id="box" width="10" height="10" fill="red"/></svg>`,
  );

  await expect(page.getByText('Notes about this file')).toBeVisible();
  await expect(page.getByText(/has no stroke/)).toBeVisible();
});

test('hands an animation to the playground and plays it', async ({ page }) => {
  await uploadSvg(page);

  await page.getByRole('tab', { name: 'Lottie JSON' }).click();
  await page.getByRole('button', { name: 'Open in Playground' }).click();

  // The player chunk is fetched on demand, so this also proves the lazy
  // import resolves under the deployed base path.
  await expect(page.getByRole('heading', { name: 'Player' })).toBeVisible();
  await expect(page.getByText('Frame rate')).toBeVisible();
  await expect(page.locator('#root svg').first()).toBeVisible();
});

test('takes back a .lottie it exported and plays it', async ({ page }) => {
  await uploadSvg(page);
  await page.getByRole('tab', { name: 'Lottie JSON' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download .lottie' }).click(),
  ]);
  const archive = await readFile(await download.path());

  // The round trip is the real test of the format work: what one workspace
  // writes, the other has to be able to open.
  await page.getByRole('tab', { name: 'Lottie Playground' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'check.lottie',
    mimeType: 'application/zip',
    buffer: archive,
  });

  await expect(page.getByRole('heading', { name: 'Player' })).toBeVisible();
  await expect(page.locator('#root svg').first()).toBeVisible();
  await expect(page.getByText('Frame rate')).toBeVisible();
});

test('generates an embed snippet in the playground', async ({ page }) => {
  await uploadSvg(page);
  await page.getByRole('tab', { name: 'Lottie JSON' }).click();
  await page.getByRole('button', { name: 'Open in Playground' }).click();

  await expect(page.getByRole('heading', { name: 'Embed' })).toBeVisible();
  await expect(page.locator('pre code')).toContainText('lottie.loadAnimation');

  await page.getByRole('tab', { name: 'React' }).click();
  await expect(page.locator('pre code')).toContainText('useEffect');
});

test('switches interface language', async ({ page }) => {
  await page.getByLabel('Language').selectOption('zh-TW');
  await expect(page.getByText('把 SVG 拖曳到這裡')).toBeVisible();

  await page.getByLabel('Language').selectOption('en');
  await expect(page.getByText('Drop an SVG here')).toBeVisible();
});
