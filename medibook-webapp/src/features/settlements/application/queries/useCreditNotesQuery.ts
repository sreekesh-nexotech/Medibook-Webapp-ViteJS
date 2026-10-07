import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { billingKeys } from '@/features/settlements/application/queries/billing.keys';
import { fetchCreditNotes } from '@/features/settlements/application/usecases/fetchCreditNotes';

/** Credit notes are issued only when Medibook applies a downgrade. */
const CREDIT_NOTES_STALE_TIME_MS = 5 * 60_000;

/** The hospital's credit notes, newest first (empty from a server without them). */
export function useCreditNotesQuery() {
  return useQuery({
    queryKey: billingKeys.creditNotes(),
    queryFn: async () => unwrap(await fetchCreditNotes()),
    staleTime: CREDIT_NOTES_STALE_TIME_MS,
  });
}
