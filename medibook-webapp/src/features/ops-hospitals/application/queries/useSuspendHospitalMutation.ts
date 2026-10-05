import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalSuspendReason } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { suspendHospital } from '@/features/ops-hospitals/application/usecases/suspendHospital';

interface SuspendHospitalInput {
  readonly id: string;
  readonly reason: HospitalSuspendReason;
  readonly note: string | null;
}

/** Suspend an instance: its staff lose access and patients cannot book. */
export function useSuspendHospitalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason, note }: SuspendHospitalInput) =>
      unwrap(await suspendHospital(id, reason, note)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hospitalsKeys.all });
    },
  });
}
