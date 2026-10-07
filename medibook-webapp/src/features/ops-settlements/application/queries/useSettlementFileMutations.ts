import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { exportSettlements } from '@/features/ops-settlements/application/usecases/exportSettlements';
import { fetchStatementPdf } from '@/features/ops-settlements/application/usecases/fetchStatementPdf';
import type {
  PeriodFilter,
  PlatformStatement,
  SettlementExportFormat,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

interface ExportInput {
  readonly format: SettlementExportFormat;
  readonly filter: PeriodFilter;
}

/** The period list as CSV / XLSX / PDF (R6). */
export function useExportSettlementsMutation() {
  return useMutation({
    mutationFn: async ({ format, filter }: ExportInput) =>
      unwrap(await exportSettlements(format, filter)),
  });
}

/** A statement's PDF: a signed link, or the bytes (501 when the server cannot render). */
export function useStatementPdfMutation() {
  return useMutation({
    mutationFn: async (statement: PlatformStatement) => unwrap(await fetchStatementPdf(statement)),
  });
}
