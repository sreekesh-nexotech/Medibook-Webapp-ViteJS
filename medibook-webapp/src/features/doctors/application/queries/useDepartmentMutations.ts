import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { DepartmentInput } from '@/features/doctors/domain/entities/doctors.types';
import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { createDepartment } from '@/features/doctors/application/usecases/createDepartment';
import { deleteDepartment } from '@/features/doctors/application/usecases/deleteDepartment';
import { updateDepartment } from '@/features/doctors/application/usecases/updateDepartment';

interface SaveDepartmentInput {
  /** Absent → create; otherwise the department at the version shown (`If-Match`). */
  readonly existing?: { readonly id: string; readonly version: number };
  readonly input: DepartmentInput;
}

/** Create or update a department. */
export function useSaveDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ existing, input }: SaveDepartmentInput) =>
      unwrap(
        await (existing
          ? updateDepartment(existing.id, input, existing.version)
          : createDepartment(input)),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.departments() });
    },
  });
}

/** Delete a department; refused (`DEPARTMENT_IN_USE`) while doctors are assigned. */
export function useDeleteDepartmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteDepartment(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorsKeys.departments() });
    },
  });
}
