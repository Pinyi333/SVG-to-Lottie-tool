import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The e2e directory holds Playwright specs, which use a different runner
    // and would fail here with a confusing "no tests" error.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
