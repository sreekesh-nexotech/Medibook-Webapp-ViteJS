import { type FormEvent, useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { SkeletonLine } from '@/shared/ui/Skeleton';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useCashCountersQuery } from '@/features/payments/application/queries/useCashCountersQuery';
import { useCashDeskAccess } from '@/features/payments/application/queries/useCashDeskAccess';
import { useOpenCashSessionMutation } from '@/features/payments/application/queries/useCashSessionMutations';
import { useOpenCashSessionQuery } from '@/features/payments/application/queries/useOpenCashSessionQuery';
import {
  type ClosableDrawer,
  PaymentsCloseDrawerModal,
} from '@/features/payments/presentation/components/PaymentsCloseDrawerModal';
import {
  clockCopy,
  paiseToRupees,
  rupeesToPaise,
} from '@/features/payments/presentation/components/payments.view';

/** The backend's answer when the staff member already has an open drawer (D-28). */
const CASH_SESSION_ALREADY_OPEN = 'CASH_SESSION_ALREADY_OPEN';

/** Counter choice that leaves it to the server: the staff member's default counter. */
const DEFAULT_COUNTER = 'My default counter';
const NO_DEFAULT_COUNTER = 'No counter';

function counterLabel(c: { readonly code: string; readonly name: string }): string {
  return `${c.name} (${c.code})`;
}

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
  const isClosed = drawer.isSuccess && drawer.data === null;
  const counters = useCashCountersQuery(access.canOpen && isClosed);
  const [floatText, setFloatText] = useState('');
  const [floatError, setFloatError] = useState<string | null>(null);
  const [counterChoice, setCounterChoice] = useState<string | null>(null);
  // One replay key per open action: a retry of the same float and counter
  // reuses it; editing either, or a successful open, starts a new action (B2).
  const [openKey, setOpenKey] = useState(() => crypto.randomUUID());
  const renewKey = (): void => setOpenKey(crypto.randomUUID());
  const [closing, setClosing] = useState<ClosableDrawer | null>(null);

  if (!access.canView || access.staffId === null) return null;

  const activeCounters = (counters.data ?? []).filter((c) => c.isActive);
  const defaultOption = access.defaultCounter
    ? `${DEFAULT_COUNTER} — ${counterLabel(access.defaultCounter)}`
    : NO_DEFAULT_COUNTER;
  const counterOptions = [defaultOption, ...activeCounters.map(counterLabel)];
  const chosenCounter = activeCounters.find((c) => counterLabel(c) === counterChoice) ?? null;

  const submitOpen = (event: FormEvent): void => {
    event.preventDefault();
    const paise = rupeesToPaise(floatText);
    if (paise === null) {
      setFloatError('Enter the cash you are starting with, for example 500 or 0.');
      return;
    }
    setFloatError(null);
    openDrawer.mutate(
      { openingFloatPaise: paise, counterId: chosenCounter?.id ?? null, idempotencyKey: openKey },
      {
        onSuccess: (opened) => {
          setFloatText('');
          setCounterChoice(null);
          renewKey();
          toast(
            `Cash drawer opened with ${money(paiseToRupees(paise))}${
              opened.counterCode ? ` at counter ${opened.counterCode}` : ''
            }`,
            'success',
          );
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

  const openDrawerData = drawer.data;
  const startClose = (): void => {
    if (!openDrawerData) return;
    setClosing({
      id: openDrawerData.id,
      version: openDrawerData.version,
      staffName: openDrawerData.staffName,
      openingFloatPaise: openDrawerData.openingFloatPaise,
      expectedCashPaise: openDrawerData.expectedCashPaise,
      isOwn: true,
    });
  };

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
            <Button variant="secondary" icon="lock" onClick={startClose}>
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
              Receipts print the counter you open it at.
            </div>
          </div>
          {access.canOpen ? (
            <form className="flex flex-wrap items-start gap-3" onSubmit={submitOpen}>
              <div className="w-60">
                <Field
                  label="Counter"
                  hint={
                    counters.isError
                      ? 'Counters could not be loaded; your default is used.'
                      : undefined
                  }
                >
                  <Select
                    value={counterChoice ?? defaultOption}
                    options={counterOptions}
                    onChange={(v) => {
                      setCounterChoice(v);
                      renewKey();
                    }}
                    disabled={counters.isError}
                    height={44}
                  />
                </Field>
              </div>
              <div className="w-48">
                <Field label="Opening float (₹)" required error={floatError}>
                  <TextInput
                    value={floatText}
                    onChange={(v) => {
                      setFloatText(v);
                      setFloatError(null);
                      renewKey();
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
