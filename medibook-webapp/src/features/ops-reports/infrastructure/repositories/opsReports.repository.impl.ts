import { getFile } from '@/core/api/files.api';
import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';
import { err, ok } from '@/core/error/failure';

import type { OpsExportFileState } from '@/features/ops-reports/domain/entities/opsReports.types';
import type { OpsReportsRepository } from '@/features/ops-reports/domain/repositories/opsReports.repository';
import {
  getReport,
  getReportExport,
  getReportSchedules,
  getReports,
  patchReportSchedule,
  postReportSchedule,
} from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.api';
import {
  toDeferredExport,
  toOpsReportResult,
  toOpsReportSummary,
  toReportSchedule,
} from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.response';

/** `410 FILE_EXPIRED` — the export's download window has closed (B7). */
const HTTP_GONE = 410;

const STILL_BUILDING: ReadonlySet<string> = new Set(['pending', 'uploaded', 'scanning']);

export const opsReportsRepository: OpsReportsRepository = {
  listReports: () => attempt(async () => (await getReports()).map(toOpsReportSummary)),

  runReport: (query) => attempt(async () => toOpsReportResult(await getReport(query))),

  exportReport: (code, fmt, params) =>
    attempt(async () => {
      const response = await getReportExport(code, fmt, params);
      return response.kind === 'deferred'
        ? toDeferredExport(response.body)
        : { status: 'file', filename: response.filename, blob: response.blob };
    }),

  /**
   * An async export is pre-allocated: older backends answer 404 until the
   * worker writes it, B7 shows it as `pending`, then `clean` or `failed`, and
   * `410` once it expired.
   */
  getExportFile: async (exportId) => {
    const result = await getFile(exportId);
    if (!result.ok) {
      if (result.failure.kind === 'notFound') return ok<OpsExportFileState>({ status: 'pending' });
      if (result.failure.status === HTTP_GONE) return ok<OpsExportFileState>({ status: 'expired' });
      return err(result.failure);
    }
    const file = result.data;
    if (file.status === 'clean') {
      return ok({ status: 'ready', expiresAt: file.expiresAt, name: file.originalName });
    }
    if (STILL_BUILDING.has(file.status)) return ok({ status: 'pending' });
    return ok({ status: 'failed' });
  },

  listSchedules: (query) =>
    attempt(async () => toPage(await getReportSchedules(query), toReportSchedule)),

  createSchedule: (draft) => attempt(async () => toReportSchedule(await postReportSchedule(draft))),

  updateSchedule: (id, changes, version) =>
    attempt(async () => toReportSchedule(await patchReportSchedule(id, changes, version))),
};
