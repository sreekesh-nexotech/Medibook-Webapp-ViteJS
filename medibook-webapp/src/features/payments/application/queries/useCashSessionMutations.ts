import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { CashWriteGuard } from '@/features/payments/domain/entities/payments.entities';
import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';
import { paymentsKeys } from '@/features/payments/application/queries/payments.keys';
import { closeCashSession } from '@/features/payments/application/usecases/closeCashSession';
import { openCashSession } from '@/features/payments/application/usecases/openCashSession';
import { reconcileCashSession } from '@/features/payments/application/usecases/reconcileCashSession';

interface OpenInput {
  readonly openingFloatPaise: number;
  readonly counterId: string | null;
  /** One per open action, reused on retry (B2: open is idempotent). */
  readonly idempotencyKey: string;
}

interface CloseInput {
  readonly id: string;
  readonly countedCashPaise: number;
  readonly note: string | null;
  readonly guard: CashWriteGuard;
}

interface ReconcileInput {
  readonly id: string;
  readonly countedCashPaise: number | null;
  readonly note: string | null;
  readonly guard: CashWriteGuard;
}

/**
 * Every drawer write changes the open drawer, the reconcile queue and the day
 * summary — and the admin dashboard's reconcile alert (F27).
 */
function useInvalidateCash(): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: paymentsKeys.cash() }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
  };
}

export function useOpenCashSessionMutation() {
  const invalidate = useInvalidateCash();
  return useMutation({
    mutationFn: async ({ openingFloatPaise, counterId, idempotencyKey }: OpenInput) =>
      unwrap(await openCashSession(openingFloatPaise, counterId, idempotencyKey)),
    onSettled: invalidate,
  });
}

export function useCloseCashSessionMutation() {
  const invalidate = useInvalidateCash();
  return useMutation({
    mutationFn: async ({ id, countedCashPaise, note, guard }: CloseInput) =>
      unwrap(await closeCashSession(id, countedCashPaise, note, guard)),
    onSettled: invalidate,
  });
}

export function useReconcileCashSessionMutation() {
  const invalidate = useInvalidateCash();
  return useMutation({
    mutationFn: async ({ id, countedCashPaise, note, guard }: ReconcileInput) =>
      unwrap(await reconcileCashSession(id, countedCashPaise, note, guard)),
    onSettled: invalidate,
  });
}
