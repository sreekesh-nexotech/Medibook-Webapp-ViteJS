import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { contentKeys } from '@/features/ops-content/application/queries/content.keys';
import { fetchLegalDocuments } from '@/features/ops-content/application/usecases/fetchLegalDocuments';

/** Curated content changes only from this screen, which invalidates on every write. */
const CONTENT_STALE_MS = 60_000;

/** Every version of every legal document (`GET /platform/legal-documents`). */
export function useLegalDocumentsQuery() {
  return useQuery({
    queryKey: contentKeys.legal(),
    queryFn: async () => unwrap(await fetchLegalDocuments()),
    staleTime: CONTENT_STALE_MS,
  });
}
