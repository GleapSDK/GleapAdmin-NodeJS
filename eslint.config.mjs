import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Flat config (ESLint 9 + typescript-eslint v8). Replaces the legacy
// .eslintrc + airbnb/React stack — this is a server-side Node SDK, so only
// the TypeScript + Node rules apply.
export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'tmp/', 'node_modules/', 'demo.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // The SDK intentionally logs failures rather than throwing.
      'no-console': 'off',
      // Public HTTP payloads are dynamically shaped; `any` is deliberate here.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Tests exercise error paths, so empty catch/handlers are expected.
    files: ['src/**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
);
