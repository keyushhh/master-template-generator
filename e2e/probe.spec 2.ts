import { test } from '@playwright/test';

test('probe editing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox').first().fill('designer@wozku.local');
  await page.locator('input[type="password"]').fill('1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: /New deck/i }).click();
  await page.getByText('Quick Sandbox').click();
  await page.getByRole('button', { name: /Create Deck with/i }).click();
  await page.getByRole('tab', { name: 'Edit' }).click();

  const slot = page.locator('.book [data-slide] [data-editable][data-slot="tagline"]').first();
  const box = await slot.boundingBox();
  console.log('box', box);
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  console.log('focused:', await slot.evaluate((n) => document.activeElement === n));
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Smoke');
  console.log('text now:', JSON.stringify(await slot.innerText()));
});
