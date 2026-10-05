import { useMutation } from '@tanstack/react-query';

import { getFileUrl } from '@/core/api/files.api';
import { unwrap } from '@/core/error/failure';
import { downloadFromUrl } from '@/shared/lib/download';

interface FileDownloadInput {
  readonly fileId: string;
  /** Name hint; the signed link's own `Content-Disposition` usually wins. */
  readonly filename?: string;
}

/**
 * Download a stored file: mint a 10-minute signed link, then hand it to the
 * browser. A mutation (not a query) because each link is single-use in
 * spirit and must never be served from cache after it expires.
 */
export function useFileDownloadMutation() {
  return useMutation({
    mutationFn: async ({ fileId, filename }: FileDownloadInput) => {
      const signed = unwrap(await getFileUrl(fileId));
      downloadFromUrl(signed.url, filename);
      return signed;
    },
  });
}
