import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { paymentsKeys } from '@/features/payments/application/queries/payments.keys';
import { fetchVisitReceipts } from '@/features/payments/application/usecases/fetchVisitReceipts';

/** An issued receipt never changes. */
const RECEIPT_STALE_TIME_MS = 10 * 60_000;

/** The receipts of one desk visit. `null` stays idle. */
export function useVisitReceiptsQuery(visitId: string | null) {
  return useQuery({
    queryKey: paymentsKeys.visitReceipts(visitId ?? ''),
    queryFn: async () => unwrap(await fetchVisitReceipts(visitId ?? '')),
    enabled: visitId !== null,
    staleTime: RECEIPT_STALE_TIME_MS,
  });
}
