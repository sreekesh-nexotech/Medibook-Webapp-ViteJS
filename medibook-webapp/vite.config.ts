import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Django (REST) and uvicorn (WebSockets) in the backend's local setup. */
const DEFAULT_API_PROXY_TARGET = 'http://localhost:8000';
const DEFAULT_WS_PROXY_TARGET = 'ws://localhost:8001';

const COMMIT_LENGTH = 7;

/** Oldest supported browsers (PERF-01); keep in step with public/browser-check.js. */
const BROWSER_TARGETS = ['chrome111', 'edge111', 'firefox128', 'safari16.4'];

/** The explicit "the app's own host proxies /api and /ws" choice (DEP-10). */
const SAME_ORIGIN = 'same-origin';

/** Each backend origin a build must name, and the scheme it must use. */
const RELEASE_ORIGINS: readonly (readonly [string, string])[] = [
  ['VITE_API_BASE_URL', 'https:'],
  ['VITE_WS_BASE_URL', 'wss:'],
];

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

/**
 * `https://api.example.com/x` → `https://api.example.com`; `null` when unset,
 * `same-origin` (covered by 'self') or not a URL.
 */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    // A malformed value: leave it out of the policy rather than fail the build.
    return null;
  }
}

/**
 * The Content-Security-Policy for a production build (SEC-03): the app's own
 * files only, plus the API, WebSocket and file-storage origins it is
 * configured with. `frame-ancestors` cannot be set from a meta tag; the host
 * sends it as a header (`docs/SECURITY_HEADERS.md`).
 */
function contentSecurityPolicy(env: Record<string, string>): string {
  const api = originOf(env.VITE_API_BASE_URL);
  const ws = originOf(env.VITE_WS_BASE_URL);
  const storage = originOf(env.VITE_STORAGE_ORIGIN);
  const monitoring = originOf(env.VITE_MONITORING_URL);
  const sources = (...extra: (string | null)[]) =>
    ["'self'", ...extra.filter((value): value is string => value !== null)].join(' ');
  return [
    `default-src 'self'`,
    `script-src 'self'`,
    `style-src 'self'`,
    `img-src ${sources('data:', 'blob:', storage)}`,
    `font-src 'self'`,
    `connect-src ${sources(api, ws, storage, monitoring)}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-src 'none'`,
  ].join('; ');
}

/**
 * Why a build may not ship (DEP-10): each backend origin must be an https://
 * or wss:// URL, or `same-origin` when the app's host proxies the backend.
 * An empty value used to fall back to the page's origin without a word, and
 * the values are fixed into the bundle at build time.
 */
function releaseOriginProblems(env: Record<string, string>): string[] {
  const monitoring = (env.VITE_MONITORING_URL ?? '').trim();
  const monitoringProblems =
    monitoring && !monitoring.startsWith('https://')
      ? [`VITE_MONITORING_URL must start with https:// (it is ${monitoring}).`]
      : [];
  return RELEASE_ORIGINS.flatMap(([key, scheme]) => {
    const value = (env[key] ?? '').trim();
    if (value === SAME_ORIGIN) return [];
    if (!value) {
      return [`${key} is not set. Use a ${scheme}// origin, or "${SAME_ORIGIN}".`];
    }
    try {
      const { protocol } = new URL(value);
      return protocol === scheme ? [] : [`${key} must start with ${scheme}// (it is ${value}).`];
    } catch {
      return [`${key} is not a URL (${value}).`];
    }
  }).concat(monitoringProblems);
}

/** Stops `vite build` when the backend origins are missing or insecure. */
function releaseOrigins(env: Record<string, string>): Plugin {
  return {
    name: 'medibook-release-origins',
    apply: 'build',
    buildStart() {
      const problems = releaseOriginProblems(env);
      if (problems.length > 0) {
        this.error(`Build stopped — see docs/DEPLOYMENT.md:\n  - ${problems.join('\n  - ')}`);
      }
    },
  };
}

/** Puts the policy first in `<head>` of the built index.html; the dev server is left alone. */
function cspMetaTag(env: Record<string, string>): Plugin {
  return {
    name: 'medibook-csp-meta',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(env) },
        injectTo: 'head-prepend',
      },
    ],
  };
}

/** The commit a build comes from: CI's checkout, else the local repository. */
function buildCommit(): string {
  const fromCi = process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, COMMIT_LENGTH);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    // Not a git checkout (e.g. a source archive): say so rather than fail the build.
    return 'unknown';
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // Opt-in for a backend with a self-signed certificate (e.g. a dev server on
  // :8443). Certificate checks stay on unless this is exactly 'true'.
  const verifyTls = env.VITE_PROXY_INSECURE_TLS !== 'true';

  return {
    plugins: [releaseOrigins(env), react(), tailwindcss(), cspMetaTag(env)],
    // Read once in `src/core/config/build.ts` (checklist OBS-03).
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_COMMIT__: JSON.stringify(buildCommit()),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // Libraries change far less often than app code: one long-cached vendor
    // chunk, and (with the lazy screens in `app/router/lazyScreens.ts`) an
    // entry chunk well under the 500 kB warning.
    build: {
      // The supported browsers (docs/SUPPORTED_BROWSERS.md): what Tailwind v4's
      // styles need. Older ones are turned away by public/browser-check.js.
      target: BROWSER_TARGETS,
      cssTarget: BROWSER_TARGETS,
      // Source maps for the error monitor (OBS-01): `BUILD_SOURCEMAPS=hidden`
      // writes them without linking them from the bundles; upload them to the
      // monitor and leave them off the web server (docs/MONITORING.md).
      sourcemap: process.env.BUILD_SOURCEMAPS === 'hidden' ? 'hidden' : false,
      rolldownOptions: {
        output: { codeSplitting: { groups: [{ name: 'vendor', test: /node_modules/ }] } },
      },
    },
    // Dev only: the page and the API share one origin, so the backend's
    // per-surface CORS allowlist never needs this worktree's port.
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET,
          changeOrigin: true,
          secure: verifyTls,
        },
        '/ws': {
          target: env.VITE_WS_PROXY_TARGET || DEFAULT_WS_PROXY_TARGET,
          changeOrigin: true,
          ws: true,
          secure: verifyTls,
        },
      },
    },
  };
});
