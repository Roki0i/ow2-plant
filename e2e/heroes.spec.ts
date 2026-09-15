import { expect, test } from '@playwright/test';

test('search, role filters, keyboard focus, selection and mobile picker', async ({ page, isMobile }) => {
  await page.goto('./');
  const picker = page.locator(isMobile ? '.mobile-picker' : '.sidebar');
  await expect(page.locator('body')).not.toContainText(/PHASE|デモ用|開発確認用|品質・公開仕上げ/);
  for (const [role, name] of [['tank', 'D.Mon'], ['damage', 'Shion'], ['support', 'Wuyang']]) {
    await picker.getByLabel('ロール', { exact: true }).selectOption(role);
    await picker.getByLabel('ヒーロー検索').fill(name);
    await expect(picker.getByRole('status')).toHaveText('1 / 53 ヒーロー');
  }
  if (isMobile) {
    await picker.getByLabel('ヒーロー選択', { exact: true }).selectOption('wuyang');
    await picker.getByLabel('チーム', { exact: true }).selectOption('enemy');
  } else {
    const card = picker.getByRole('button', { name: 'WU Wuyang', exact: true });
    await card.focus();
    await expect(card).toBeFocused();
    expect(await card.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await picker.getByRole('button', { name: '◌ 敵', exact: true }).click();
  }
  await page.getByTestId('board').click();
  await expect(page.getByTestId('placement')).toContainText('Wuyang · 敵');
  await page.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page.getByTestId('placement')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('placement')).toHaveCount(1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByTestId('placement')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('placement')).toContainText('Wuyang · 敵');
  await picker.getByLabel('ヒーロー検索').fill('no such hero');
  await expect(picker.getByRole('status')).toHaveText('0 / 53 ヒーロー');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unknown hero import preserves existing strategy and storage', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('board').click();
  const raw = await page.evaluate(() => localStorage.getItem('ow2-plant.strategies.v1')!);
  const strategy = JSON.parse(raw)[0];
  strategy.elements[0].heroId = 'future-hero';
  await page.getByLabel('JSON Import', { exact: true }).setInputFiles({ name: 'future.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(strategy)) });
  await expect(page.getByRole('status').filter({ hasText: '未対応のHero ID' })).toContainText('future-hero');
  expect(await page.evaluate(() => localStorage.getItem('ow2-plant.strategies.v1'))).toBe(raw);
  await expect(page.getByTestId('placement')).toHaveCount(1);
});
