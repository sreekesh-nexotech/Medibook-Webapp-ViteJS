import type { BulkSlotRequest } from '@/features/slots/domain/entities/slots.entities';

/**
 * `SlotBulkRequest` (`schema.yml`): `{scope, action}`, where the scope has
 * exactly one day selector — `date`, or `weekday` (0 = Monday) + `weeks`.
 */
export interface SlotBulkRequestBody {
  readonly scope: {
    readonly date?: string;
    readonly weekday?: number;
    readonly weeks?: number;
    readonly doctor_id?: string;
    readonly department_id?: string;
    readonly time_from: string;
    readonly time_to: string;
  };
  readonly action: BulkSlotRequest['action'];
  readonly reason?: string;
}

export function toSlotBulkRequestBody({
  scope,
  action,
  reason,
}: BulkSlotRequest): SlotBulkRequestBody {
  const days =
    scope.days.kind === 'date'
      ? { date: scope.days.date }
      : { weekday: scope.days.weekday, weeks: scope.days.weeks };
  return {
    scope: {
      ...days,
      doctor_id: scope.doctorId ?? undefined,
      department_id: scope.departmentId ?? undefined,
      time_from: scope.timeFrom,
      time_to: scope.timeTo,
    },
    action,
    reason: action === 'block' && reason ? reason : undefined,
  };
}
