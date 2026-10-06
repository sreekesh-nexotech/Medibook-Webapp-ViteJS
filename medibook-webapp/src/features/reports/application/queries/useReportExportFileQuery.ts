import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { reportsKeys } from '@/features/reports/application/queries/reports.keys';
import { fetchReportExportFile } from '@/features/reports/application/usecases/fetchReportExportFile';

/** The finished export an emailed report link points at. */
export function useReportExportFileQuery(fileId: string) {
  return useQuery({
    queryKey: reportsKeys.exportFile(fileId),
    queryFn: async () => unwrap(await fetchReportExportFile(fileId)),
    enabled: fileId !== '',
  });
}
