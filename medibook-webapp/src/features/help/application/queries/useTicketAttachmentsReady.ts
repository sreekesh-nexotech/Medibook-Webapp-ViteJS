import { useQueries } from '@tanstack/react-query';

import { getFile } from '@/core/api/files.api';
import { filesKeys } from '@/core/api/files.keys';
import type { StoredFile } from '@/core/api/files.types';
import { unwrap } from '@/core/error/failure';

/** How often to re-read a file whose virus scan is still running. */
const SCAN_POLL_INTERVAL_MS = 2_000;

const IN_PROGRESS: ReadonlySet<StoredFile['status']> = new Set(['pending', 'uploaded', 'scanning']);
const REFUSED: ReadonlySet<StoredFile['status']> = new Set(['infected', 'scan_failed']);

/**
 * Whether every file of a draft reply has passed its virus scan — the
 * backend only attaches clean files (`files.usable_attachment`). Polls the
 * ones still being scanned.
 */
export function useTicketAttachmentsReady(fileIds: readonly string[]) {
  const results = useQueries({
    queries: fileIds.map((id) => ({
      queryKey: filesKeys.detail(id),
      queryFn: async () => unwrap(await getFile(id)),
      refetchInterval: (query: { state: { data?: StoredFile } }) =>
        query.state.data && IN_PROGRESS.has(query.state.data.status)
          ? SCAN_POLL_INTERVAL_MS
          : false,
    })),
  });
  const statuses = results.map((r) => r.data?.status);
  return {
    allClean: statuses.every((s) => s === 'clean'),
    hasRefused: statuses.some((s) => s !== undefined && REFUSED.has(s)),
  };
}
