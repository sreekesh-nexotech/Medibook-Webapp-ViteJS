import { getFile } from '@/core/api/files.api';
import { attempt } from '@/core/error/attempt';
import { ok } from '@/core/error/failure';

import type { ReportsRepository } from '@/features/reports/domain/repositories/reports.repository';
import {
  getReport,
  getReportExport,
  getReports,
} from '@/features/reports/infrastructure/data-sources/remote/reports.api';
import {
  toReportCatalog,
  toReportResult,
} from '@/features/reports/infrastructure/data-sources/remote/reports.response';

export const reportsRepository: ReportsRepository = {
  listReports: () => attempt(async () => toReportCatalog(await getReports())),

  getReport: (query) => attempt(async () => toReportResult(await getReport(query))),

  exportReport: (request) =>
    attempt(async () => {
      const response = await getReportExport(request);
      if (response.kind === 'queued') {
        return { kind: 'queued', exportId: response.body.export_id, rows: response.body.rows };
      }
      // The server names the file `<code>.<fmt>`; the same name is used here
      // because a blob download cannot read `Content-Disposition` cross-origin.
      return { kind: 'file', file: response.file, filename: `${request.code}.${request.format}` };
    }),

  getExportFile: async (fileId) => {
    const result = await getFile(fileId);
    if (!result.ok) return result;
    const f = result.data;
    return ok({
      id: f.id,
      name: f.originalName,
      sizeBytes: f.sizeBytes,
      createdAt: f.createdAt,
      expiresAt: f.expiresAt,
    });
  },
};
