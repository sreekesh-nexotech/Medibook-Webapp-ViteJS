import { useMutation, useQueryClient } from '@tanstack/react-query';

import { isFailure, unwrap } from '@/core/error/failure';

import type {
  DateExceptionInput,
  LeaveInput,
  ScheduleChange,
  ScheduleWriteMode,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';
import type { VersionedRef } from '@/features/doctors/domain/repositories/doctors.repository';
import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { createDateException } from '@/features/doctors/application/usecases/createDateException';
import { createLeave } from '@/features/doctors/application/usecases/createLeave';
import { deleteDateException } from '@/features/doctors/application/usecases/deleteDateException';
import { deleteLeave } from '@/features/doctors/application/usecases/deleteLeave';
import { replaceWeeklySessions } from '@/features/doctors/application/usecases/replaceWeeklySessions';
import { updateDateException } from '@/features/doctors/application/usecases/updateDateException';
import { updateLeave } from '@/features/doctors/application/usecases/updateLeave';
import { refreshAfterScheduleChange } from '@/features/slots/application/queries/scheduleRefresh';

/** Every schedule write carries the doctor and how it is sent (dry run / confirm). */
interface ScheduleWrite {
  readonly doctorId: string;
  readonly mode: ScheduleWriteMode;
}

/**
 * Shared wiring for the schedule writes: an applied change refreshes the
 * doctor's schedule and profile (its version moves), the slot grid, and —
 * when bookings were cancelled — the desk lists (UAT-17); a dry run touches
 * nothing.
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
      refreshAfterScheduleChange(queryClient, {
        cancelledBookings: change.affectedBookings.length,
        rematerialisationQueued: change.rematerialisationQueued,
      });
    },
    // A conflict (stale version, replayed key, changed preview) means the
    // schedule moved under the user: reload it so the next attempt starts fresh.
    onError: (error, { doctorId }) => {
      if (!isFailure(error) || error.kind !== 'conflict') return;
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.schedule(doctorId) });
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.scheduleHistory(doctorId) });
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.detail(doctorId) });
    },
  });
}

interface WeeklySessionsWrite extends ScheduleWrite {
  readonly sessions: readonly WeeklySession[];
  /** The doctor's current version (`If-Match`). */
  readonly version: number;
}

export function useReplaceWeeklySessionsMutation() {
  return useScheduleWrite(async ({ doctorId, sessions, version, mode }: WeeklySessionsWrite) =>
    unwrap(await replaceWeeklySessions(doctorId, sessions, version, mode)),
  );
}

interface LeaveWrite extends ScheduleWrite {
  readonly input: LeaveInput;
  /** Present → update that leave (with its version). */
  readonly existing?: VersionedRef;
}

export function useSaveLeaveMutation() {
  return useScheduleWrite(async ({ doctorId, input, existing, mode }: LeaveWrite) =>
    unwrap(
      await (existing
        ? updateLeave(doctorId, existing, input, mode)
        : createLeave(doctorId, input, mode)),
    ),
  );
}

interface LeaveDelete extends ScheduleWrite {
  readonly leave: VersionedRef;
}

export function useDeleteLeaveMutation() {
  return useScheduleWrite(async ({ doctorId, leave, mode }: LeaveDelete) =>
    unwrap(await deleteLeave(doctorId, leave, mode)),
  );
}

interface ExceptionWrite extends ScheduleWrite {
  readonly input: DateExceptionInput;
  readonly existing?: VersionedRef;
}

export function useSaveDateExceptionMutation() {
  return useScheduleWrite(async ({ doctorId, input, existing, mode }: ExceptionWrite) =>
    unwrap(
      await (existing
        ? updateDateException(doctorId, existing, input, mode)
        : createDateException(doctorId, input, mode)),
    ),
  );
}

interface ExceptionDelete extends ScheduleWrite {
  readonly exception: VersionedRef;
}

export function useDeleteDateExceptionMutation() {
  return useScheduleWrite(async ({ doctorId, exception, mode }: ExceptionDelete) =>
    unwrap(await deleteDateException(doctorId, exception, mode)),
  );
}
