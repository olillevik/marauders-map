import { configDefaults, defineConfig } from 'vitest/config';

// npm test skips the integration and smoketest files. npm run test:full passes --mode full and runs every file.
const SLOW_TEST_FILES = ['**/*.integration.test.ts', '**/*.smoke.test.ts'];

export default defineConfig(({ mode }) => ({
  test: {
    exclude: mode === 'full' ? configDefaults.exclude : [...configDefaults.exclude, ...SLOW_TEST_FILES],
  },
}));
