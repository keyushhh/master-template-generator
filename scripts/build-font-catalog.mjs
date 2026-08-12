/**
 * Generates `public/google-fonts.json`, the catalogue the font picker reads.
 *
 * Run with `npm run fonts:catalog`. Committed output, not a build step: it needs
 * the network, and a picker that cannot open because fonts.google.com is slow is
 * worse than one whose list is a month stale.
 *
 * ── Why a generated file and not a live API call ────────────────────────────
 * The catalogue endpoint (`fonts.google.com/metadata/fonts`) sends no CORS
 * header, so a browser cannot read it. The official Developer API can be read
 * cross-origin but needs an API key, and there is no backend to keep a key in.
 * So the list is fetched here, once, by Node, which has neither restriction.
 *
 * ── Why the file paths matter ───────────────────────────────────────────────
 * Naming a font in a .pptx is not enough for desktop PowerPoint: it has no font
 * catalogue, so an unembedded family is substituted. Embedding needs the actual
 * TTF bytes at export time, in the browser, which means a CORS-readable source.
 * `fonts.gstatic.com` serves ideal static per-weight TTFs but only reveals their
 * URLs to a non-browser User-Agent, which we cannot fake from a page. The
 * google/fonts GitHub repo is CORS-readable through jsDelivr, so that is what
 * gets recorded here: per family, the repository path of its regular and bold
 * files.
 *
 * Many families are variable-only in that repo (one `Family[wght].ttf` rather
 * than a file per weight). Those are recorded as variable, and the exporter is
 * told, because PowerPoint renders a variable font at its default instance and
 * would fake the bold.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/google-fonts.json');

const METADATA = 'https://fonts.google.com/metadata/fonts';
/** One request for the whole repo file list, rather than 2000 directory reads. */
const TREE = 'https://api.github.com/repos/google/fonts/git/trees/main?recursive=1';

/** Families in the metadata are grouped under these licence directories in the
 *  repo. A family in none of them has no licence we can redistribute under -
 *  which is exactly how Google's own brand faces (Google Sans, Google Sans Flex)
 *  appear in the metadata while being unusable in a file we send a client. */
const LICENCE_DIRS = new Set(['ofl', 'apache', 'ufl']);

/** Canonical five, lower-cased and hyphenated for use as a filter value. */
function normaliseCategory(c) {
  return String(c).toLowerCase().replace(/\s+/g, '-');
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'wozku-font-catalog', ...headers } });
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  return res.json();
}

console.log('Fetching catalogue metadata…');
const meta = await getJson(METADATA);
const families = meta.familyMetadataList;
console.log(`  ${families.length} families in the catalogue`);

console.log('Fetching google/fonts file list…');
const tree = await getJson(TREE);
if (tree.truncated) throw new Error('GitHub returned a truncated tree; cannot trust the paths');
console.log(`  ${tree.tree.length} paths`);

/**
 * slug -> { dir, files: [names] } for every licence directory in the repo.
 *
 * The slug is the directory name Google uses, which is the family name lowercased
 * with everything non-alphanumeric removed. Derived rather than guessed at
 * lookup time so a family whose directory does not exist is simply absent.
 */
const repo = new Map();
for (const node of tree.tree) {
  if (node.type !== 'blob') continue;
  const m = node.path.match(/^([a-z]+)\/([a-z0-9]+)\/([^/]+\.ttf)$/);
  if (!m) continue;
  const [, dir, slug, file] = m;
  if (!LICENCE_DIRS.has(dir)) continue;
  const entry = repo.get(slug) ?? { dir, files: [] };
  entry.files.push(file);
  repo.set(slug, entry);
}
console.log(`  ${repo.size} families with .ttf files in a licence directory`);

const slugOf = (family) => family.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Pick the two files we would embed.
 *
 * Prefers real static instances, because that is what PowerPoint understands.
 * Falls back to the roman variable file, flagged, so the exporter can decide
 * whether to use it or to name the font and say so.
 */
function pickFiles(family, files) {
  const stem = family.replace(/[^A-Za-z0-9]/g, '');
  const italic = (f) => /italic/i.test(f);
  const roman = files.filter((f) => !italic(f));

  const exact = (suffix) =>
    roman.find((f) => f.toLowerCase() === `${stem}-${suffix}`.toLowerCase() + '.ttf');

  const regular = exact('Regular');
  const bold = exact('Bold');
  if (regular && bold) return { regular, bold, variable: false };

  // A variable file carries its axes in brackets: `DMSans[opsz,wght].ttf`.
  const vf = roman.find((f) => f.includes('['));
  if (vf) return { regular: vf, bold: vf, variable: true };

  // Single-weight families (many display faces) ship one plain file.
  const only = roman.find((f) => f.toLowerCase() === `${stem}.ttf`.toLowerCase()) ?? roman[0];
  return only ? { regular: only, bold: only, variable: false } : null;
}

const out = [];
let skippedNoLicence = 0;
let variableOnly = 0;
let skippedNoUpright = 0;

for (const f of families) {
  const slug = slugOf(f.family);
  const entry = repo.get(slug);
  if (!entry) {
    // No licence directory: nothing we can legally put inside a client's file.
    skippedNoLicence++;
    continue;
  }
  const picked = pickFiles(f.family, entry.files);
  if (!picked) {
    skippedNoLicence++;
    continue;
  }
  if (picked.variable) variableOnly++;

  /**
   * Only the weights we would ever ask for.
   *
   * The canvas requests 400/500/700 and nothing else, and asking `css2` for a
   * weight a family does not have makes the whole request fail - so what the
   * loader needs is not the full axis but which of its three are available.
   * Storing all twenty keys per family, most of them italics we never use, was
   * two thirds of the file.
   */
  const available = new Set(
    Object.keys(f.fonts ?? {}).filter((w) => /^\d+$/.test(w)).map(Number)
  );
  const weights = [400, 500, 700].filter((w) => available.has(w));
  // A family with none of them (a few display faces are 300-only) still needs one
  // weight named, or the stylesheet request would carry an empty axis.
  if (weights.length === 0) {
    const first = [...available].sort((a, b) => a - b)[0];
    if (first) weights.push(first);
  }
  // No upright weight at all. Exactly one family in the catalogue is like this
  // (Molle, which is italic-only), and it cannot be requested on the plain `wght`
  // axis - `Molle:wght@400` is a 400 from the API, which would fail the whole
  // stylesheet request. Supporting an `ital` axis for a single family is more code
  // than the family is worth; a face with no upright is not a body or heading face
  // in a deck anyway.
  if (weights.length === 0) {
    skippedNoUpright++;
    continue;
  }

  out.push({
    family: f.family,
    category: normaliseCategory(f.category),
    // Lower sorts first on fonts.google.com, so it is a rank not a score.
    popularity: f.popularity ?? 9999,
    weights,
    dir: entry.dir,
    slug,
    regular: picked.regular,
    bold: picked.bold,
    variable: picked.variable,
  });
}

out.sort((a, b) => a.popularity - b.popularity);

const payload = {
  generatedFrom: METADATA,
  /** Prefix for every `dir/slug/file` path below. CORS-readable, unlike raw
   *  githubusercontent for large files and unlike gstatic's static instances. */
  cdn: 'https://cdn.jsdelivr.net/gh/google/fonts@main',
  count: out.length,
  fonts: out,
};

writeFileSync(OUT, JSON.stringify(payload));
const kb = (JSON.stringify(payload).length / 1024).toFixed(0);

console.log(`\nWrote ${OUT}`);
console.log(`  ${out.length} usable families (${kb}KB)`);
console.log(`  ${variableOnly} variable-only (embeddable, bold is the default instance)`);
console.log(`  ${skippedNoLicence} skipped: no redistributable licence directory in google/fonts`);
console.log(`  ${skippedNoUpright} skipped: italic-only, cannot be requested on the wght axis`);
