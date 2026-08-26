import { test, expect, type Page } from '@playwright/test';

/**
 * The path a broken build breaks first: sign in, create a deck from a template,
 * edit a heading, reload, and find the edit still there.
 *
 * Deliberately one test rather than a suite. It exists to catch a white screen,
 * a dead persistence layer or a canvas that will not mount, which is what a unit
 * test cannot see. Feature-level behaviour belongs in the vitest suites and in
 * the export checks under scripts/.
 */

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox').first().fill('designer@wozku.local');
  await page.locator('input[type="password"]').fill('1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: /New deck/i })).toBeVisible();
}

const MARKER = 'SmokeEdit';

test('create a deck, edit it, and find the edit after a reload', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: /New deck/i }).click();
  await page.getByText('Quick Sandbox').click();

  // The gallery previews the whole template, so the arrows are part of the path.
  const gallery = page.getByRole('dialog', { name: /template gallery/i });
  await expect(gallery).toBeVisible();
  await expect(gallery.getByText(/^\d+ of \d+$/)).toBeVisible();
  await gallery.getByRole('button', { name: 'Next slide' }).click();
  await expect(gallery.getByText('2 of 14')).toBeVisible();

  await page.getByRole('button', { name: /Create Deck with/i }).click();

  // A first visit opens the getting-started tour, which is part of the path a
  // new user actually walks.
  const tour = page.getByRole('dialog', { name: 'Getting started' });
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: 'Skip' }).click();
  await expect(tour).toBeHidden();

  // The studio is up and drawing slides. The mode control is a tablist.
  const editTab = page.getByRole('tab', { name: 'Edit' });
  await expect(editTab).toBeVisible();
  await expect(page.locator('.wg-doc').first()).toBeVisible();

  await editTab.click();

  // Scoped to the canvas: the thumbnail rail draws the same text in view mode.
  // Clicking through the mouse rather than focus() so the caret lands the way a
  // person's would, then appending rather than replacing: a select-all inside a
  // contentEditable destroys the text node the caret sits in, and only the
  // browser puts it back.
  const slot = page.locator('.book [data-slide] [data-editable][data-slot="tagline"]').first();
  const box = await slot.boundingBox();
  if (!box) throw new Error('the canvas drew no editable tagline');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(slot).toBeFocused();

  // insertText, not type: a per-character insertion into a contentEditable is
  // at the mercy of where the browser leaves the caret between keystrokes, and
  // this is asserting persistence, not caret behaviour.
  await page.keyboard.insertText(MARKER);
  await page.keyboard.press('Tab');

  // Case-insensitive: several slots are uppercased in CSS, so the rendered text
  // is not the stored text.
  await expect(page.locator('.book').getByText(new RegExp(MARKER, 'i')).first()).toBeVisible();

  // The whole point: it is still there after a reload, from storage alone.
  await page.reload();
  await expect(page.locator('.book').getByText(new RegExp(MARKER, 'i')).first()).toBeVisible();
});
