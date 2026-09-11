import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { minLen, positiveAmount } from '@/shared/lib/validate';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import {
  grossAmount,
  taxBreakdown,
} from '@/features/appointments/application/store/appointments.logic';
import type { Appointment } from '@/features/appointments/application/store/appointments.types';

/** Shortest useful refund reason — "ok" is not an audit trail. */
const MIN_REASON_LEN = 4;

interface RefundForm {
  /** Rupees to return — free text so a partial figure can be typed. */
  amount: string;
  reason: string;
  /** Gross already collected. Read-only; the refund may never exceed it. */
  paidGross: number;
}

/**
 * HA-09: "a refund toggle appears only for a paid walk-in, for the full
 * amount. Online bookings offer the desk no refund control at all, and there
 * is no partial-refund field." This modal is the refund control for **both**
 * sources, with a validated partial amount and a required reason.
 */
const VALIDATORS: FormValidators<RefundForm> = {
  amount: (value, values) => {
    const invalid = positiveAmount(value, 'Refund amount');
    if (invalid) return invalid;
    return Number(value) > values.paidGross
      ? `The refund cannot exceed the ${money(values.paidGross)} collected.`
      : undefined;
  },
  reason: (value) => minLen(value, MIN_REASON_LEN, 'A refund reason'),
};

interface RefundModalProps {
  appt: Appointment | null;
  onClose: () => void;
  onRefunded?: () => void;
}

function RefundFormBody({
  appt,
  onClose,
  onRefunded,
}: {
  appt: Appointment;
  onClose: () => void;
  onRefunded?: () => void;
}) {
  const refund = useAppointmentsStore((s) => s.refund);
  const paidGross = grossAmount(appt);
  const tax = taxBreakdown(appt.amount);
  const viaDesk = appt.source === 'Walk-in';

  const form = useForm<RefundForm>({
    initial: { amount: String(paidGross), reason: '', paidGross },
    validate: VALIDATORS,
    onSubmit: (v) => {
      refund(appt.id, {
        amount: Number(v.amount),
        reason: v.reason.trim(),
        via: viaDesk ? 'Desk' : 'Medibook',
      });
      onRefunded?.();
      onClose();
    },
  });

  const entered = Number(form.values.amount);
  const partial = Number.isFinite(entered) && entered > 0 && entered < paidGross;

  return (
    <FormModal
      open
      onClose={onClose}
      title="Record Refund"
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel={partial ? 'Record Partial Refund' : 'Record Refund'}
      submitVariant="danger"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <div className="bg-blue-soft-bg flex items-center gap-3 rounded-md px-3.5 py-3">
          <Avatar name={appt.name} size={38} />
          <div className="flex-1">
            <div className="text-body text-text-strong font-medium">{appt.name}</div>
            <div className="text-caption text-text-muted">
              {appt.mrn} · {appt.doctor} · {appt.dept}
            </div>
          </div>
          <Badge status={appt.source} />
        </div>
        <div className="border-border-soft text-body overflow-hidden rounded-md border">
          <div className="border-border-soft text-text-body flex justify-between border-b px-3.5 py-2.5">
            <span>Consultation</span>
            <span className="tabular-nums">{money(tax.subtotal)}</span>
          </div>
          <div className="border-border-soft text-text-body flex justify-between border-b px-3.5 py-2.5">
            <span>GST @ 18%</span>
            <span className="tabular-nums">{money(tax.gst)}</span>
          </div>
          <div className="bg-bg-tint text-text-navy flex justify-between px-3.5 py-2.5 font-medium">
            <span>Collected</span>
            <span className="tabular-nums">{money(paidGross)}</span>
          </div>
        </div>
        <Field
          label="Refund amount (₹)"
          required
          error={form.errorFor('amount')}
          hint={`Up to ${money(paidGross)}. Enter less for a partial refund.`}
        >
          <TextInput
            value={form.values.amount}
            onChange={(v) => form.setField('amount', v)}
            onBlur={() => form.blurField('amount')}
            inputMode="numeric"
            placeholder={String(paidGross)}
            height={48}
          />
        </Field>
        <Field
          label="Reason"
          required
          error={form.errorFor('reason')}
          hint="Recorded against the appointment — a refund without a reason is unauditable."
        >
          <TextInput
            value={form.values.reason}
            onChange={(v) => form.setField('reason', v)}
            onBlur={() => form.blurField('reason')}
            placeholder="e.g. Doctor unavailable, consultation not delivered"
            height={48}
          />
        </Field>
        <div className="text-caption text-text-body bg-y-100 flex items-start gap-2 rounded-md px-3 py-2.5">
          <Icon name="info" size={15} className="text-y-700 mt-0.5 flex-none" />
          <span>
            {viaDesk
              ? 'Desk refund — hand the cash back and record it here so the day’s collections reconcile.'
              : 'Prepaid online — Medibook returns the money to the patient’s original payment method. Record what the hospital has agreed to return.'}
          </span>
        </div>
      </div>
    </FormModal>
  );
}

/** Keyed wrapper: a new appointment gets a fresh form, with no prop-to-state effect. */
export function RefundModal({ appt, onClose, onRefunded }: RefundModalProps) {
  if (!appt) return null;
  return <RefundFormBody key={appt.id} appt={appt} onClose={onClose} onRefunded={onRefunded} />;
}
