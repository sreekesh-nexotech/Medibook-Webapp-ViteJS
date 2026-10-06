import { z } from 'zod';

/**
 * Zod 4 builds fast parsers with `new Function`, which the production
 * Content-Security-Policy (no `'unsafe-eval'`) blocks and reports. Parse
 * without generated code instead (SEC-17). `main.tsx` imports this first, so
 * it applies before any schema runs.
 */
z.config({ jitless: true });
