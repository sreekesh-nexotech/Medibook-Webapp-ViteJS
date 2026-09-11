import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import {
  PLACEHOLDERS,
  renderTemplate,
  sampleValues,
  unknownPlaceholders,
} from '@/features/messaging/application/store/messaging.logic';
import type { TemplatePatch } from '@/features/messaging/application/store/messaging.store';
import type { MessageTemplate } from '@/features/messaging/application/store/messaging.types';
import { MessagePreview } from '@/features/messaging/presentation/components/MessagePreview';

interface TemplateForm {
  subject: string;
  body: string;
  active: boolean;
}

const VALIDATORS: FormValidators<TemplateForm> = {
  body: (v) => {
    const empty = required(v, 'Message body');
    if (empty) return empty;
    const unknown = unknownPlaceholders(v);
    return unknown.length > 0
      ? `Unknown placeholder ${unknown.join(', ')} — it would reach the patient as raw text. Use one from the list below.`
      : undefined;
  },
};

interface TemplateModalProps {
  open: boolean;
  template: MessageTemplate;
  onClose: () => void;
  onSave: (id: string, patch: TemplatePatch) => void;
}

/**
 * Edit one event × channel template (audit HA-11). The placeholder vocabulary
 * is documented in the modal and clickable, the preview renders with sample
 * data as you type, and an unknown `{{token}}` is an inline field error rather
 * than a surprise in a patient's inbox.
 */
export function TemplateModal({ open, template, onClose, onSave }: TemplateModalProps) {
  const form = useForm<TemplateForm>({
    initial: {
      subject: template.subject,
      body: template.body,
      active: template.active,
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      onSave(template.id, {
        subject: v.subject.trim(),
        body: v.body,
        active: v.active,
      });
      onClose();
    },
  });

  const rendered = renderTemplate(form.values.body, sampleValues());

  const insert = (token: string): void => {
    const body = form.values.body;
    const spacer = body.length === 0 || /\s$/.test(body) ? '' : ' ';
    form.setField('body', `${body}${spacer}${token}`);
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={`${template.event} — ${template.channel}`}
      width={680}
      onSubmit={form.handleSubmit}
      submitLabel="Save Template"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        {template.channel === 'Email' && (
          <Field label="Subject" error={form.errorFor('subject')}>
            <TextInput
              value={form.values.subject}
              onChange={(v) => form.setField('subject', v)}
              onBlur={() => form.blurField('subject')}
              placeholder="Your appointment is confirmed — {{date}}"
              height={48}
            />
          </Field>
        )}

        <Field
          label="Message Body"
          required
          error={form.errorFor('body')}
          hint="Placeholders are replaced per patient when the message goes out."
        >
          <textarea
            value={form.values.body}
            onChange={(e) => form.setField('body', e.target.value)}
            onBlur={() => form.blurField('body')}
            className="rounded-input border-border text-body text-text-strong box-border h-40 w-full resize-none border p-3"
            autoFocus
          />
        </Field>

        <div>
          <div className="text-caption text-text-muted mb-2">
            Click to add a placeholder at the end of the body:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PLACEHOLDERS.map((p) => (
              <button
                key={p.token}
                type="button"
                onClick={() => insert(p.token)}
                title={`${p.label} — e.g. ${p.sample}`}
                className="text-caption bg-blue-soft-bg text-blue inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5"
              >
                <Icon name="plus" size={12} /> {p.token}
              </button>
            ))}
          </div>
        </div>

        <MessagePreview
          channel={template.channel}
          subject={form.values.subject}
          rendered={rendered}
        />

        <div className="border-border-soft flex items-center gap-3 rounded-md border px-3.5 py-3">
          <Toggle
            value={form.values.active}
            onChange={(v) => form.setField('active', v)}
            label={`Message ${template.event.toLowerCase()} on ${template.channel}`}
          />
          <div className="flex flex-col">
            <span className="text-body text-text-strong font-medium">
              Use this channel for {template.event.toLowerCase()}
            </span>
            <span className="text-caption text-text-muted">
              Switched off, the body is kept but nothing goes out on {template.channel}.
            </span>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
