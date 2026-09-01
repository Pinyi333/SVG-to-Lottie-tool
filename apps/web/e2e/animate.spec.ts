import { expect, test, type Page } from '@playwright/test';

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
