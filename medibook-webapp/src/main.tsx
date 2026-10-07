import '@/core/config/zod';
import './index.css';
import { installErrorReporting } from '@/app/errorReporting';
import { showInsecureContextNotice } from '@/app/secureContext';
import { IS_DEV } from '@/core/config/env';
import { recoverFromStaleBuilds } from '@/app/staleBuild';

// `public/browser-check.js` has already told an unsupported browser so
// (PERF-01). Plain http (other than localhost) lacks the APIs writes depend
// on: explain instead of starting an app whose saves would all fail (DEP-05).
if (document.documentElement.dataset.unsupportedBrowser === 'true') {
  // Leave the browser-check message on screen.
} else if (window.isSecureContext || IS_DEV) {
  installErrorReporting();
  recoverFromStaleBuilds();
  // The app's modules build their Zod schemas as they load, and Zod settles on
  // generated code or not as each one is built. Loading the app only after
  // `core/config/zod` has run keeps generated code (blocked by the
  // Content-Security-Policy) out entirely (SEC-17).
  void import('./bootstrap.tsx');
} else {
  showInsecureContextNotice();
}
