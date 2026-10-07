import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { settlementsKeys } from '@/features/settlements/application/queries/settlements.keys';
import { findStatementForDate } from '@/features/settlements/application/usecases/findStatementForDate';

/** Statements are issued once and never change. */
const STATEMENT_STALE_TIME_MS = 5 * 60_000;

/**
 * The statement of the month containing `date` (`null` = not issued yet).
 * Only for a period detail that does not link its statements itself; pass
 * `null` to skip the lookup.
 */
export function useStatementForDateQuery(date: string | null) {
  return useQuery({
    queryKey: settlementsKeys.statementForDate(date ?? ''),
    queryFn: async () => unwrap(await findStatementForDate(date ?? '')),
    enabled: date !== null,
    staleTime: STATEMENT_STALE_TIME_MS,
  });
}
