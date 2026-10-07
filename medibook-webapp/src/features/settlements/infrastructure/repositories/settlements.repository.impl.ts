import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { StatementPdf } from '@/features/settlements/domain/entities/settlements.entities';
import type { SettlementsRepository } from '@/features/settlements/domain/repositories/settlements.repository';
import {
  getPayouts,
  getSettlementPeriod,
  getSettlementPeriods,
  getStatementPdf,
  getStatements,
  getStatementsForDate,
} from '@/features/settlements/infrastructure/data-sources/remote/settlements.api';
import {
  toPayout,
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

  findStatementForDate: (date) =>
    attempt(async () => {
      const page = await getStatementsForDate(date);
      const match = page.results.find((s) => s.period_start <= date && date <= s.period_end);
      return match ? toStatement(match) : null;
    }),

  listStatements: (query) => attempt(async () => toPage(await getStatements(query), toStatement)),

  getStatementPdf: (statementId) =>
    attempt(async (): Promise<StatementPdf> => {
      const answer = await getStatementPdf(statementId);
      return answer.kind === 'url'
        ? { kind: 'link', url: answer.url }
        : { kind: 'file', blob: answer.blob };
    }),

  listPayouts: (query) => attempt(async () => toPage(await getPayouts(query), toPayout)),
};
