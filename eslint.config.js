import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

// Editor-time mirrors of the dependency-cruiser rules (.dependency-cruiser.cjs, HAN-126).
// `no-restricted-imports` is replaced, not merged, between blocks, so each block lists everything.
const TESTS = ['**/*.test.{ts,tsx}', 'src/test/**'];
const NO_AXIOS = {
  name: 'axios',
  message:
    'axios is used only in src/api/ and src/auth/apiClient.ts. Call an api/ client instead.',
};
const NO_PAGES = {
  group: ['@/pages/*'],
  message:
    'Shared code cannot import a page. Move the shared part into components/, hooks/ or lib/.',
};
const UI_ONLY_LIB = {
  regex: '^@/(?!lib/|components/ui/)',
  message:
    'components/ui imports only lib/ and packages. Pass app data in through props.',
};

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'build', 'coverage', '*.config.js']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
      prettierConfig,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',

      // TypeScript strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],

      // React rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // the recommended preset ships these React Compiler rules at warn
      'react-hooks/incompatible-library': 'error',
      'react-hooks/unsupported-syntax': 'error',
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true },
      ],

      // General JavaScript rules
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-warning-comments': ['error', { terms: ['todo', 'fixme'] }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/**', 'src/auth/apiClient.ts', ...TESTS],
    rules: {
      'no-restricted-imports': ['error', { paths: [NO_AXIOS] }],
    },
  },
  {
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
      'src/stores/**/*.{ts,tsx}',
      'src/contexts/**/*.{ts,tsx}',
    ],
    ignores: ['src/components/ui/**', ...TESTS],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [NO_AXIOS], patterns: [NO_PAGES] },
      ],
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    ignores: TESTS,
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [NO_AXIOS], patterns: [UI_ONLY_LIB] },
      ],
    },
  },
]);
