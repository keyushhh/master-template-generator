#!/usr/bin/env node
/**
 * Splits the exported macOS folder SVGs into the three layers Figma smart-animates
 * between: the back panel (+ any papers), the front flap, and the badge that sits
 * on top of the flap.
 *
 * Only the resting exports are split — the hover state is reached by squashing the
 * flap layer vertically from the bottom edge, which is exactly what Figma's resize
 * interpolation does between the two frames.
 *
 * Run: node scripts/split-folder-svgs.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets');

/** Splits an element's children into top-level markup chunks. */
function topLevelChildren(inner) {
  const chunks = [];
  const tagRe = /<(\/?)([a-zA-Z:][\w:-]*)([^>]*?)(\/?)>/g;
  let depth = 0;
  let start = null;
  let m;
  while ((m = tagRe.exec(inner))) {
    const [full, close, , , selfClose] = m;
    if (close) {
      depth -= 1;
      if (depth === 0) {
        chunks.push(inner.slice(start, m.index + full.length));
        start = null;
      }
      continue;
    }
    if (depth === 0) start = m.index;
    if (!selfClose) depth += 1;
    else if (depth === 0) {
      chunks.push(inner.slice(start, m.index + full.length));
      start = null;
    }
  }
  return chunks;
}

const refIds = (markup) =>
  new Set([...markup.matchAll(/(?:url\(#|href="#)([^)"]+)/g)].map((m) => m[1]));

function build(header, chunks, defsById) {
  const body = chunks.join('\n');
  const wanted = new Set();
  const queue = [...refIds(body)];
  while (queue.length) {
    const id = queue.pop();
    if (wanted.has(id) || !defsById.has(id)) continue;
    wanted.add(id);
    queue.push(...refIds(defsById.get(id)));
  }
  const defs = [...defsById]
    .filter(([id]) => wanted.has(id))
    .map(([, markup]) => markup)
    .join('\n');
  return `${header}\n${body}\n${defs ? `<defs>\n${defs}\n</defs>\n` : ''}</svg>\n`;
}

for (const name of ['folder-empty', 'folder-filled']) {
  const src = readFileSync(join(assets, `${name}.svg`), 'utf8');
  const header = src.match(/^<svg[^>]*>/)[0];
  const defsBlock = src.match(/<defs\s*>([\s\S]*)<\/defs>/);
  const defsById = new Map(
    (defsBlock ? topLevelChildren(defsBlock[1]) : []).map((chunk) => [
      chunk.match(/\bid="([^"]+)"/)[1],
      chunk,
    ]),
  );

  const bodyInner = src.slice(header.length, defsBlock ? src.indexOf('<defs') : src.lastIndexOf('</svg>'));
  const chunks = topLevelChildren(bodyInner);

  const flapStart = chunks.findIndex((c) => c.startsWith('<foreignObject'));
  const badgeStart = chunks.findIndex((c) => c.includes('mix-blend-mode:multiply') && c.includes('#0831A0'));
  if (flapStart < 0 || badgeStart < 0) throw new Error(`unexpected layer order in ${name}.svg`);

  const layers = {
    // The back panel, then the papers as their own layer so they can lift a hair
    // while the flap drops — the folder-filled hover frame moves them 2.7 units up
    // relative to the folder.
    back: chunks.slice(0, 1),
    papers: chunks.slice(1, flapStart),
    flap: chunks.slice(flapStart, badgeStart),
    badge: chunks.slice(badgeStart),
  };

  for (const [layer, layerChunks] of Object.entries(layers)) {
    if (!layerChunks.length) continue;
    const out = join(assets, `${name}-${layer}.svg`);
    writeFileSync(out, build(header, layerChunks, defsById));
    console.log(`${name}-${layer}.svg  ${layerChunks.length} node(s)`);
  }
}
