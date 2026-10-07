import { ok, type Result } from '@/core/error/failure';
import { csvRowCount, filterCsvRows } from '@/shared/lib/csv';

import type {
  PaymentChannel,
  PaymentFilters,
} from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

/** Every export stops at this many rows on the server (backend `EXPORT_MAX_ROWS`). */
export const SERVER_EXPORT_MAX_ROWS = 10_000;

/** The CSV column naming each line's source (backend export `COLUMNS`). */
const CHANNEL_COLUMN = 'channel';

/** A payments export, ready to save. */
export interface PaymentsExport {
  readonly csv: string;
  /** Payment lines in the file. */
  readonly rows: number;
  /** The server stopped at its row cap, so later payments are missing. */
  readonly capped: boolean;
}

/**
 * The server-built CSV of every payment line matching `filters`, narrowed to
 * one source when `channel` is set: the server cannot filter by source, so the
 * other source's rows are dropped here and the file matches the screen (PRD-11).
 */
export async function exportPayments(
  filters: PaymentFilters,
  channel: PaymentChannel | null,
): Promise<Result<PaymentsExport>> {
  const result = await paymentsRepository.exportCsv(filters);
  if (!result.ok) return result;
  const server = result.data;
  if (!channel) {
    const rows = csvRowCount(server);
    return ok({ csv: server, rows, capped: rows >= SERVER_EXPORT_MAX_ROWS });
  }
  const kept = filterCsvRows(server, CHANNEL_COLUMN, (value) => value === channel);
  return ok({ csv: kept.csv, rows: kept.kept, capped: kept.total >= SERVER_EXPORT_MAX_ROWS });
}
