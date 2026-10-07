import { ok, type Result } from '@/core/error/failure';
import { csvRowCount, filterCsvRows } from '@/shared/lib/csv';

import type {
  PaymentChannel,
  PaymentExportFile,
  PaymentExportFormat,
  PaymentFilters,
} from '@/features/payments/domain/entities/payments.entities';
import { paymentsRepository } from '@/features/payments/infrastructure/repositories/payments.repository.impl';

/** Every export stops at this many rows on the server (backend `EXPORT_MAX_ROWS`). */
export const SERVER_EXPORT_MAX_ROWS = 10_000;

/** The CSV column naming each line's source (backend export `COLUMNS`). */
const CHANNEL_COLUMN = 'channel';

const CSV_MIME = 'text/csv;charset=utf-8';

/** A payments export, ready to save. */
export interface PaymentsExport {
  readonly file: PaymentExportFile;
  /** Payment lines in the file; `null` for Excel and PDF, which are not read here. */
  readonly rows: number | null;
  /** The server stopped at its row cap, so later payments are missing. */
  readonly capped: boolean;
}

/**
 * The server-built CSV, Excel or PDF of every payment line matching `filters`.
 * A CSV is narrowed to one source when `channel` is set: the server cannot
 * filter by source, so the other source's rows are dropped here and the file
 * matches the screen (PRD-11). Excel and PDF cannot be narrowed here, so the
 * screen offers them only for both sources.
 */
export async function exportPayments(
  filters: PaymentFilters,
  format: PaymentExportFormat,
  channel: PaymentChannel | null,
): Promise<Result<PaymentsExport>> {
  const result = await paymentsRepository.exportPayments(filters, format);
  if (!result.ok) return result;
  const file = result.data;
  if (format !== 'csv') return ok({ file, rows: null, capped: false });
  const server = await file.blob.text();
  if (!channel) {
    const rows = csvRowCount(server);
    return ok({ file, rows, capped: rows >= SERVER_EXPORT_MAX_ROWS });
  }
  const kept = filterCsvRows(server, CHANNEL_COLUMN, (value) => value === channel);
  return ok({
    file: { blob: new Blob([kept.csv], { type: CSV_MIME }), filename: file.filename },
    rows: kept.kept,
    capped: kept.total >= SERVER_EXPORT_MAX_ROWS,
  });
}
