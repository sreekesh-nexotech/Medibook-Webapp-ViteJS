import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  NumberingChange,
  NumberingKind,
} from '@/features/ops-hospitals/domain/entities/hospitalSettings.entity';
import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { updateHospitalNumbering } from '@/features/ops-hospitals/application/usecases/updateHospitalNumbering';

interface UpdateNumberingInput {
  readonly hospitalId: string;
  readonly kind: NumberingKind;
  readonly change: NumberingChange;
  readonly version: number;
}

/**
 * Override a numbering series. The answer replaces the cached series (new
 * `version`); the hospital detail is re-read because confirming numbering can
 * clear a go-live blocker.
 */
export function useUpdateHospitalNumberingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ hospitalId, kind, change, version }: UpdateNumberingInput) =>
      unwrap(await updateHospitalNumbering(hospitalId, kind, change, version)),
    onSuccess: (series, { hospitalId, kind }) => {
      queryClient.setQueryData(hospitalsKeys.numbering(hospitalId, kind), series);
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.detail(hospitalId) });
    },
    onError: (_error, { hospitalId, kind }) => {
      // A version conflict means another operator saved first: re-read it.
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.numbering(hospitalId, kind) });
    },
  });
}
