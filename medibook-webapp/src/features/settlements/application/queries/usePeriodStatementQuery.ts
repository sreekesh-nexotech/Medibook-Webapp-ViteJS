import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { settlementsKeys } from '@/features/settlements/application/queries/settlements.keys';
import { findPeriodStatement } from '@/features/settlements/application/usecases/findPeriodStatement';

/** Statements are issued once and never change. */
const STATEMENT_STALE_TIME_MS = 5 * 60_000;

/** The statement issued for the period starting `periodStart` (`null` = not issued yet). */
export function usePeriodStatementQuery(periodStart: string | null) {
  return useQuery({
    queryKey: settlementsKeys.statement(periodStart ?? ''),
    queryFn: async () => unwrap(await findPeriodStatement(periodStart ?? '')),
    enabled: periodStart !== null,
    staleTime: STATEMENT_STALE_TIME_MS,
  });
}
