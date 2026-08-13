#!/usr/bin/env node
/**
 * Fails if an em dash gets back into the app.
 *
 * They are not part of the house voice, and one that slips into a changelog line
 * or a toast is shown to a client. En dashes are left alone: they carry real
 * meaning in numeric ranges (8-480px).
 *
 *   node scripts/dash-check.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['src', 'scripts', 'index.html', 'CLAUDE.md', 'README.md'];
const EXT = /\.(ts|tsx|js|jsx|mjs|css|html|json|md)$/;
const EM_DASH = '\u2014'; // escaped, so this file does not trip its own check

function walk(path, out = []) {
  const stats = statSync(path);
  if (stats.isFile()) {
    if (EXT.test(path)) out.push(path);
    return out;
  }
  for (const entry of readdirSync(path)) walk(join(path, entry), out);
  return out;
}

const hits = [];
for (const r of ROOTS) {
  for (const file of walk(join(root, r))) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes(EM_DASH)) hits.push(`${relative(root, file)}:${i + 1}  ${line.trim().slice(0, 100)}`);
    });
  }
}

if (hits.length) {
  console.log(`FAIL  ${hits.length} em dash${hits.length === 1 ? '' : 'es'} found:\n`);
  for (const h of hits) console.log(`  ${h}`);
  console.log('\nUse a comma, a colon, parentheses or a full stop instead.');
  process.exit(1);
}

console.log('PASS  no em dashes\n\nAll dash checks passed.');
