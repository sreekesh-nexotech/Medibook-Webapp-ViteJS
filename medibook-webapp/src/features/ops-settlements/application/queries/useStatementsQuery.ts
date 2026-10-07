import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { fetchStatements } from '@/features/ops-settlements/application/usecases/fetchStatements';
import type { StatementListParams } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/** One page of platform statements (R5, `billing.view`). */
export function useStatementsQuery(params: StatementListParams, enabled = true) {
  return useQuery({
    queryKey: opsSettlementsKeys.statements(params),
    queryFn: async () => unwrap(await fetchStatements(params)),
    placeholderData: keepPreviousData,
    enabled,
  });
}
