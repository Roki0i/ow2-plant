import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Strategy } from '../src/domain/types';
function createStrategy(): Strategy { return { id: crypto.randomUUID(), schemaVersion: 1, name: 'Fixture', mapId: 'kings-row', areaId: 'point-a', mapRevision: 'abstract-demo-v1', side: 'attack', elements: [], createdAt: '2026-09-14T00:00:00.000Z', updatedAt: '2026-09-14T00:00:00.000Z' }; }
import type { BoardElement } from '../src/domain/types';
const key = 'ow2-plant.strategies.v1';

test('two tabs pause saving, keep edits, confirm overwrite and reload safely', async ({ page, context }) => {
  await page.goto('./');
  await page.getByLabel('戦術名', { exact: true }).fill('original');
  const other = await context.newPage();
  await other.goto('./');
  await expect(other.getByLabel('戦術名', { exact: true })).toHaveValue('original');
  await other.getByLabel('戦術名', { exact: true }).fill('remote');
  await expect(page.getByRole('alert')).toContainText('他タブ');
  await page.getByRole('button', { name: '現在の編集を保持', exact: true }).click();
  await page.getByLabel('戦術名', { exact: true }).fill('local');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!)[0].name, key)).toBe('remote');
  page.once('dialog', d => d.dismiss());
  await page.getByRole('button', { name: '現在の内容で保存', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '現在の内容で保存', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(other.getByRole('alert')).toBeVisible();
  other.once('dialog', d => d.accept());
  await other.getByRole('button', { name: '保存済みを再読込', exact: true }).click();
  await expect(other.getByLabel('戦術名', { exact: true })).toHaveValue('local');
  await other.evaluate(k => localStorage.removeItem(k), key);
  await expect(page.getByRole('alert')).toBeVisible();
});

for (const [index, invalid] of ['{broken', JSON.stringify([{ ...createStrategy(), schemaVersion: 99 }])].entries()) {
  test(`storage recovery ${index}`, async ({ page }) => {
    await page.goto('./');
    await page.evaluate(({ key, invalid }) => localStorage.setItem(key, invalid), { key, invalid });
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('読み込めません');
    await page.getByLabel('戦術名', { exact: true }).fill('recovered');
    expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(invalid);
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: '保存を再試行', exact: true }).click();
    await page.reload();
    await expect(page.getByLabel('戦術名', { exact: true })).toHaveValue('recovered');
  });
}

test('keyboard alternative and literal untrusted text', async ({ page }) => {
  await page.goto('./');
  await page.getByText('キーボード・数値で配置と描画', { exact: true }).click();
  const button = page.getByRole('button', { name: '数値でヒーローを配置', exact: true });
  await page.keyboard.press('Tab');
  await button.focus();
  await expect(button).toBeFocused();
  expect(await button.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('placement')).toHaveCount(1);
  await page.getByRole('button', { name: '矢印', exact: true }).click();
  await page.getByRole('button', { name: '数値で描画を追加', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('drawing')).toHaveCount(1);
  const strategy = { ...createStrategy(), name: '<img src=x onerror=alert(1)>' };
  await page.getByLabel('JSON Import', { exact: true }).setInputFiles({ name: 'text.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(strategy)) });
  await expect(page.getByLabel('戦術名', { exact: true })).toHaveValue(strategy.name);
  await expect(page.locator('img')).toHaveCount(0);
});

for (const width of [375, 390, 412]) {
  test(`mobile layout ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./');
    await expect(page.getByTestId('board').locator('canvas')).toBeVisible();
    expect((await page.getByLabel('ヒーロー選択', { exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.getByLabel('ヒーロー選択', { exact: true }).selectOption('ana');
    await page.getByLabel('チーム', { exact: true }).selectOption('enemy');
    await page.getByTestId('board').click();
    await expect(page.getByTestId('placement')).toContainText('Ana · 敵');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.getByTestId('board').evaluate(el => getComputedStyle(el).touchAction)).toBe('none');
    await page.screenshot({ path: info.outputPath(`mobile-${width}.png`), fullPage: true });
  });
}

test('mixed 1000 element fixture stays editable', async ({ page }, info) => {
  const strategy = createStrategy();
  strategy.elements = Array.from({ length: 1000 }, (_, i): BoardElement => {
    const start = { x: (i % 40) / 40, y: Math.floor(i / 40) / 25 };
    const end = { x: Math.min(1, start.x + .02), y: Math.min(1, start.y + .02) };
    const base = { id: `fixture-${i}`, color: '#79ddd0', width: 3 };
    if (i % 4 === 0) return { id: base.id, type: 'hero', heroId: 'ana', team: i % 8 ? 'ally' : 'enemy', position: start };
    if (i % 4 === 3) return { ...base, type: 'stroke', points: Array.from({ length: 32 }, (_, n) => ({ x: start.x + (end.x - start.x) * n / 31, y: start.y + (end.y - start.y) * n / 31 })) };
    return { ...base, type: i % 4 === 1 ? 'line' : 'arrow', start, end };
  });
  await writeFile(info.outputPath('mixed-1000.json'), JSON.stringify(strategy));
  await info.attach('mixed-1000.json', { path: info.outputPath('mixed-1000.json'), contentType: 'application/json' });
  await page.goto('./');
  const started = Date.now();
  await page.getByLabel('JSON Import', { exact: true }).setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(strategy)) });
  await expect(page.getByTestId('placement')).toHaveCount(250);
  await expect(page.getByTestId('drawing')).toHaveCount(750);
  await expect(page.getByTestId('board').locator('canvas')).toBeVisible();
  const loaded = Date.now() - started;
  const action = Date.now();
  await page.getByRole('button', { name: '拡大', exact: true }).click();
  await expect(page.getByTestId('board')).toHaveAttribute('data-zoom', '1.25');
  await page.getByLabel('戦術名', { exact: true }).fill('large fixture edited');
  await expect(page.getByText('ブラウザに保存済み', { exact: true })).toBeVisible();
  const edited = Date.now() - action;
  await writeFile(info.outputPath('timings.json'), JSON.stringify({ importMs: loaded, zoomAndSaveMs: edited }));
  await info.attach('timings.json', { path: info.outputPath('timings.json'), contentType: 'application/json' });
  expect(loaded).toBeLessThan(10000);
  expect(edited).toBeLessThan(10000);
  await page.reload();
  await page.getByLabel('戦術一覧').selectOption(strategy.id);
  await expect(page.getByTestId('placement')).toHaveCount(250);
});
