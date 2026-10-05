import { attempt } from '@/core/error/attempt';

import type { OpsReportsRepository } from '@/features/ops-reports/domain/repositories/opsReports.repository';
import {
  getReportCsvExport,
  getReports,
} from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.api';
import {
  toDeferredExport,
  toOpsReportSummary,
} from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.response';

export const opsReportsRepository: OpsReportsRepository = {
  listReports: () => attempt(async () => (await getReports()).map(toOpsReportSummary)),

  exportReportCsv: (code) =>
    attempt(async () => {
      const response = await getReportCsvExport(code);
      return response.kind === 'deferred'
        ? toDeferredExport(response.body)
        : { status: 'file', filename: response.filename, content: response.content };
    }),
};
