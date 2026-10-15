import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { contentKeys } from '@/features/ops-content/application/queries/content.keys';
import { fetchFaqs } from '@/features/ops-content/application/usecases/fetchFaqs';

/** Curated content changes only from this screen, which invalidates on every write. */
const CONTENT_STALE_MS = 60_000;

/** Every FAQ entry (`GET /platform/faqs`). */
export function useFaqsQuery() {
  return useQuery({
    queryKey: contentKeys.faqs(),
    queryFn: async () => unwrap(await fetchFaqs()),
    staleTime: CONTENT_STALE_MS,
  });
}
