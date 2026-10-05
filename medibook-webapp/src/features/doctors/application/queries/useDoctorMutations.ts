import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { DoctorInput } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { createDoctor } from '@/features/doctors/application/usecases/createDoctor';
import { deleteDoctor } from '@/features/doctors/application/usecases/deleteDoctor';
import { updateDoctor } from '@/features/doctors/application/usecases/updateDoctor';

/** Add a doctor. */
export function useCreateDoctorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DoctorInput) => unwrap(await createDoctor(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.lists() });
    },
  });
}

interface UpdateDoctorInput {
  readonly id: string;
  readonly input: DoctorInput;
  readonly version: number;
  readonly confirm: boolean;
}

/** Save a profile. A dry run (status/department change) invalidates nothing. */
export function useUpdateDoctorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input, version, confirm }: UpdateDoctorInput) =>
      unwrap(await updateDoctor(id, input, version, confirm)),
    onSuccess: (change, { id }) => {
      if (change.dryRun) return;
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.schedule(id) });
    },
  });
}

interface DeleteDoctorInput {
  readonly id: string;
  readonly confirm: boolean;
}

/** Remove a doctor (dry run first: future bookings are cancelled and refunded on confirm). */
export function useDeleteDoctorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirm }: DeleteDoctorInput) =>
      unwrap(await deleteDoctor(id, confirm)),
    onSuccess: (change, { id }) => {
      if (change.dryRun) return;
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.lists() });
      queryClient.removeQueries({ queryKey: doctorsKeys.detail(id) });
      queryClient.removeQueries({ queryKey: doctorsKeys.schedule(id) });
    },
  });
}
