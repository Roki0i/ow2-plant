import { expect, test } from '@playwright/test';

test('loads map, places a hero, drags and retains normalized coordinates after resize', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const board = page.getByTestId('board');
  await expect(board.locator('canvas')).toBeVisible();
  await expect(page.getByText('デモ用の自作模式図です。', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'AN Ana', exact: true }).click();
  await board.scrollIntoViewIfNeeded();
  const bounds = (await board.boundingBox())!;
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  if (isMobile) await page.touchscreen.tap(start.x, start.y);
  else await page.mouse.click(start.x, start.y);
  await expect(page.getByTestId('element-count')).toHaveText('1 個配置');
  const placement = page.getByTestId('placement');
  expect(Number(await placement.getAttribute('data-x'))).toBeCloseTo(0.5, 2);
  expect(Number(await placement.getAttribute('data-y'))).toBeCloseTo(0.5, 2);
  if (!isMobile) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 80, start.y + 30, { steps: 8 });
    await page.mouse.up();
    await expect(placement).not.toHaveAttribute('data-x', '0.5');
  } else {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }] });
    for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: start.x + step * 6, y: start.y + step * 3 }],
    });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(placement).not.toHaveAttribute('data-x', '0.5');
  }
  const x = await placement.getAttribute('data-x');
  const y = await placement.getAttribute('data-y');
  await page.getByRole('button', { name: '拡大', exact: true }).click();
  await expect(board).toHaveAttribute('data-zoom', '1.25');
  await page.setViewportSize({ width: isMobile ? 740 : 900, height: 700 });
  await expect(placement).toHaveAttribute('data-x', x!);
  await expect(placement).toHaveAttribute('data-y', y!);
  await expect(page.getByTestId('element-count')).toHaveText('1 個配置');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await board.scrollIntoViewIfNeeded();
  await expect.poll(() => board.evaluate(element => {
    const canvas = element.querySelector('canvas')!;
    const context = canvas.getContext('2d')!;
    return context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[3];
  })).toBe(255);
  await page.screenshot({ path: `test-results/board-${isMobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
});

test('rejects invalid local files without losing placements', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('board').locator('canvas')).toBeVisible();
  await page.getByTestId('board').click();
  await expect(page.getByTestId('element-count')).toHaveText('1 個配置');
  await page.getByText('背景画像の設定', { exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('PNG・JPEG・WebP');
  await expect(page.getByTestId('board').locator('canvas')).toBeVisible();
  await expect(page.getByTestId('element-count')).toHaveText('1 個配置');
  page.on('dialog', dialog => dialog.accept());
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not a png') });
  await expect(page.getByRole('alert')).toContainText('画像を読み込めませんでした');
  await expect(page.getByTestId('element-count')).toHaveText('1 個配置');
});

test('loads a local image without uploading it and resets incompatible placements', async ({ page }) => {
  const outgoing: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') outgoing.push(request.url()); });
  await page.goto('/');
  const board = page.getByTestId('board');
  await expect(board.locator('canvas')).toBeVisible();
  const png = await board.locator('canvas').screenshot();
  await board.click();
  await expect(page.getByTestId('element-count')).toHaveText('1 個配置');
  await page.getByText('背景画像の設定', { exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  const file = { name: 'own-map.png', mimeType: 'image/png', buffer: png };
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByTestId('element-count')).toHaveText('1 個配置');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText('端末内の画像：own-map.png')).toBeVisible();
  await expect(page.getByTestId('element-count')).toHaveText('0 個配置');
  await page.getByRole('button', { name: '＋ 配置', exact: true }).click();
  await board.click();
  await expect(page.getByTestId('element-count')).toHaveText('1 個配置');
  expect(outgoing).toEqual([]);
});

test('two-finger pinch changes the viewport without placing heroes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch gesture test');
  await page.goto('/');
  const board = page.getByTestId('board');
  await expect(board.locator('canvas')).toBeVisible();
  await board.scrollIntoViewIfNeeded();
  const bounds = (await board.boundingBox())!;
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 30, y, id: 1 }, { x: x + 30, y, id: 2 }] });
  for (let step = 1; step <= 5; step++) await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x: x - 30 - step * 6, y, id: 1 }, { x: x + 30 + step * 6, y, id: 2 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(board).toHaveAttribute('data-zoom', '2.00');
  await expect(page.getByTestId('element-count')).toHaveText('0 個配置');
});
