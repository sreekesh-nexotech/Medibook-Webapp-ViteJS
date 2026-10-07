import { useState } from 'react';

import type { FieldErrors } from '@/core/error/failure';
import { isFailure } from '@/core/error/failure';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { minLen, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { SupportTicketCategory } from '@/features/help/domain/entities/help.types';
import {
  SUPPORT_TICKET_CATEGORIES,
  TICKET_DESCRIPTION_MAX,
  TICKET_SUBJECT_MAX,
} from '@/features/help/domain/entities/help.types';
import { useRaiseSupportTicketMutation } from '@/features/help/application/queries/useRaiseSupportTicketMutation';

import { CATEGORY_LABELS } from './help.view';

/** Topic options offered on the ticket form — the backend's categories. */
const TOPIC_OPTIONS = SUPPORT_TICKET_CATEGORIES.map((c) => CATEGORY_LABELS[c]);

/** The category a picked topic label stands for (`undefined` until one is picked). */
function categoryFor(label: string): SupportTicketCategory | undefined {
  return SUPPORT_TICKET_CATEGORIES.find((c) => CATEGORY_LABELS[c] === label);
}

const SEND_FAILED = 'Could not send your ticket. Please try again.';

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
  /** The new ticket's id, so the screen can open its thread. */
  onRaised?: (ticketId: string) => void;
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
 * Sending raises a real ticket (`POST /hospital/support/tickets`); the success
 * toast carries its ticket number and the screen opens its thread. Field
 * errors the server returns show under their own control; anything else is a
 * toast and the modal stays open.
 */
export function RaiseTicketModal({ open, onClose, onRaised }: RaiseTicketModalProps) {
  const raise = useRaiseSupportTicketMutation();
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});

  const form = useForm<TicketForm>({
    initial: { subject: '', category: '', description: '' },
    validate: TICKET_VALIDATORS,
    onSubmit: ({ subject, category, description }) => {
      const picked = categoryFor(category);
      if (!picked) return;
      setServerErrors({});
      raise.mutate(
        { category: picked, subject, description },
        {
          onSuccess: (ticket) => {
            toast(`Ticket ${ticket.ticketNo} sent to Medibook`);
            form.reset({ subject: '', category: '', description: '' });
            onClose();
            onRaised?.(ticket.id);
          },
          onError: (failure) => {
            setServerErrors(isFailure(failure) ? failure.fieldErrors : {});
            toast(isFailure(failure) ? failure.message : SEND_FAILED, 'error');
          },
        },
      );
    },
  });

  /** The client-side error first, else what the server said about this field. */
  const errorFor = (key: keyof TicketForm): string | undefined =>
    form.errorFor(key) ?? serverErrors[key]?.join(' ');

  const close = (): void => {
    form.reset({ subject: '', category: '', description: '' });
    setServerErrors({});
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={close}
      title="Raise a Support Ticket"
      width={520}
      submitLabel="Send to Medibook"
      busy={raise.isPending}
      onSubmit={form.handleSubmit}
    >
      <div className="flex flex-col gap-4">
        <Field label="Subject" required error={errorFor('subject')}>
          <TextInput
            value={form.values.subject}
            onChange={(v) => form.setField('subject', v)}
            onBlur={() => form.blurField('subject')}
            placeholder="One line — e.g. Settlement MB-ST-2405 not received"
            maxLength={TICKET_SUBJECT_MAX}
          />
        </Field>
        <Field label="Topic" required error={errorFor('category')}>
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
          error={errorFor('description')}
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
              maxLength={TICKET_DESCRIPTION_MAX}
              placeholder="What's happening?"
              className={cn(
                'rounded-input text-body-lg text-text-strong h-24 w-full resize-none border p-3',
                invalid ? 'border-d-500' : 'border-border',
              )}
            />
          )}
        </Field>
        <div className="text-caption text-text-muted">
          Tickets go straight to the Medibook operations team. Their replies show under My tickets
          and reach you by email.
        </div>
      </div>
    </FormModal>
  );
}
