import { expect, test } from '@playwright/test';
const key = 'ow2-plant.strategies.v1';

test('save, reload, rename, duplicate, switch, delete and undo/redo', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('board').locator('canvas')).toBeVisible();
  await page.getByTestId('board').click();
  await page.getByLabel('戦術名', { exact: true }).fill('保存テスト');
  await page.getByRole('button', { name: '拡大', exact: true }).click();
  await expect(page.getByText('ブラウザに保存済み', { exact: false })).toBeVisible();
  const original = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!)[0], key);
  expect(Object.keys(original).sort()).toEqual(['id', 'schemaVersion', 'name', 'mapId', 'areaId', 'mapRevision', 'side', 'elements', 'createdAt', 'updatedAt'].sort());
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('placement')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('戦術名', { exact: true })).toHaveValue('保存テスト');
  await expect(page.getByTestId('placement')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByTestId('board')).toHaveAttribute('data-zoom', '1.00');
  await page.getByRole('button', { name: '戦術を複製', exact: true }).click();
  await expect(page.getByLabel('戦術一覧')).not.toHaveValue(original.id);
  await expect(page.getByTestId('placement')).toHaveCount(1);
  await page.getByLabel('戦術名', { exact: true }).fill('複製した戦術');
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '戦術を削除', exact: true }).click();
  await expect(page.getByLabel('戦術一覧')).toHaveValue(original.id);
  await page.getByRole('button', { name: '新規作成', exact: true }).click();
  await expect(page.getByTestId('placement')).toHaveCount(0);
  await page.getByLabel('戦術一覧').selectOption(original.id);
  await expect(page.getByTestId('placement')).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel('戦術一覧').locator('option')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('download round trip, collision and rejected imports preserve existing strategy', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('board').locator('canvas')).toBeVisible();
  await page.getByTestId('board').click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON Export', exact: true }).click();
  const download = await downloaded;
  const stream = (await download.createReadStream())!;
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const json = Buffer.concat(chunks).toString();
  const original = JSON.parse(json);
  const input = page.getByLabel('JSON Import', { exact: true });
  await input.setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.getByLabel('戦術一覧').locator('option')).toHaveCount(2);
  await expect(page.getByLabel('戦術一覧')).not.toHaveValue(original.id);
  await expect(page.getByTestId('placement')).toHaveCount(1);
  for (const invalid of ['{', JSON.stringify({ ...original, schemaVersion: 99 }), json.replace('"x": 0.5', '"x": 1e999')]) {
    await input.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(invalid) });
    await expect(page.getByText(/不正/)).toBeVisible();
    await expect(page.getByLabel('戦術一覧').locator('option')).toHaveCount(2);
    await expect(page.getByTestId('placement')).toHaveCount(1);
  }
});

test('storage quota failure keeps edits and undo; retry persists', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('board').locator('canvas')).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.assign(window, { restoreStorage: () => { Storage.prototype.setItem = original; } });
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  });
  await page.getByTestId('board').click();
  await expect(page.getByRole('alert')).toContainText('保存に失敗');
  await expect(page.getByTestId('placement')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('placement')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByTestId('placement')).toHaveCount(1);
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await page.getByRole('button', { name: '保存を再試行', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload(); await expect(page.getByTestId('placement')).toHaveCount(1);
});

test('corrupt storage is not overwritten automatically', async ({ page }) => {
  await page.addInitScript(k => localStorage.setItem(k, '{broken'), key);
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('読み込めません');
  await page.getByLabel('戦術名', { exact: true }).fill('退避用');
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('{broken');
});

test('local image export/import and reload allow reattachment without losing elements', async ({ page }) => {
  await page.goto('./');
  const board = page.getByTestId('board');
  await expect(board.locator('canvas')).toBeVisible();
  const png = await board.locator('canvas').screenshot();
  await page.getByText('背景画像の設定', { exact: true }).click();
  const input = page.locator('.image-settings input[type=file]');
  await input.setInputFiles({ name: 'map.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.map-notice')).toContainText('map.png');
  await board.click();
  await expect(page.getByTestId('placement')).toHaveCount(1);
  const strategy = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!)[0], key);
  await page.getByRole('button', { name: 'JSON Export', exact: true }).click();
  await expect(page.getByText('JSONを書き出しました。ローカル背景画像', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.locator('.map-notice')).toContainText('未設定');
  await expect(page.getByTestId('placement')).toHaveCount(1);
  await page.getByLabel('JSON Import', { exact: true }).setInputFiles({ name: 'local.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(strategy)) });
  await expect(page.getByLabel('戦術一覧').locator('option')).toHaveCount(2);
  await expect(page.getByText('Importしました。ローカル背景画像', { exact: false })).toBeVisible();
  await page.getByText('背景画像の設定', { exact: true }).click();
  await input.setInputFiles({ name: 'map.png', mimeType: 'image/png', buffer: png });
  await expect(board.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('placement')).toHaveCount(1);
});
