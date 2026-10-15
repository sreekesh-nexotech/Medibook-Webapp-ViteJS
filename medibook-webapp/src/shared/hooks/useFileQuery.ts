import { useQuery } from '@tanstack/react-query';

import { getFile } from '@/core/api/files.api';
import { filesKeys } from '@/core/api/files.keys';
import type { StoredFile } from '@/core/api/files.types';
import { unwrap } from '@/core/error/failure';

/** How often to re-read a file whose virus scan is still running. */
const SCAN_POLL_INTERVAL_MS = 2_000;

const IN_PROGRESS: ReadonlySet<StoredFile['status']> = new Set(['pending', 'uploaded', 'scanning']);

/**
 * Metadata of one stored file. While the upload is still being verified or
 * scanned it re-polls, so a screen can wait for `status === 'clean'` before
 * attaching the file. Pass `null` to stay idle.
 */
export function useFileQuery(fileId: string | null) {
  return useQuery({
    queryKey: filesKeys.detail(fileId ?? ''),
    queryFn: async () => unwrap(await getFile(fileId ?? '')),
    enabled: fileId !== null,
    refetchInterval: (query) =>
      query.state.data && IN_PROGRESS.has(query.state.data.status) ? SCAN_POLL_INTERVAL_MS : false,
  });
}
