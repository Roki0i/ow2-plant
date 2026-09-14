import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page) {
  await page.goto('./');
  await expect(page.getByTestId('board').locator('canvas')).toBeVisible();
}
async function gesture(page: Page, mobile: boolean, from: { x: number; y: number }, to: { x: number; y: number }) {
  if (mobile) {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * i / 12, y: from.y + (to.y - from.y) * i / 12 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up();
  }
}
async function center(page: Page) {
  const board = page.getByTestId('board');
  await board.scrollIntoViewIfNeeded();
  const b = (await board.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
for (const mode of ['直線', '矢印', 'フリーハンド']) {
  test(`${mode}: create, select on canvas, style, delete, undo, redo and resize`, async ({ page, isMobile }) => {
    await setup(page);
    await page.getByRole('button', { name: mode, exact: true }).click();
    const c = await center(page);
    await gesture(page, isMobile, { x: c.x - 50, y: c.y - 15 }, { x: c.x + 50, y: c.y + 15 });
    const drawing = page.getByTestId('drawing');
    await expect(drawing).toHaveCount(1);
    const original = await drawing.getAttribute('data-element');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(drawing).toHaveCount(0);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(drawing).toHaveAttribute('data-element', original!);
    // Canvas hit testing, not only the accessible list.
    await page.getByRole('button', { name: '＋ 配置', exact: true }).click();
    const c2 = await center(page);
    if (isMobile) await page.touchscreen.tap(c2.x, c2.y + 60); else await page.mouse.click(c2.x, c2.y + 60);
    // Konva redraws its hit graph on the next animation frame after changing tools.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    if (isMobile) await page.touchscreen.tap(c2.x, c2.y); else await page.mouse.click(c2.x, c2.y);
    await page.getByLabel('描画色', { exact: true }).selectOption('#ffffff');
    await page.getByLabel('線幅', { exact: true }).selectOption('6');
    await expect(drawing).toHaveAttribute('data-element', /"width":6/);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(drawing).toHaveAttribute('data-element', /"width":3/);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(drawing).toHaveAttribute('data-element', original!);
    if (isMobile) await page.getByRole('button', { name: '削除', exact: true }).click();
    else { await page.getByRole('button', { name: '↖ 選択・移動', exact: true }).focus(); await page.keyboard.press('Delete'); }
    await expect(drawing).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(drawing).toHaveAttribute('data-element', original!);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(drawing).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.setViewportSize({ width: isMobile ? 740 : 900, height: 700 });
    await expect(drawing).toHaveAttribute('data-element', original!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('hero drag is one undo; pan, zoom and selection are not recorded; new edit clears redo', async ({ page, isMobile }) => {
  await setup(page);
  const c = await center(page);
  if (isMobile) await page.touchscreen.tap(c.x, c.y); else await page.mouse.click(c.x, c.y);
  const hero = page.getByTestId('placement');
  const original = await hero.getAttribute('data-x');
  await gesture(page, isMobile, c, { x: c.x + 50, y: c.y + 20 });
  await expect(hero).not.toHaveAttribute('data-x', original!);
  await page.getByRole('button', { name: '拡大', exact: true }).click();
  await page.getByRole('button', { name: '✥ パン', exact: true }).click();
  const p = await center(page);
  await gesture(page, isMobile, p, { x: p.x + 20, y: p.y + 20 });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(hero).toHaveAttribute('data-x', original!);
  await expect(page.getByTestId('board')).toHaveAttribute('data-zoom', '1.25');
  await page.getByRole('button', { name: '矢印', exact: true }).click();
  const d = await center(page);
  await gesture(page, isMobile, d, { x: d.x + 40, y: d.y + 15 });
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
});

for (const mode of ['直線', '矢印', 'フリーハンド']) {
  test(`${mode}: second finger cancels draft and does not resume until all fingers lift`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch gesture test');
    await setup(page);
    await page.getByRole('button', { name: mode, exact: true }).click();
    const c = await center(page);
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x - 40, y: c.y, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x - 20, y: c.y, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x - 20, y: c.y, id: 1 }, { x: c.x + 20, y: c.y, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x - 40, y: c.y + 10, id: 1 }, { x: c.x + 40, y: c.y + 10, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: c.x - 40, y: c.y + 10, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x - 10, y: c.y + 10, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByTestId('drawing')).toHaveCount(0);
    await expect(page.getByTestId('board')).toHaveAttribute('data-zoom', '2.00');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await gesture(page, true, c, { x: c.x + 50, y: c.y + 20 });
    await expect(page.getByTestId('drawing')).toHaveCount(1);
    await session.detach();
  });
}

test('editing text does not delete selected elements', async ({ page }) => {
  await setup(page); await page.getByTestId('board').click();
  await page.getByLabel('戦術名', { exact: true }).fill('test');
  await page.keyboard.press('Backspace');
  await expect(page.getByTestId('placement')).toHaveCount(1);
});
