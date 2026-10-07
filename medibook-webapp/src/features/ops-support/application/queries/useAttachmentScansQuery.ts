import { useQueries } from '@tanstack/react-query';

import { getFile } from '@/core/api/files.api';
import { filesKeys } from '@/core/api/files.keys';
import type { FileStatus, StoredFile } from '@/core/api/files.types';
import { unwrap } from '@/core/error/failure';

/** How often to re-read an attachment whose virus scan is still running. */
const SCAN_POLL_INTERVAL_MS = 2_000;

const IN_PROGRESS: ReadonlySet<FileStatus> = new Set(['pending', 'uploaded', 'scanning']);

/**
 * Scan status of each attachment waiting to go on a reply, by file id — a
 * reply may only carry `clean` files. Each file is re-polled until its scan
 * ends; `undefined` while its first read is in flight.
 */
export function useAttachmentScansQuery(
  fileIds: readonly string[],
): Readonly<Record<string, FileStatus | undefined>> {
  const results = useQueries({
    queries: fileIds.map((id) => ({
      queryKey: filesKeys.detail(id),
      queryFn: async (): Promise<StoredFile> => unwrap(await getFile(id)),
      refetchInterval: (query: { state: { data?: StoredFile } }) =>
        query.state.data && IN_PROGRESS.has(query.state.data.status)
          ? SCAN_POLL_INTERVAL_MS
          : false,
    })),
  });
  return Object.fromEntries(fileIds.map((id, i) => [id, results[i]?.data?.status]));
}
