import '@/core/config/zod';
import './index.css';
import { recoverFromStaleBuilds } from '@/app/staleBuild';

recoverFromStaleBuilds();

// The app's modules build their Zod schemas as they load, and Zod settles on
// generated code or not as each one is built. Loading the app only after
// `core/config/zod` has run keeps generated code (blocked by the
// Content-Security-Policy) out entirely (SEC-17).
void import('./bootstrap.tsx');
