import { fileURLToPath, URL } from 'node:url';

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Django (REST) and uvicorn (WebSockets) in the backend's local setup. */
const DEFAULT_API_PROXY_TARGET = 'http://localhost:8000';
const DEFAULT_WS_PROXY_TARGET = 'ws://localhost:8001';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // Dev only: the page and the API share one origin, so the backend's
    // per-surface CORS allowlist never needs this worktree's port.
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET,
          changeOrigin: true,
        },
        '/ws': {
          target: env.VITE_WS_PROXY_TARGET || DEFAULT_WS_PROXY_TARGET,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
