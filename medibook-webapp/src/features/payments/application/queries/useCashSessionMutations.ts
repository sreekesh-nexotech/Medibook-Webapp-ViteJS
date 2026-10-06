import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { paymentsKeys } from '@/features/payments/application/queries/payments.keys';
import { closeCashSession } from '@/features/payments/application/usecases/closeCashSession';
import { openCashSession } from '@/features/payments/application/usecases/openCashSession';
import { reconcileCashSession } from '@/features/payments/application/usecases/reconcileCashSession';

interface OpenInput {
  readonly openingFloatPaise: number;
  readonly counterId: string | null;
}

interface CloseInput {
  readonly id: string;
  readonly countedCashPaise: number;
  readonly note: string | null;
}

/** Every drawer write changes the open drawer and the reconcile queue. */
function useInvalidateCash(): () => Promise<void> {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: paymentsKeys.cash() });
}

export function useOpenCashSessionMutation() {
  const invalidate = useInvalidateCash();
  return useMutation({
    mutationFn: async ({ openingFloatPaise, counterId }: OpenInput) =>
      unwrap(await openCashSession(openingFloatPaise, counterId)),
    onSettled: invalidate,
  });
}

export function useCloseCashSessionMutation() {
  const invalidate = useInvalidateCash();
  return useMutation({
    mutationFn: async ({ id, countedCashPaise, note }: CloseInput) =>
      unwrap(await closeCashSession(id, countedCashPaise, note)),
    onSettled: invalidate,
  });
}

export function useReconcileCashSessionMutation() {
  const invalidate = useInvalidateCash();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await reconcileCashSession(id)),
    onSettled: invalidate,
  });
}
