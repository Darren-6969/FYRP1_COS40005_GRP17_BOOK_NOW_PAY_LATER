import js from '@eslint/js';
import globals from 'globals';

// Flat config. The module boundary rule is BNPL-006 and is not here yet;
// when it lands it is added as an extra config object below, not bolted
// onto the recommended set.
export default [
  {
    ignores: [
      'node_modules/**',
      'uploads/**',
      'src/generated/**',
      'prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Unused args are usually Express's `next`; allow them when prefixed.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$' }],
    },
  },
];
