import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  { ignores: ['app/dist/**', 'apps/web/dist/**', 'src/generated/**', 'apps/api/src/generated/**'] },
  { files: ['**/*.js'], languageOptions: { sourceType: 'script' } },
  { files: ['**/*.{js,mjs,cjs,ts,mts,cts}'], languageOptions: { globals: globals.node } },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // --- Import direction guardrails ---
  // Layer 0: shared — zero @mail-otter/* deps
  {
    files: ['packages/shared/**/*.{ts,js}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@mail-otter/*'], message: 'shared must not import from other @mail-otter packages — it is a zero-dependency base layer' },
        ],
      }],
    },
  },
  // Layer 0: backend-errors — zero @mail-otter/* deps
  {
    files: ['packages/backend-errors/**/*.{ts,js}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@mail-otter/*'], message: 'backend-errors must not import from other @mail-otter packages — it is a zero-dependency base layer' },
        ],
      }],
    },
  },
  // Layer 1: backend-runtime — only shared and backend-errors
  {
    files: ['packages/backend-runtime/**/*.{ts,js}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@mail-otter/backend-data', '@mail-otter/backend-data/*'], message: 'backend-runtime must not import from backend-data (higher layer)' },
          { group: ['@mail-otter/provider-clients', '@mail-otter/provider-clients/*'], message: 'backend-runtime must not import from provider-clients (higher layer)' },
          { group: ['@mail-otter/backend-services', '@mail-otter/backend-services/*'], message: 'backend-runtime must not import from backend-services (higher layer)' },
          { group: ['@mail-otter/api', '@mail-otter/api/*'], message: 'backend-runtime must not import from apps/api' },
          { group: ['@mail-otter/background', '@mail-otter/background/*'], message: 'backend-runtime must not import from apps/background' },
        ],
      }],
    },
  },
  // Layer 2: backend-data — only shared and backend-errors
  {
    files: ['packages/backend-data/**/*.{ts,js}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@mail-otter/backend-runtime', '@mail-otter/backend-runtime/*'], message: 'backend-data must not import from backend-runtime' },
          { group: ['@mail-otter/provider-clients', '@mail-otter/provider-clients/*'], message: 'backend-data must not import from provider-clients' },
          { group: ['@mail-otter/backend-services', '@mail-otter/backend-services/*'], message: 'backend-data must not import services (higher layer)' },
          { group: ['@mail-otter/api', '@mail-otter/api/*'], message: 'backend-data must not import from apps/api' },
          { group: ['@mail-otter/background', '@mail-otter/background/*'], message: 'backend-data must not import from apps/background' },
        ],
      }],
    },
  },
  // Layer 2: provider-clients — only shared and backend-errors
  {
    files: ['packages/provider-clients/**/*.{ts,js}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@mail-otter/backend-data', '@mail-otter/backend-data/*'], message: 'provider-clients must not import DAOs from backend-data' },
          { group: ['@mail-otter/backend-runtime', '@mail-otter/backend-runtime/*'], message: 'provider-clients must not import from backend-runtime' },
          { group: ['@mail-otter/backend-services', '@mail-otter/backend-services/*'], message: 'provider-clients must not import from backend-services (higher layer)' },
          { group: ['@mail-otter/api', '@mail-otter/api/*'], message: 'provider-clients must not import from apps/api' },
          { group: ['@mail-otter/background', '@mail-otter/background/*'], message: 'provider-clients must not import from apps/background' },
        ],
      }],
    },
  },
  // Layer 3: backend-services — cannot import apps
  {
    files: ['packages/backend-services/**/*.{ts,js}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@mail-otter/api', '@mail-otter/api/*'], message: 'backend-services must not import from apps/api' },
          { group: ['@mail-otter/background', '@mail-otter/background/*'], message: 'backend-services must not import from apps/background' },
        ],
      }],
    },
  },
  // Layer 5: apps/api — route through backend-services, not directly to provider-clients
  {
    files: ['apps/api/**/*.{ts,js}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@mail-otter/provider-clients', '@mail-otter/provider-clients/*'], message: 'apps/api must not import provider-clients directly; use @mail-otter/backend-services instead' },
        ],
      }],
    },
  },
]);
