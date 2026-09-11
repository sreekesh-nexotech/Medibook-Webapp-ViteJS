import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { minLen, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { useSettlementsStore } from '@/features/settlements/application/store/settlements.store';

/** Topic options offered on the ticket form (design `Select` options). */
const TOPIC_OPTIONS = [
  'Billing & settlements',
  'Appointments & queue',
  'Plan & subscription',
  'Technical issue',
  'Other',
] as const;

/** Enough characters to be a useful subject / a diagnosable description. */
const SUBJECT_MIN = 6;
const DESCRIPTION_MIN = 20;

interface TicketForm {
  subject: string;
  category: string;
  description: string;
}

/** Module-level so `useForm`'s error memo stays stable across renders. */
const TICKET_VALIDATORS: FormValidators<TicketForm> = {
  subject: (v) => minLen(v, SUBJECT_MIN, 'Subject'),
  category: (v) => required(v, 'Category'),
  description: (v) => minLen(v, DESCRIPTION_MIN, 'Description'),
};

interface RaiseTicketModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Raise a Support Ticket" modal (design `Admin.jsx` `HelpSupport`).
 *
 * Audit 3.5.2 — "a support ticket can be raised empty and lands in the
 * Medibook inbox that way" — is fixed by making this a `FormModal` (Enter
 * submits) whose three fields are validated inline through `useForm`: the
 * subject and description have minimum lengths and the category must be
 * chosen, each error shown under its own control rather than as a toast.
 *
 * Sending calls the settlements store's `raiseTicket`, which puts the ticket in
 * the ops inbox — a real cross-app effect, so the success toast it raises is
 * earned.
 */
export function RaiseTicketModal({ open, onClose }: RaiseTicketModalProps) {
  const raiseTicket = useSettlementsStore((s) => s.raiseTicket);

  const form = useForm<TicketForm>({
    initial: { subject: '', category: '', description: '' },
    validate: TICKET_VALIDATORS,
    onSubmit: ({ subject, category, description }) => {
      raiseTicket(`${category} — ${subject.trim()}`, description.trim());
      form.reset({ subject: '', category: '', description: '' });
      onClose();
    },
  });

  const close = (): void => {
    form.reset({ subject: '', category: '', description: '' });
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={close}
      title="Raise a Support Ticket"
      width={520}
      submitLabel="Send to Medibook"
      busy={form.submitting}
      onSubmit={form.handleSubmit}
    >
      <div className="flex flex-col gap-4">
        <Field label="Subject" required error={form.errorFor('subject')}>
          <TextInput
            value={form.values.subject}
            onChange={(v) => form.setField('subject', v)}
            onBlur={() => form.blurField('subject')}
            placeholder="One line — e.g. Settlement MB-ST-2405 not received"
            maxLength={120}
          />
        </Field>
        <Field label="Topic" required error={form.errorFor('category')}>
          <Select
            value={form.values.category}
            placeholder="Pick the closest topic"
            options={TOPIC_OPTIONS}
            onChange={(v) => form.setField('category', v)}
            onBlur={() => form.blurField('category')}
          />
        </Field>
        <Field
          label="Describe the issue"
          required
          error={form.errorFor('description')}
          hint={`At least ${DESCRIPTION_MIN} characters — dates, IDs and what you expected help most`}
        >
          {({ id, describedById, invalid }) => (
            <textarea
              id={id}
              aria-describedby={describedById}
              aria-invalid={invalid || undefined}
              value={form.values.description}
              onChange={(e) => form.setField('description', e.target.value)}
              onBlur={() => form.blurField('description')}
              placeholder="What's happening?"
              className={cn(
                'rounded-input text-body-lg text-text-strong h-24 w-full resize-none border p-3',
                invalid ? 'border-d-500' : 'border-border',
              )}
            />
          )}
        </Field>
        <div className="text-caption text-text-muted">
          Tickets go straight to the Medibook operations team — they appear in their console
          notifications.
        </div>
      </div>
    </FormModal>
  );
}
