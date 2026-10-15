import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { StatementListQuery } from '@/features/settlements/domain/entities/settlements.entities';
import { settlementsKeys } from '@/features/settlements/application/queries/settlements.keys';
import { fetchStatements } from '@/features/settlements/application/usecases/fetchStatements';

/** Statements are issued once a month. */
const STATEMENTS_STALE_TIME_MS = 5 * 60_000;

/** One page of the monthly statements; the old page stays while the next loads. */
export function useStatementsQuery(query: StatementListQuery, enabled = true) {
  return useQuery({
    queryKey: settlementsKeys.statements(query),
    queryFn: async () => unwrap(await fetchStatements(query)),
    placeholderData: keepPreviousData,
    staleTime: STATEMENTS_STALE_TIME_MS,
    enabled,
  });
}
