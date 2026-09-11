import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { email } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { useBillingStore } from '@/features/ops-billing/application/store/billing.store';
import type {
  Invoice,
  ReminderChannel,
} from '@/features/ops-billing/application/store/billing.types';

interface ReminderForm {
  channel: ReminderChannel;
  to: string;
}

const CHANNELS: readonly ReminderChannel[] = ['Email', 'SMS'];

/**
 * Indian mobile or landline as the registry stores it — "+91 98220 44315",
 * "080 4567 8900". Deliberately looser than `phoneIN`, which only accepts a
 * bare 10-digit mobile and would reject every seeded hospital number.
 */
function reminderPhone(value: string): string | undefined {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits === '') return 'A phone number is required for an SMS reminder.';
  if (digits.length < 10) return 'Enter the full phone number, including the STD or country code.';
  return undefined;
}

const VALIDATORS: FormValidators<ReminderForm> = {
  to: (value, values) => (values.channel === 'Email' ? email(value) : reminderPhone(value)),
};

interface SendReminderModalProps {
  open: boolean;
  invoice: Invoice;
  /** Prefilled email and phone from the hospital's registry record. */
  hospitalEmail: string;
  hospitalPhone: string;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * Queue a payment reminder against an overdue invoice (audit SA-03: "no
 * reminder").
 *
 * Nothing in this build delivers email or SMS, so the wording never says
 * "sent": the reminder is **queued** and written to the invoice's reminder
 * history with the channel, the recipient, who asked for it and when — an
 * effect that is visible and true, rather than a toast about a message that
 * never left.
 */
export function SendReminderModal({
  open,
  invoice,
  hospitalEmail,
  hospitalPhone,
  onClose,
  onDone,
}: SendReminderModalProps) {
  const sendReminder = useBillingStore((s) => s.sendReminder);
  const [busy, run] = useOpsAct();

  const form = useForm<ReminderForm>({
    initial: { channel: 'Email', to: hospitalEmail },
    validate: VALIDATORS,
    onSubmit: (values) => {
      run('reminder', `Reminder queued for ${invoice.no} — recorded in its history.`, () => {
        sendReminder(invoice.id, values.channel, values.to.trim());
        onDone?.();
      });
    },
  });

  const { values } = form;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={`Queue a reminder for ${invoice.no}`}
      width={500}
      onSubmit={form.handleSubmit}
      submitLabel="Queue Reminder"
      busy={busy.reminder}
    >
      <div className="flex flex-col gap-4.5">
        <OpsField label="Channel" required>
          <Select
            value={values.channel}
            options={CHANNELS}
            onChange={(v) => {
              const channel = v as ReminderChannel;
              form.setValues({
                channel,
                to: channel === 'Email' ? hospitalEmail : hospitalPhone,
              });
            }}
            height={48}
          />
        </OpsField>
        <OpsField
          label={values.channel === 'Email' ? 'To (email)' : 'To (mobile)'}
          required
          error={form.errorFor('to')}
          hint={`From ${invoice.hospital}'s registry record — change it to reach someone else.`}
        >
          <TextInput
            value={values.to}
            onChange={(v) => form.setField('to', v)}
            onBlur={() => form.blurField('to')}
            inputMode={values.channel === 'Email' ? 'email' : 'tel'}
            height={48}
          />
        </OpsField>
        <div className="text-caption text-text-muted bg-y-100 flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="triangle-alert" size={14} className="mt-px flex-none" /> Delivery is not wired
          up yet. The reminder is recorded against this invoice as{' '}
          <b className="text-text-strong font-medium">Queued</b>, with your name and the time — it
          is not transmitted to the hospital.
        </div>
      </div>
    </FormModal>
  );
}
