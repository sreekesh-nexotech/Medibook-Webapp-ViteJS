import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { reportsKeys } from '@/features/reports/application/queries/reports.keys';
import type { ReportScheduleUpdate } from '@/features/reports/domain/entities/reports.entities';
import { updateReportSchedule } from '@/features/reports/application/usecases/updateReportSchedule';

interface UpdateReportScheduleInput {
  readonly id: string;
  readonly changes: ReportScheduleUpdate;
  readonly version: number;
}

export function useUpdateReportScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes, version }: UpdateReportScheduleInput) =>
      unwrap(await updateReportSchedule(id, changes, version)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reportsKeys.schedules() });
    },
  });
}
