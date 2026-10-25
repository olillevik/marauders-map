import { configDefaults, defineConfig } from 'vitest/config';

// npm test skips the integration and smoketest files. npm run test:full passes --mode full and runs every file.
const SLOW_TEST_FILES = ['**/*.integration.test.ts', '**/*.smoke.test.ts'];

export default defineConfig(({ mode }) => ({
  test: {
    exclude: mode === 'full' ? configDefaults.exclude : [...configDefaults.exclude, ...SLOW_TEST_FILES],
    // dev.ts is the local server entry point, so it is left out of coverage.
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/server/test-support.ts', 'src/server/dev.ts', 'src/vite-env.d.ts'],
      reporter: ['text'],
      thresholds: { lines: 65, statements: 65, branches: 65, functions: 65 },
    },
  },
}));
