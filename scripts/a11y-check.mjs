/**
 * Guards the accessibility floor the app chrome now holds.
 *
 * Two of these were real: the small mono labels were set in neutral-400, which
 * is 2.5:1 on white and fails AA outright, and twenty-three controls cleared
 * their focus outline with nothing put back. Both are the kind of regression
 * that reappears the moment someone copies a nearby line, and neither shows up
 * in a screenshot, so they are checked here rather than trusted to review.
 *
 *   node scripts/a11y-check.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve as resolvePath, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolvePath(root, p), 'utf8');

const results = [];
const check = (label, ok, detail = '') => results.push({ label, ok: !!ok, detail });

function walk(dir, out = []) {
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------

const tokens = read('src/theme/tokens.css');
const hexOf = (name) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

function luminance(hex) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const white = '#ffffff';

for (const name of ['neutral-500', 'neutral-600', 'neutral-700']) {
  const hex = hexOf(name);
  check(`${name} clears AA on white`, hex && contrast(hex, white) >= AA,
    hex ? `${hex} is ${contrast(hex, white).toFixed(2)}:1` : 'not found');
}

// The colour the app used to set labels in, kept as a named token because
// borders and disabled icons legitimately use it. Text is what it cannot carry.
const faint = hexOf('neutral-400');
check('neutral-400 is still too weak for text, which is why this check exists',
  faint && contrast(faint, white) < AA, `${faint} is ${contrast(faint, white).toFixed(2)}:1`);

check('the shared faint-text token points at a colour that passes',
  /--chrome-text-faint:\s*var\(--neutral-(500|600|700)\)/.test(tokens),
  tokens.match(/--chrome-text-faint:.*/)?.[0]?.trim());

// The chrome must not set text in neutral-400 again. Slide renderers are
// exempt: their colours are the deck's design, drawn on the deck's own grounds,
// and the brand check covers those.
const CHROME = walk('src').filter((p) => !p.startsWith('src/features/templates/') && !p.includes('PresentationCanvas'));
const offenders = [];
for (const file of CHROME) {
  const src = read(file);
  src.split('\n').forEach((line, i) => {
    if (/text-neutral-(400|500)\b/.test(line) || /color:\s*'var\(--neutral-(400|500)\)'/.test(line)) {
      offenders.push(`${file}:${i + 1}`);
    }
  });
}
// 500 is barred as well as 400: the library and studio grounds are a light grey
// rather than white, and 500 lands at about 4.2:1 on them.
check('no chrome sets text in neutral-400 or neutral-500', offenders.length === 0, offenders.slice(0, 5).join(', '));

// Avatar initials are white, so the colour behind them is doing the work.
const users = read('src/features/auth/demoUsers.ts');
const avatarColours = [...users.matchAll(/color:\s*'(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1]);
check('avatar colours carry white initials', avatarColours.length > 0 && avatarColours.every((c) => contrast(c, white) >= AA),
  avatarColours.map((c) => `${c} ${contrast(c, white).toFixed(2)}:1`).join(', '));

// ---------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------

const globals = read('src/styles/globals.css');
check('there is one global focus-visible ring', /:focus-visible\s*\{[^}]*outline:/.test(globals));
check('the ring uses the focus token rather than a literal',
  /:focus-visible\s*\{[^}]*outline:[^;]*var\(--focus-ring\)/.test(globals));
check('the focus ring is not inside a media query that could switch it off',
  !/@media[^{]*\{[^@]*:focus-visible\s*\{[^}]*outline:\s*none/.test(globals));

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

const canvas = read('src/features/generator/PresentationCanvas.tsx');
check('moving through the deck is announced', /aria-live="polite"[\s\S]{0,400}Slide \$\{index \+ 1\} of/.test(canvas));

const header = read('src/features/generator/StudioHeader.tsx');
check('the save state is announced', /aria-live="polite"[\s\S]{0,600}Saved locally/.test(header));

const toast = read('src/features/toast/Toast.tsx');
check('toasts are announced', /aria-live/.test(toast));

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

const missingAlt = [];
for (const file of walk('src')) {
  const src = read(file);
  // Each <img ...> up to its closing bracket, so an alt on a later line counts.
  for (const m of src.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt=/.test(m[0])) missingAlt.push(`${file}: ${m[0].slice(0, 40)}`);
  }
}
check('every image declares alt text, even if empty', missingAlt.length === 0, missingAlt.slice(0, 3).join(' | '));

// ---------------------------------------------------------------------------
// The studio's floor
// ---------------------------------------------------------------------------

const tooNarrow = read('src/features/ui/TooNarrow.tsx');
check('the editor declares a minimum width', /STUDIO_MIN_WIDTH = 768/.test(tooNarrow));

const studio = read('src/app/MasterTemplatePage.tsx');
check('the studio refuses below that width instead of drawing anyway',
  /useBelowStudioFloor\(\)/.test(studio) && /belowFloor && !presentOpen/.test(studio));
check('presenting is still reachable from the refusal', /onPresent=\{\(\) => setPresentOpen\(true\)\}/.test(studio));

const guidelines = read('src/theme/BrandGuidelines.css');
check('both rails reserve their own column, so neither sits on the slide',
  /padding-left:\s*var\(--sidenav-w\)/.test(guidelines) && /padding-right:\s*var\(--stagerail-w\)/.test(guidelines));
check('the format toolbar is positioned from those same columns',
  /--toolbar-shift:/.test(guidelines) && /left: 'calc\(50% \+ var\(--toolbar-shift\)\)'/.test(studio));

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const dialogFiles = walk('src').filter((p) => read(p).includes('role="dialog"'));
const unnamed = dialogFiles.filter((p) => {
  const src = read(p);
  return !/role="dialog"[\s\S]{0,300}aria-label/.test(src) && !/aria-label[\s\S]{0,300}role="dialog"/.test(src);
});
check('every dialog has a name', unnamed.length === 0, unnamed.join(', '));

for (const r of results) if (!r.ok) console.log(`FAIL  ${r.label}${r.detail ? ` (${r.detail})` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${failed ? `${failed} of ${results.length}` : `All ${results.length}`} accessibility checks ${failed ? 'failed' : 'passed'}.`);
process.exit(failed ? 1 : 0);
