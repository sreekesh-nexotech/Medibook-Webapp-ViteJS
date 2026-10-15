import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsReportsKeys } from '@/features/ops-reports/application/queries/opsReports.keys';
import { createReportSchedule } from '@/features/ops-reports/application/usecases/createReportSchedule';
import { updateReportSchedule } from '@/features/ops-reports/application/usecases/updateReportSchedule';
import type {
  ReportSchedule,
  ReportScheduleChanges,
  ReportScheduleDraft,
} from '@/features/ops-reports/domain/entities/opsReports.types';

export type SaveReportScheduleInput =
  | { readonly kind: 'create'; readonly draft: ReportScheduleDraft }
  | {
      readonly kind: 'update';
      readonly id: string;
      readonly changes: ReportScheduleChanges;
      /** The version the editor opened on (B7 `If-Match`); a stale one is a 409. */
      readonly version: number | null;
    };

/** Create a schedule or edit one (also pause/resume); refetches the list either way. */
export function useSaveReportScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveReportScheduleInput): Promise<ReportSchedule> =>
      unwrap(
        input.kind === 'create'
          ? await createReportSchedule(input.draft)
          : await updateReportSchedule(input.id, input.changes, input.version),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: opsReportsKeys.schedules() });
    },
  });
}
