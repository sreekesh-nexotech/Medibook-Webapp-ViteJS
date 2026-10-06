import { useState } from 'react';

import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Field } from '@/shared/ui/Field';
import { Modal } from '@/shared/ui/Modal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import type {
  DeskAppointment,
  PaymentMethod,
} from '@/features/appointments/domain/entities/appointments.entities';
import { useCollectVisitPaymentMutation } from '@/features/appointments/application/queries/appointments.mutations';
import { AppointmentReceiptModal } from '@/features/appointments/presentation/components/AppointmentReceiptModal';
import { AppointmentTokenModal } from '@/features/appointments/presentation/components/AppointmentTokenModal';
import {
  DESK_METHODS,
  methodLabel,
  needsPayment,
  PAYMENT_LABEL,
  timeOf,
} from '@/features/appointments/presentation/components/appointments.view';

/** The backend's answer when a cash line has no open cash session (D-28). */
const CASH_SESSION_REQUIRED = 'CASH_SESSION_REQUIRED';

interface AppointmentBookedModalProps {
  /** The visit just booked; `null` = closed. */
  appointments: readonly DeskAppointment[] | null;
  /** The visit they belong to — collected together in one payment. */
  visitId: string | null;
  patientName: string;
  onDone: () => void;
}

/**
 * After a walk-in booking: every consultation booked with its token and fee,
 * one "Collect" for all of them — a single visit payment and one receipt
 * (`POST /visits/{id}/payments`) — then the receipt and each token slip. Leaving without collecting is
 * allowed — the bookings stay "Pending payment" in the list.
 */
export function AppointmentBookedModal({
  appointments,
  visitId,
  patientName,
  onDone,
}: AppointmentBookedModalProps) {
  if (!appointments || !visitId) return null;
  return (
    <BookedVisit
      appointments={appointments}
      visitId={visitId}
      patientName={patientName}
      onDone={onDone}
    />
  );
}

function BookedVisit({
  appointments,
  visitId,
  patientName,
  onDone,
}: {
  appointments: readonly DeskAppointment[];
  visitId: string;
  patientName: string;
  onDone: () => void;
}) {
  const collect = useCollectVisitPaymentMutation();
  const [paidIds, setPaidIds] = useState<readonly string[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptFor, setReceiptFor] = useState<string | null>(null);
  const [tokenFor, setTokenFor] = useState<string | null>(null);

  const unpaid = appointments.filter((a) => needsPayment(a) && !paidIds.includes(a.id));
  const dueTotal = unpaid.reduce((sum, a) => sum + a.totalRupees, 0);

  /** One visit payment for every unpaid consultation: one order, one receipt. */
  const collectAll = async (): Promise<void> => {
    setIsCollecting(true);
    setError(null);
    try {
      const ids = unpaid.map((a) => a.id);
      if (dueTotal > 0) {
        await collect.mutateAsync({
          visitId,
          appointmentIds: ids,
          lines: [{ method, amountRupees: dueTotal, reference: reference.trim() }],
        });
      }
      setPaidIds((paid) => [...paid, ...ids]);
      toast(`Payment of ${money(dueTotal)} recorded`, 'success');
    } catch (failure) {
      setError(
        isFailure(failure) && failure.code === CASH_SESSION_REQUIRED
          ? 'Open your cash drawer on the Payments screen before taking cash, or collect by UPI or card.'
          : isFailure(failure)
            ? failure.message
            : 'Could not record the payment.',
      );
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onDone}
        title={`Booked for ${patientName}`}
        width={620}
        footer={
          <>
            <Button variant="secondary" onClick={onDone} disabled={isCollecting}>
              {unpaid.length > 0 ? 'Collect later' : 'Done'}
            </Button>
            {unpaid.length > 0 && (
              <Can perm="Payments.add">
                <Button icon="indian-rupee" busy={isCollecting} onClick={() => void collectAll()}>
                  Collect {money(dueTotal)}
                </Button>
              </Can>
            )}
          </>
        }
      >
        <ul className="divide-border-soft border-border-soft mb-4 divide-y rounded-md border">
          {appointments.map((a) => {
            const isPaid = paidIds.includes(a.id) || a.paymentStatus === 'paid';
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                <div className="min-w-40 flex-1">
                  <div className="text-body text-text-strong font-medium">
                    {a.doctor.name} · {a.department.name}
                  </div>
                  <div className="text-caption text-text-muted">
                    {timeOf(a.scheduledStartAt)} · {a.sessionLabel} · {a.bookingRef}
                  </div>
                </div>
                {a.tokenLabel && (
                  <span className="text-body text-blue font-bold">{a.tokenLabel}</span>
                )}
                <span className="text-body tabular-nums">{money(a.totalRupees)}</span>
                <Badge status={isPaid ? 'Paid' : PAYMENT_LABEL[a.paymentStatus]} />
                {isPaid && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="receipt"
                    onClick={() => setReceiptFor(a.id)}
                  >
                    Receipt
                  </Button>
                )}
                {a.tokenLabel && (
                  <Button size="sm" variant="ghost" icon="ticket" onClick={() => setTokenFor(a.id)}>
                    Token
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {unpaid.length > 0 && (
          <div className="flex items-end gap-3">
            <Field label="Payment method" className="flex-1">
              <Select
                value={methodLabel(method)}
                options={DESK_METHODS.map(methodLabel)}
                onChange={(label) =>
                  setMethod(DESK_METHODS.find((m) => methodLabel(m) === label) ?? 'cash')
                }
              />
            </Field>
            <Field label="Reference" className="flex-1">
              <TextInput
                value={reference}
                placeholder={method === 'cash' ? 'Optional' : 'UPI / card ref.'}
                onChange={setReference}
              />
            </Field>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="text-caption text-danger bg-d-100 mt-3 rounded-sm px-3 py-2.5"
          >
            {error}
          </div>
        )}
      </Modal>
      <AppointmentReceiptModal appointmentId={receiptFor} onClose={() => setReceiptFor(null)} />
      <AppointmentTokenModal appointmentId={tokenFor} onClose={() => setTokenFor(null)} />
    </>
  );
}
