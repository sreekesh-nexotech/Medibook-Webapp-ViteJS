import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { helpKeys } from '@/features/help/application/queries/help.keys';
import { fetchHelpFaqs } from '@/features/help/application/usecases/fetchHelpFaqs';

/** The platform edits its FAQs rarely (the backend caches them for a minute). */
const FAQ_STALE_TIME_MS = 5 * 60_000;

/** The platform's FAQ feed for hospital staff; empty when there is none. */
export function useHelpFaqsQuery() {
  return useQuery({
    queryKey: helpKeys.faqs(),
    queryFn: async () => unwrap(await fetchHelpFaqs()),
    staleTime: FAQ_STALE_TIME_MS,
  });
}
