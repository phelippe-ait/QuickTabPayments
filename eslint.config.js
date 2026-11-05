import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results', 'blob-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Vercel serverless functions and Playwright configs run in Node.
    files: ['api/**/*.ts', 'e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Staff workspace data hook: early-return guards legitimately mark loading
    // as finished when there is no restaurant to query.
    files: ['src/apps/staff/hooks/useStaffWorkspace.ts'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    // Migrated Figma-generated prototype screens. These sizeable stateful
    // components intentionally synchronise selection/seed state inside
    // effects; the project-level rule is not enforced for this imported code.
    files: ['src/apps/**/*.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
