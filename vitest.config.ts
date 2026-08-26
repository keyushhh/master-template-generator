import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the logic that has no DOM in it: history, template switching,
 * the deck store, colour maths, relative dates.
 *
 * Deliberately a node environment with a localStorage stub (see
 * `src/test/localStorage.ts`) rather than jsdom. Nothing here renders, and
 * jsdom would add 8MB of dependency to run tests that only need a Map.
 *
 * The export, import, format and type-size seams are covered by the scripts in
 * `scripts/`, which drive the real exporter. Both run under `npm test`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
});
