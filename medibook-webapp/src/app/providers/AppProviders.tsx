import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { QUERY_MAX_RETRIES, QUERY_STALE_TIME_MS } from '@/core/config/api';
import { isFailure } from '@/core/error/failure';
import type { FailureKind } from '@/core/error/failure';
import { isHospitalWriteBlock } from '@/core/error/toFailure';
import { ToastHost } from '@/shared/ui/toast/ToastHost';

import { router } from '@/app/router/routes';

import { authKeys } from '@/features/auth/application/queries/auth.keys';

/** Only failures a retry can fix: the network dropped or the server erred. */
const RETRYABLE: ReadonlySet<FailureKind> = new Set(['network', 'server']);

/**
 * Server-state cache. Query functions throw a typed `Failure` (`unwrap`), so
 * a 4xx — validation, permission, not found — fails at once instead of being
 * retried; mutations never retry (a repeated write is the caller's decision).
 */
const queryClient: QueryClient = new QueryClient({
  // A write refused by the tenant gate means the hospital went read-only or
  // was suspended since `/hospital/me` was read: re-read it, so the shell's
  // banner appears and write controls switch off (UAT-38).
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isFailure(error) && isHospitalWriteBlock(error)) {
        void queryClient.invalidateQueries({ queryKey: authKeys.session('hospital') });
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME_MS,
      retry: (failureCount, error) =>
        failureCount < QUERY_MAX_RETRIES && (!isFailure(error) || RETRYABLE.has(error.kind)),
    },
    mutations: { retry: false },
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
