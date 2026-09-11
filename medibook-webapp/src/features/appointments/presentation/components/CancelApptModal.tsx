import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { positiveAmount, required } from '@/shared/lib/validate';
import { Can } from '@/shared/ui/Can';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { grossAmount } from '@/features/appointments/application/store/appointments.logic';
import type { Appointment } from '@/features/appointments/application/store/appointments.types';

const CANCEL_REASONS = [
  'Patient request',
  'Doctor unavailable',
  'Duplicate booking',
  'Scheduling error',
  'Other',
];

interface CancelForm {
  reason: string;
  refund: boolean;
  /** Rupees to hand back — free text so a partial figure can be typed. */
  refundAmount: string;
  /** The gross already collected. Read-only; the refund may not exceed it. */
  paidGross: number;
}

/**
 * HA-09: a refund needs an amount that can be partial and a reason that makes
 * it auditable, and both are checked inline rather than in a toast that
 * disappears. `paidGross` rides along in the form values so the cap is part of
 * the validated data and the validator map can stay module-level (stable memo).
 */
const VALIDATORS: FormValidators<CancelForm> = {
  reason: (value, values) => (values.refund ? required(value, 'A refund reason') : undefined),
  refundAmount: (value, values) => {
    if (!values.refund) return undefined;
    const invalid = positiveAmount(value, 'Refund amount');
    if (invalid) return invalid;
    return Number(value) > values.paidGross
      ? `The refund cannot exceed the ${money(values.paidGross)} collected.`
      : undefined;
  },
};

interface CancelApptModalProps {
  appt: Appointment | null;
  onClose: () => void;
}

/** Cancel with a reason + a validated (optionally partial) refund. */
function CancelApptForm({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const cancel = useAppointmentsStore((s) => s.cancel);
  const paidGross = grossAmount(appt);
  // Money can go back whenever some was taken — a prepaid online booking as
  // much as a desk-collected walk-in. The audit found the refund control was
  // reachable only for paid walk-ins.
  const refundable = appt.payment === 'Paid';
  const viaDesk = appt.source === 'Walk-in';

  const form = useForm<CancelForm>({
    initial: {
      reason: '',
      refund: refundable,
      refundAmount: refundable ? String(paidGross) : '',
      paidGross,
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      cancel(
        appt.id,
        v.reason,
        refundable && v.refund
          ? {
              amount: Number(v.refundAmount),
              reason: v.reason,
              via: viaDesk ? 'Desk' : 'Medibook',
            }
          : null,
      );
      onClose();
    },
  });

  const refundNote =
    appt.source === 'Online'
      ? 'Prepaid online — Medibook processes the refund to the patient per its slab policy (little or none on the day of the visit, near-full if cancelled well in advance). Record here what the hospital has agreed to return.'
      : appt.payment === 'Paid'
        ? 'Payment was collected at the desk. Record the amount handed back so desk collections reconcile.'
        : 'No payment was collected for this walk-in.';

  return (
    <FormModal
      open
      onClose={onClose}
      title="Cancel Appointment"
      width={440}
      onSubmit={form.handleSubmit}
      submitLabel="Cancel Appointment"
      submitVariant="danger"
      cancelLabel="Keep Appointment"
      busy={form.submitting}
    >
      <p className="text-body-lg text-text-body m-0 mb-3.5">
        Cancel the appointment for <b>{appt.name}</b> with {appt.doctor}?
      </p>
      <Field
        label={form.values.refund ? 'Reason' : 'Reason (optional)'}
        required={form.values.refund}
        error={form.errorFor('reason')}
      >
        <Select
          value={form.values.reason}
          placeholder="Select a reason"
          options={CANCEL_REASONS}
          onChange={(v) => form.setField('reason', v)}
          onBlur={() => form.blurField('reason')}
        />
      </Field>
      <div className="bg-blue-soft-bg mt-4 flex gap-2.5 rounded-md px-3.5 py-3">
        <Icon name="info" size={16} className="text-blue mt-0.5 flex-none" />
        <div className="text-caption text-text-body leading-[1.55]">{refundNote}</div>
      </div>
      {refundable && (
        <Can perm={['Payments.del', 'Appointments.del']}>
          <div className="border-border-soft mt-3 flex flex-col gap-3 rounded-md border px-3.5 py-3">
            <div className="flex items-center gap-3">
              <Toggle
                value={form.values.refund}
                onChange={(v) => form.setField('refund', v)}
                label="Record a refund for this cancellation"
              />
              <div className="flex-1">
                <div className="text-body text-text-strong font-medium">
                  Record {viaDesk ? 'a desk refund' : 'a Medibook refund'}
                </div>
                <div className="text-caption text-text-muted">
                  {money(paidGross)} collected · marks the payment Refunded so collections
                  reconcile.
                </div>
              </div>
            </div>
            {form.values.refund && (
              <Field
                label="Refund amount (₹)"
                required
                error={form.errorFor('refundAmount')}
                hint={`Up to ${money(paidGross)}. Enter less for a partial refund.`}
              >
                <TextInput
                  value={form.values.refundAmount}
                  onChange={(v) => form.setField('refundAmount', v)}
                  onBlur={() => form.blurField('refundAmount')}
                  inputMode="numeric"
                  placeholder={String(paidGross)}
                  height={48}
                />
              </Field>
            )}
          </div>
        </Can>
      )}
    </FormModal>
  );
}

/** Keyed wrapper: a new appointment gets a fresh form, with no prop-to-state effect. */
export function CancelApptModal({ appt, onClose }: CancelApptModalProps) {
  if (!appt) return null;
  return <CancelApptForm key={appt.id} appt={appt} onClose={onClose} />;
}
