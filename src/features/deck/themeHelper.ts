import type { ThemeMode } from './types';

const DARK_TEMPLATES = new Set(['s4', 's14']);

/**
/ Determines whether a slide renders in Dark Mode or Light Mode based on
/ its template, deck-wide theme mode ('hybrid' | 'light' | 'dark'), and any per-slide override.
/ */
export function isSlideDark(templateId: string, deckThemeMode?: ThemeMode, themeOverride?: 'light' | 'dark'): boolean {
  if (themeOverride === 'dark') return true;
  if (themeOverride === 'light') return false;

  const mode = deckThemeMode ?? 'hybrid';
  if (mode === 'dark') return true;
  if (mode === 'light') return false;

  return DARK_TEMPLATES.has(templateId);
}
