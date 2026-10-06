import { type FormEvent, useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import { SkeletonLine } from '@/shared/ui/Skeleton';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { CashSession } from '@/features/payments/domain/entities/payments.entities';
import { useCashDeskAccess } from '@/features/payments/application/queries/useCashDeskAccess';
import { useOpenCashSessionMutation } from '@/features/payments/application/queries/useCashSessionMutations';
import { useOpenCashSessionQuery } from '@/features/payments/application/queries/useOpenCashSessionQuery';
import { PaymentsCloseDrawerModal } from '@/features/payments/presentation/components/PaymentsCloseDrawerModal';
import {
  clockCopy,
  paiseToRupees,
  rupeesToPaise,
} from '@/features/payments/presentation/components/payments.view';

/** The backend's answer when the staff member already has an open drawer (D-28). */
const CASH_SESSION_ALREADY_OPEN = 'CASH_SESSION_ALREADY_OPEN';

/**
 * The signed-in staff member's cash drawer (D-28). The backend refuses every
 * cash payment line and cash refund unless the collecting staff member has an
 * open cash session, so this is where the front desk opens one with its
 * float, sees what the drawer should hold, and closes it with the cash
 * counted. UPI and card payments never need it.
 */
export function PaymentsCashDrawer() {
  const access = useCashDeskAccess();
  const drawer = useOpenCashSessionQuery(access.canView ? access.staffId : null);
  const openDrawer = useOpenCashSessionMutation();
  const [floatText, setFloatText] = useState('');
  const [floatError, setFloatError] = useState<string | null>(null);
  const [closing, setClosing] = useState<CashSession | null>(null);

  if (!access.canView || access.staffId === null) return null;

  const submitOpen = (event: FormEvent): void => {
    event.preventDefault();
    const paise = rupeesToPaise(floatText);
    if (paise === null) {
      setFloatError('Enter the cash you are starting with, for example 500 or 0.');
      return;
    }
    setFloatError(null);
    openDrawer.mutate(
      { openingFloatPaise: paise, counterId: null },
      {
        onSuccess: () => {
          setFloatText('');
          toast(`Cash drawer opened with ${money(paiseToRupees(paise))}`, 'success');
        },
        onError: (failure) => {
          setFloatError(
            isFailure(failure) && failure.code === CASH_SESSION_ALREADY_OPEN
              ? 'Your drawer is already open. Refresh to see it.'
              : isFailure(failure)
                ? failure.message
                : 'The drawer could not be opened.',
          );
        },
      },
    );
  };

  const counterCopy = access.defaultCounter
    ? ` It opens at ${access.defaultCounter.name} (${access.defaultCounter.code}).`
    : '';

  return (
    <Card pad={16}>
      {drawer.isPending ? (
        <div className="flex flex-col gap-2.5" aria-busy="true">
          <SkeletonLine w="40%" h={14} />
          <SkeletonLine w="65%" />
        </div>
      ) : drawer.isError ? (
        <ErrorState
          inline
          title="Your cash drawer didn’t load"
          message={isFailure(drawer.error) ? drawer.error.message : undefined}
          onRetry={() => void drawer.refetch()}
        />
      ) : drawer.data ? (
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-g-100 text-g-600 flex size-11 flex-none items-center justify-center rounded-lg">
            <Icon name="banknote" size={22} />
          </div>
          <div className="min-w-60 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-body text-text-strong font-medium">
                Your cash drawer is open
              </span>
              <Badge status="Open" />
            </div>
            <div className="text-caption text-text-muted">
              Since {clockCopy(drawer.data.openedAt)}
              {drawer.data.counterCode ? ` · Counter ${drawer.data.counterCode}` : ''} · Float{' '}
              {money(paiseToRupees(drawer.data.openingFloatPaise))}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-caption text-text-muted">Expected in drawer</span>
            <span className="text-body text-text-strong font-semibold tabular-nums">
              {money(paiseToRupees(drawer.data.expectedCashPaise))}
            </span>
          </div>
          {access.canClose && (
            <Button variant="secondary" icon="lock" onClick={() => setClosing(drawer.data ?? null)}>
              Close drawer
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <div className="bg-y-100 text-y-600 flex size-11 flex-none items-center justify-center rounded-lg">
            <Icon name="banknote" size={22} />
          </div>
          <div className="min-w-60 flex-1">
            <div className="text-body text-text-strong font-medium">Your cash drawer is closed</div>
            <div className="text-caption text-text-muted">
              Open it before taking or refunding cash. UPI and card payments work without it.
              {counterCopy}
            </div>
          </div>
          {access.canOpen ? (
            <form className="flex flex-wrap items-start gap-3" onSubmit={submitOpen}>
              <div className="w-48">
                <Field label="Opening float (₹)" required error={floatError}>
                  <TextInput
                    value={floatText}
                    onChange={(v) => {
                      setFloatText(v);
                      setFloatError(null);
                    }}
                    inputMode="decimal"
                    placeholder="e.g. 500"
                    height={44}
                  />
                </Field>
              </div>
              <div className="pt-6.5">
                <Button type="submit" icon="log-in" busy={openDrawer.isPending}>
                  Open drawer
                </Button>
              </div>
            </form>
          ) : (
            <span className="text-caption text-text-muted self-center">
              Your role cannot open a cash drawer.
            </span>
          )}
        </div>
      )}
      {closing && <PaymentsCloseDrawerModal session={closing} onClose={() => setClosing(null)} />}
    </Card>
  );
}
