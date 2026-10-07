import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  DoctorInput,
  ScheduleWriteMode,
} from '@/features/doctors/domain/entities/doctors.types';
import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { createDoctor } from '@/features/doctors/application/usecases/createDoctor';
import { deleteDoctor } from '@/features/doctors/application/usecases/deleteDoctor';
import { updateDoctor } from '@/features/doctors/application/usecases/updateDoctor';
import { refreshAfterScheduleChange } from '@/features/slots/application/queries/scheduleRefresh';

/**
 * Add a doctor. The created record seeds its detail query, so the editor can
 * move to the doctor's own address without a loading flash (UAT-20).
 */
export function useCreateDoctorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DoctorInput) => unwrap(await createDoctor(input)),
    onSuccess: (doctor) => {
      queryClient.setQueryData(doctorsKeys.detail(doctor.id), doctor);
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.lists() });
    },
  });
}

interface UpdateDoctorInput {
  readonly id: string;
  readonly input: DoctorInput;
  readonly version: number;
  readonly mode: ScheduleWriteMode;
}

/**
 * Save a profile. A dry run (status/department/slot-length change)
 * invalidates nothing; an applied one also refreshes the slot grid (slot
 * length and status regenerate slots) and the desk lists when bookings were
 * cancelled.
 */
export function useUpdateDoctorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input, version, mode }: UpdateDoctorInput) =>
      unwrap(await updateDoctor(id, input, version, mode)),
    onSuccess: (change, { id }) => {
      if (change.dryRun) return;
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.schedule(id) });
      refreshAfterScheduleChange(queryClient, {
        cancelledBookings: change.affectedBookings.length,
        rematerialisationQueued: change.rematerialisationQueued,
      });
    },
  });
}

interface DeleteDoctorInput {
  readonly id: string;
  readonly mode: ScheduleWriteMode;
}

/** Remove a doctor (dry run first: future bookings are cancelled and refunded on confirm). */
export function useDeleteDoctorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, mode }: DeleteDoctorInput) => unwrap(await deleteDoctor(id, mode)),
    onSuccess: (change, { id }) => {
      if (change.dryRun) return;
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.lists() });
      queryClient.removeQueries({ queryKey: doctorsKeys.detail(id) });
      queryClient.removeQueries({ queryKey: doctorsKeys.schedule(id) });
      refreshAfterScheduleChange(queryClient, {
        cancelledBookings: change.affectedBookings.length,
        rematerialisationQueued: change.rematerialisationQueued,
      });
    },
  });
}
