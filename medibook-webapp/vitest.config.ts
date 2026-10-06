import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

/**
 * Hospitals work on their own calendar day, so the date helpers are checked
 * in India Standard Time, where a UTC slip shows up as the previous day.
 * Set before the test workers start, which inherit it.
 */
process.env.TZ = 'Asia/Kolkata';

/** Unit and API-contract tests (`npm test`). Browser smoke tests live in `e2e/` (Playwright). */
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }),
);
