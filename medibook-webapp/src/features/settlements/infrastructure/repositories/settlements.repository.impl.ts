import { attempt } from '@/core/error/attempt';

import type { SettlementsRepository } from '@/features/settlements/domain/repositories/settlements.repository';
import {
  getSettlementPeriod,
  getSettlementPeriods,
  getStatementPdf,
  getStatementsStartingOn,
} from '@/features/settlements/infrastructure/data-sources/remote/settlements.api';
import {
  toSettlementPeriod,
  toSettlementPeriodDetail,
  toStatement,
} from '@/features/settlements/infrastructure/data-sources/remote/settlements.response';

export const settlementsRepository: SettlementsRepository = {
  listPeriods: (filters) =>
    attempt(async () => {
      const page = await getSettlementPeriods(filters);
      return {
        items: page.results.map(toSettlementPeriod),
        total: page.total,
        hasMore: page.has_next,
      };
    }),

  getPeriod: (periodId) =>
    attempt(async () => toSettlementPeriodDetail(await getSettlementPeriod(periodId))),

  findStatement: (periodStart) =>
    attempt(async () => {
      const page = await getStatementsStartingOn(periodStart);
      const first = page.results[0];
      return first ? toStatement(first) : null;
    }),

  getStatementPdf: (statementId) => attempt(() => getStatementPdf(statementId)),
};
