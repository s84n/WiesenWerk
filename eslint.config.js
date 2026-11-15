import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'testversionen'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Architekturregel: Simulation und Daten dürfen weder three.js noch Browser-Schnittstellen nutzen.
  {
    files: ['src/sim/**/*.ts', 'src/data/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'sim/data dürfen three.js nicht importieren.' },
            {
              group: ['**/render/*', '**/ui/*', '**/input/*', '**/core/*', '**/dev/*'],
              message: 'sim/data dürfen nur auf data zugreifen.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'indexedDB',
        'requestAnimationFrame',
        'performance',
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
