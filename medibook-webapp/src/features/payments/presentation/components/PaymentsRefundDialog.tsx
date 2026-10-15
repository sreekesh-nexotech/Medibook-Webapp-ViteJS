import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Field } from '@/shared/ui/Field';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';
import { SkeletonLine } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import type { PaymentLine } from '@/features/payments/domain/entities/payments.entities';
import { useOrderLinesQuery } from '@/features/payments/application/queries/useOrderLinesQuery';
import { useRefundBookingMutation } from '@/features/payments/application/queries/useRefundBookingMutation';
import {
  LINE_STATUS_LABEL,
  METHOD_LABEL,
  orderRefundTotal,
  refundFailureCopy,
} from '@/features/payments/presentation/components/payments.view';

/** Shortest reason the desk may record — the patient sees it. */
const MIN_REASON_LENGTH = 3;

/** Backend limit (`HospitalReasonSerializer.reason`). */
const REASON_MAX_LENGTH = 500;

const LINE_SKELETONS = 2;

interface PaymentsRefundDialogProps {
  /** The row Refund was clicked on; the dialog lists every line of its order. */
  line: PaymentLine;
  /** The signed-in member may open a cash drawer (decides the cash guidance). */
  canOpenDrawer: boolean;
  onClose: () => void;
}

/**
 * Refund a booking from Payments (UAT-42). A refund is full and covers every
 * captured line of the booking's payment order, each to its own method (Q94,
 * Q95, O-09) — so the dialog lists those lines and the total before anything
 * is sent, and says how much cash leaves the drawer.
 *
 * Mounted per open: the `Idempotency-Key` is minted once here and reused if
 * the user retries after a lost answer, so a retry replays the first refund
 * instead of failing with "already refunded" (D-21, appendix 04 F16).
 */
export function PaymentsRefundDialog({ line, canOpenDrawer, onClose }: PaymentsRefundDialogProps) {
  // One key per refund action: a retry of the same reason reuses it.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState('');
  const [isTouched, setIsTouched] = useState(false);
  const refund = useRefundBookingMutation();
  const orderQuery = useOrderLinesQuery(line.orderId, line.bookingRefs[0] ?? null);

  // Without an order id (older backend rows) the clicked line is all we know.
  const lines: readonly PaymentLine[] =
    line.orderId === null
      ? [line]
      : orderQuery.data && orderQuery.data.length > 0
        ? orderQuery.data
        : [line];
  const total = orderRefundTotal(lines);
  const cashTotal = orderRefundTotal(lines.filter((l) => l.method === 'cash'));
  const reasonError =
    isTouched && reason.trim().length < MIN_REASON_LENGTH ? 'Enter a short reason.' : null;
  const isLoadingLines = line.orderId !== null && orderQuery.isPending;

  const confirm = (): void => {
    setIsTouched(true);
    if (reason.trim().length < MIN_REASON_LENGTH || !line.appointmentId) return;
    refund.mutate(
      { appointmentId: line.appointmentId, reason: reason.trim(), idempotencyKey },
      {
        onSuccess: (outcome) => {
          const pending = outcome.refunds.some(
            (r) => r.status === 'requested' || r.status === 'processing',
          );
          toast(
            pending
              ? 'Refund sent — online payments show “Refund processing” until the gateway confirms.'
              : 'Refund recorded',
            'success',
          );
          onClose();
        },
        onError: (error) => toast(refundFailureCopy(error, canOpenDrawer), 'error'),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Refund booking"
      width={540}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={refund.isPending}>
            Keep payment
          </Button>
          <Button
            variant="danger"
            onClick={confirm}
            busy={refund.isPending}
            disabled={isLoadingLines || total <= 0}
          >
            Refund {money(total)} in full
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-body m-0">
          {line.patient?.fullName ?? 'This patient'} · booking {line.bookingRefs.join(', ') || '—'}.
          The whole booking is refunded — every paid line below, each to the method it was paid
          with. Refunds are always in full.
        </p>
        {orderQuery.isError ? (
          <ErrorState
            inline
            title="The booking’s payment lines didn’t load"
            message={isFailure(orderQuery.error) ? orderQuery.error.message : undefined}
            onRetry={() => void orderQuery.refetch()}
          />
        ) : isLoadingLines ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: LINE_SKELETONS }, (_, i) => (
              <SkeletonLine key={i} />
            ))}
          </div>
        ) : (
          <div className="border-border-soft rounded-md border">
            {lines.map((l) => (
              <div
                key={l.id}
                className="border-border-soft flex items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0"
              >
                <span className="text-body text-text-strong flex-1 font-medium">
                  {l.channel === 'online' ? 'Paid online' : METHOD_LABEL[l.method]}
                  {l.collectedByName && (
                    <span className="text-caption text-text-muted block font-normal">
                      {l.collectedByName}
                      {l.counterCode ? ` · ${l.counterCode}` : ''}
                    </span>
                  )}
                </span>
                <Badge status={LINE_STATUS_LABEL[l.status]} />
                <span
                  className={cn(
                    'text-body w-24 text-right font-semibold tabular-nums',
                    l.status === 'captured' ? 'text-text-strong' : 'text-text-muted line-through',
                  )}
                >
                  {money(l.amountRupees)}
                </span>
              </div>
            ))}
            <div className="bg-bg-subtle flex items-center justify-between px-3.5 py-2.5">
              <span className="text-body text-text-strong font-semibold">To refund</span>
              <span className="text-body text-d-700 font-bold tabular-nums">{money(total)}</span>
            </div>
          </div>
        )}
        {cashTotal > 0 && (
          <div className="text-caption text-y-800 bg-y-100 flex items-start gap-2 rounded-md px-3 py-2.5">
            <Icon name="banknote" size={15} className="mt-px flex-none" />
            <span>
              {money(cashTotal)} in cash is handed back from{' '}
              {canOpenDrawer
                ? 'your open cash drawer — open it first if it is closed.'
                : 'the refunder’s open cash drawer. Your role cannot open one; ask a colleague who can.'}
            </span>
          </div>
        )}
        <Field label="Reason" required error={reasonError}>
          {(field) => (
            <textarea
              id={field.id}
              value={reason}
              maxLength={REASON_MAX_LENGTH}
              onChange={(e) => {
                setReason(e.target.value);
                setIdempotencyKey(crypto.randomUUID());
              }}
              onBlur={() => setIsTouched(true)}
              placeholder="e.g. Doctor unavailable — patient informed"
              className="rounded-input border-border text-body text-text-strong box-border h-20 w-full resize-none border p-3"
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
