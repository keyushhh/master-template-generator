import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * Lint rules for this repo, kept to what a reviewer would actually stop a PR
 * for. Style is not litigated here: there is no formatter in the toolchain and
 * adding one would rewrite every file in the diff, which makes review harder,
 * not easier.
 *
 * The house writing rules (no em dashes, one-line comments) are enforced by
 * `scripts/dash-check.mjs` and by review, not by a lint plugin.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'samples', 'public'] },

  // Application source.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // The deck model is a wide, optional-field bag and several renderers
      // legitimately take an untyped content value. Flagging every one of them
      // would bury the findings that matter, so `any` is a warning.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // A promise dropped on the floor in an export or a media read is a silent
      // failure, which is the one class of bug this app cannot afford.
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Check scripts and config: node, plain JS, and deliberately noisy.
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Tests get the node globals vitest injects plus the browser ones under jsdom.
  {
    files: ['src/**/*.test.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
