import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  DateExceptionInput,
  LeaveInput,
  ScheduleChange,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';
import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { createDateException } from '@/features/doctors/application/usecases/createDateException';
import { createLeave } from '@/features/doctors/application/usecases/createLeave';
import { deleteDateException } from '@/features/doctors/application/usecases/deleteDateException';
import { deleteLeave } from '@/features/doctors/application/usecases/deleteLeave';
import { replaceWeeklySessions } from '@/features/doctors/application/usecases/replaceWeeklySessions';
import { updateDateException } from '@/features/doctors/application/usecases/updateDateException';
import { updateLeave } from '@/features/doctors/application/usecases/updateLeave';

/** Every schedule write carries the doctor and the dry-run flag. */
interface ScheduleWrite {
  readonly doctorId: string;
  readonly confirm: boolean;
}

/**
 * Shared wiring for the schedule writes: an applied change refreshes the
 * doctor's schedule and profile (its version moves); a dry run touches nothing.
 */
function useScheduleWrite<V extends ScheduleWrite>(run: (variables: V) => Promise<ScheduleChange>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (change, { doctorId }) => {
      if (change.dryRun) return;
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.schedule(doctorId) });
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.scheduleHistory(doctorId) });
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.detail(doctorId) });
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.lists() });
    },
  });
}

interface WeeklySessionsWrite extends ScheduleWrite {
  readonly sessions: readonly WeeklySession[];
  /** The doctor's current version (`If-Match`). */
  readonly version: number;
}

export function useReplaceWeeklySessionsMutation() {
  return useScheduleWrite(async ({ doctorId, sessions, version, confirm }: WeeklySessionsWrite) =>
    unwrap(await replaceWeeklySessions(doctorId, sessions, version, confirm)),
  );
}

interface LeaveWrite extends ScheduleWrite {
  readonly input: LeaveInput;
  /** Present → update that leave (with its version). */
  readonly existing?: { readonly id: string; readonly version: number };
}

export function useSaveLeaveMutation() {
  return useScheduleWrite(async ({ doctorId, input, existing, confirm }: LeaveWrite) =>
    unwrap(
      await (existing
        ? updateLeave(doctorId, existing.id, input, existing.version, confirm)
        : createLeave(doctorId, input, confirm)),
    ),
  );
}

interface LeaveDelete extends ScheduleWrite {
  readonly leaveId: string;
}

export function useDeleteLeaveMutation() {
  return useScheduleWrite(async ({ doctorId, leaveId, confirm }: LeaveDelete) =>
    unwrap(await deleteLeave(doctorId, leaveId, confirm)),
  );
}

interface ExceptionWrite extends ScheduleWrite {
  readonly input: DateExceptionInput;
  readonly existing?: { readonly id: string; readonly version: number };
}

export function useSaveDateExceptionMutation() {
  return useScheduleWrite(async ({ doctorId, input, existing, confirm }: ExceptionWrite) =>
    unwrap(
      await (existing
        ? updateDateException(doctorId, existing.id, input, existing.version, confirm)
        : createDateException(doctorId, input, confirm)),
    ),
  );
}

interface ExceptionDelete extends ScheduleWrite {
  readonly exceptionId: string;
}

export function useDeleteDateExceptionMutation() {
  return useScheduleWrite(async ({ doctorId, exceptionId, confirm }: ExceptionDelete) =>
    unwrap(await deleteDateException(doctorId, exceptionId, confirm)),
  );
}
