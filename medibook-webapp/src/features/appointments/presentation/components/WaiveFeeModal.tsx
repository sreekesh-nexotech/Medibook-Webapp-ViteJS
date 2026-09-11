import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { minLen } from '@/shared/lib/validate';
import { Avatar } from '@/shared/ui/Avatar';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { useAppointmentsStore } from '@/features/appointments/application/store/appointments.store';
import { grossAmount } from '@/features/appointments/application/store/appointments.logic';
import type { Appointment } from '@/features/appointments/application/store/appointments.types';

/** The reasons a hospital desk actually writes off a consultation fee. */
const WAIVER_GROUNDS = [
  'Hospital staff / dependant',
  'Charity / free camp patient',
  'Follow-up within free window',
  'Service failure (long wait, doctor unavailable)',
  'Management approval',
  'Other',
];

const MIN_NOTE_LEN = 4;

interface WaiveForm {
  ground: string;
  note: string;
}

/**
 * HA-09: "Approve and fee waiver have no control." A waiver writes money off,
 * so it is gated on `Appointments.edit` at the call site and refuses to save
 * without a reason — a waiver nobody can explain is unauditable.
 */
const VALIDATORS: FormValidators<WaiveForm> = {
  ground: (value) => (WAIVER_GROUNDS.includes(value) ? undefined : 'Choose why the fee is waived.'),
  note: (value, values) =>
    values.ground === 'Other' ? minLen(value, MIN_NOTE_LEN, 'A waiver note') : undefined,
};

interface WaiveFeeModalProps {
  appt: Appointment | null;
  onClose: () => void;
}

function WaiveFeeForm({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const waiveFee = useAppointmentsStore((s) => s.waiveFee);
  const gross = grossAmount(appt);
  const form = useForm<WaiveForm>({
    initial: { ground: '', note: '' },
    validate: VALIDATORS,
    onSubmit: (v) => {
      const note = v.note.trim();
      waiveFee(appt.id, note === '' ? v.ground : `${v.ground} — ${note}`);
      onClose();
    },
  });

  return (
    <FormModal
      open
      onClose={onClose}
      title="Waive Consultation Fee"
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel="Waive Fee"
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
          <span className="text-body text-text-navy font-semibold tabular-nums">
            {money(gross)}
          </span>
        </div>
        <Field label="Grounds for the waiver" required error={form.errorFor('ground')}>
          <Select
            value={form.values.ground}
            placeholder="Select the grounds"
            options={WAIVER_GROUNDS}
            onChange={(v) => form.setField('ground', v)}
            onBlur={() => form.blurField('ground')}
          />
        </Field>
        <Field
          label={form.values.ground === 'Other' ? 'Note' : 'Note (optional)'}
          required={form.values.ground === 'Other'}
          error={form.errorFor('note')}
          hint="Stored on the appointment and shown on the billing summary."
        >
          <TextInput
            value={form.values.note}
            onChange={(v) => form.setField('note', v)}
            onBlur={() => form.blurField('note')}
            placeholder="Who approved it, and why"
            height={48}
          />
        </Field>
        <div className="text-caption text-text-body bg-y-100 flex items-start gap-2 rounded-md px-3 py-2.5">
          <Icon name="triangle-alert" size={15} className="text-y-700 mt-0.5 flex-none" />
          <span>
            {money(gross)} will be written off, including GST. The appointment shows as{' '}
            <b>Waived</b> — not Paid — so the day’s collections still reconcile.
          </span>
        </div>
      </div>
    </FormModal>
  );
}

/** Keyed wrapper: a new appointment gets a fresh form, with no prop-to-state effect. */
export function WaiveFeeModal({ appt, onClose }: WaiveFeeModalProps) {
  if (!appt) return null;
  return <WaiveFeeForm key={appt.id} appt={appt} onClose={onClose} />;
}
