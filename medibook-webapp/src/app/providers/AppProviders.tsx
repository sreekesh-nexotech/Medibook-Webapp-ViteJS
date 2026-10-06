import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { QUERY_MAX_RETRIES, QUERY_STALE_TIME_MS } from '@/core/config/api';
import { isFailure } from '@/core/error/failure';
import type { FailureKind } from '@/core/error/failure';
import { ToastHost } from '@/shared/ui/toast/ToastHost';

import { router } from '@/app/router/routes';

/** Only failures a retry can fix: the network dropped or the server erred. */
const RETRYABLE: ReadonlySet<FailureKind> = new Set(['network', 'server']);

/**
 * Server-state cache. Query functions throw a typed `Failure` (`unwrap`), so
 * a 4xx — validation, permission, not found — fails at once instead of being
 * retried; mutations never retry (a repeated write is the caller's decision).
 * Offline, a write fails at once with a connection message instead of pausing
 * and firing by itself when the network returns (RUN-03).
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      retry: (failureCount, error) =>
        failureCount < QUERY_MAX_RETRIES && (!isFailure(error) || RETRYABLE.has(error.kind)),
    },
    mutations: { retry: false, networkMode: 'always' },
  },
});

/** Composition root: query cache + router + the global toast host. */
export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastHost />
    </QueryClientProvider>
  );
}
