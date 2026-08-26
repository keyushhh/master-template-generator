/**
 * Which modifier key this machine calls the primary one.
 *
 * A shortcut hint that says the wrong key is worse than no hint: someone on
 * Windows reading "⌘K" has to work out that it means Ctrl, and someone on a Mac
 * reading "Ctrl+K" will press the wrong thing and conclude the feature is broken.
 *
 * Prefers `navigator.userAgentData.platform`, which is the supported successor to
 * the long-deprecated `navigator.platform`, and falls back to the user agent
 * string. Everything non-Apple gets the Windows/Linux form, which is the right
 * default: Ctrl is the primary modifier everywhere except macOS and iPadOS.
 */

interface UADataLike {
  platform?: string;
}

export function detectIsApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: UADataLike }).userAgentData;
  const platform = uaData?.platform ?? navigator.platform ?? '';
  if (/mac|iphone|ipad|ipod/i.test(platform)) return true;
  // iPadOS reports as "MacIntel" above, but older iPads and some in-app browsers
  // only reveal themselves in the UA string.
  return /mac os x|iphone|ipad/i.test(navigator.userAgent ?? '');
}

export const IS_APPLE: boolean = detectIsApple();

/** The primary modifier, as a symbol on Apple platforms and a word elsewhere. */
export const MOD_KEY = IS_APPLE ? '⌘' : 'Ctrl';

/** True when a keyboard event carries this platform's primary modifier. Checking
 *  both means a Mac user with an external PC keyboard still gets the shortcut. */
export function hasModifier(e: KeyboardEvent): boolean {
  return IS_APPLE ? e.metaKey : e.ctrlKey;
}

/** Formats modifier and navigation keys according to platform target. */
export function formatShortcutKey(key: string, isApple: boolean): string {
  switch (key) {
    case 'Mod':
    case 'MOD':
    case '⌘':
    case 'Ctrl':
      return isApple ? '⌘' : 'Ctrl';
    case 'Alt':
    case 'Option':
    case '⌥':
      return isApple ? '⌥ Option' : 'Alt';
    case 'Shift':
    case '⇧':
      return isApple ? 'Shift' : 'Shift';
    case 'Enter':
    case 'Return':
      return isApple ? 'Return' : 'Enter';
    case 'Delete':
      return isApple ? 'Delete' : 'Delete';
    default:
      return key;
  }
}

