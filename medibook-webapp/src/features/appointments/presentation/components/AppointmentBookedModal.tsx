import { useState } from 'react';

import { useActionKeys } from '@/shared/hooks/useActionKeys';
import { useHospitalTimeZone } from '@/shared/hooks/useHospitalTime';
import { useCan } from '@/shared/hooks/usePermission';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
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
import { useCollectPaymentMutation } from '@/features/appointments/application/queries/appointments.mutations';
import { AppointmentReceiptModal } from '@/features/appointments/presentation/components/AppointmentReceiptModal';
import { AppointmentTokenModal } from '@/features/appointments/presentation/components/AppointmentTokenModal';
import {
  deskErrorText,
  DESK_METHODS,
  isNothingDue,
  methodLabel,
  needsPayment,
  paymentBadge,
  timeOf,
} from '@/features/appointments/presentation/components/appointments.view';

/** The backend's limit on a payment reference (`PaymentLineSerializer`). */
const REFERENCE_MAX = 200;

interface AppointmentBookedModalProps {
  /** The visit just booked; `null` = closed. */
  appointments: readonly DeskAppointment[] | null;
  /** The name typed on the form, used only if the booking carries no patient (03 F28). */
  patientName: string;
  onDone: () => void;
}

/**
 * After a walk-in booking: every consultation booked with its token and fee,
 * one "Collect" for all of them (one payment per appointment, same method),
 * then each one's receipt and token slip. A ₹0 consultation owes nothing and
 * gets no receipt (UAT-12). A role without payments (department front desk)
 * is told the patient pays at reception (UAT-45). Leaving without collecting
 * is allowed — the bookings stay "Pending payment" in the list.
 */
export function AppointmentBookedModal({
  appointments,
  patientName,
  onDone,
}: AppointmentBookedModalProps) {
  if (!appointments) return null;
  return <BookedVisit appointments={appointments} patientName={patientName} onDone={onDone} />;
}

function BookedVisit({
  appointments,
  patientName,
  onDone,
}: {
  appointments: readonly DeskAppointment[];
  patientName: string;
  onDone: () => void;
}) {
  const collect = useCollectPaymentMutation();
  const actionKeys = useActionKeys();
  const timeZone = useHospitalTimeZone();
  const canCollect = useCan('Payments.add');
  const [paidIds, setPaidIds] = useState<readonly string[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptFor, setReceiptFor] = useState<string | null>(null);
  const [tokenFor, setTokenFor] = useState<string | null>(null);

  const unpaid = appointments.filter((a) => needsPayment(a) && !paidIds.includes(a.id));
  const dueTotal = unpaid.reduce((sum, a) => sum + a.totalRupees, 0);
  const recordName = appointments.find((a) => a.patient)?.patient?.fullName ?? patientName;

  /**
   * One payment per appointment, in order; stops at the first refusal. Each
   * appointment's collection keeps its key across retries (UAT-16), so a
   * retry after a lost answer is replayed, not charged again.
   */
  const collectAll = async (): Promise<void> => {
    setIsCollecting(true);
    setError(null);
    try {
      for (const a of unpaid) {
        const scope = `collect:${a.id}`;
        await collect.mutateAsync({
          id: a.id,
          idempotencyKey: actionKeys.keyFor(scope),
          lines: [{ method, amountRupees: a.totalRupees, reference: reference.trim() }],
        });
        actionKeys.settle(scope);
        setPaidIds((ids) => [...ids, a.id]);
      }
      toast(`Payment of ${money(dueTotal)} recorded`, 'success');
    } catch (failure) {
      setError(
        isFailure(failure)
          ? deskErrorText(failure, 'Could not record the payment.')
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
        title={`Booked for ${recordName}`}
        width={620}
        footer={
          <>
            <Button variant="secondary" onClick={onDone} disabled={isCollecting}>
              {unpaid.length > 0 ? 'Collect later' : 'Done'}
            </Button>
            {unpaid.length > 0 && canCollect && (
              <Button icon="indian-rupee" busy={isCollecting} onClick={() => void collectAll()}>
                Collect {money(dueTotal)}
              </Button>
            )}
          </>
        }
      >
        <ul className="divide-border-soft border-border-soft mb-4 divide-y rounded-md border">
          {appointments.map((a) => {
            const isPaid = paidIds.includes(a.id) || a.paymentStatus === 'paid';
            const badge = isPaid ? { status: 'Paid', label: 'Paid' } : paymentBadge(a);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                <div className="min-w-40 flex-1">
                  <div className="text-body text-text-strong font-medium">
                    {a.doctor.name} · {a.department.name}
                  </div>
                  <div className="text-caption text-text-muted">
                    {timeOf(a.scheduledStartAt, timeZone)} · {a.sessionLabel} · {a.bookingRef}
                  </div>
                </div>
                {a.tokenLabel && (
                  <span className="text-body text-blue font-bold">{a.tokenLabel}</span>
                )}
                <span className="text-body tabular-nums">{money(a.totalRupees)}</span>
                <Badge status={badge.status}>{badge.label}</Badge>
                {isPaid && !isNothingDue(a) && (
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
        {unpaid.length > 0 && !canCollect && (
          <div className="text-body text-text-body bg-grey-200 rounded-md px-3.5 py-2.5">
            {money(dueTotal)} is still to be paid. Send the patient to reception to pay; check them
            in once it is paid.
          </div>
        )}
        {unpaid.length > 0 && canCollect && (
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
                maxLength={REFERENCE_MAX}
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
