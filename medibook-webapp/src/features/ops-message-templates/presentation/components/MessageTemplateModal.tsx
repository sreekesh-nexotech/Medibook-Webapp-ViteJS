import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextArea } from '@/shared/ui/TextArea';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSaveMessageTemplateMutation } from '@/features/ops-message-templates/application/queries/useSaveMessageTemplateMutation';
import type {
  MessageChannel,
  MessageTemplate,
  MessageTemplateDraft,
} from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';
import {
  DEFAULT_LOCALE,
  MESSAGE_CHANNELS,
} from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';
import {
  CHANNEL_LABEL,
  eventPlaceholders,
  hasTemplateErrors,
  knownEvents,
  SUBJECT_LABEL,
  templateErrors,
  templateNotes,
  type TemplateErrors,
} from '@/features/ops-message-templates/presentation/components/messageTemplates.rules';

const OTHER_EVENT = 'Another event code…';

interface MessageTemplateModalProps {
  /** The template being edited, or `null` to create one. */
  template: MessageTemplate | null;
  /** Every template, for suggestions, placeholders and the one-active rule. */
  templates: readonly MessageTemplate[];
  onClose: () => void;
}

/**
 * Add a template, or edit one's wording (`POST` / `PATCH
 * /platform/messaging/templates` + `If-Match`). Event, channel and locale
 * are fixed once created (the backend refuses to change them), so editing
 * shows them read-only. Mount only while open.
 */
export function MessageTemplateModal({ template, templates, onClose }: MessageTemplateModalProps) {
  const save = useSaveMessageTemplateMutation();
  const events = knownEvents(templates);
  const [eventCode, setEventCode] = useState(template?.eventCode ?? events[0] ?? '');
  const [customEvent, setCustomEvent] = useState(events.length === 0);
  const [channel, setChannel] = useState<MessageChannel>(template?.channel ?? 'sms');
  const [locale, setLocale] = useState(template?.locale ?? DEFAULT_LOCALE);
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [waName, setWaName] = useState(template?.whatsappTemplateName ?? '');
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [err, setErr] = useState<TemplateErrors>({});
  const editing = template !== null;

  const draft: MessageTemplateDraft = {
    eventCode,
    channel,
    locale,
    subject: SUBJECT_LABEL[channel] === null ? null : subject,
    body,
    whatsappTemplateName: channel === 'whatsapp' ? waName : null,
    isActive,
  };
  const editingId = template?.id ?? null;
  const notes = templateNotes(draft, templates, editingId);
  const placeholders = eventPlaceholders(templates, eventCode.trim(), editingId);
  const subjectLabel = SUBJECT_LABEL[channel];

  const submit = (): void => {
    const e = templateErrors(draft, templates, editingId);
    setErr(e);
    if (hasTemplateErrors(e)) return;
    save.mutate(
      { id: editingId, draft, version: template?.version ?? 0 },
      {
        onSuccess: () => {
          toast(editing ? 'Template saved.' : 'Template added.', 'success');
          onClose();
        },
        onError: (failure) => {
          if (isFailure(failure)) {
            const fe = failure.fieldErrors;
            setErr({
              eventCode: fe.eventCode?.[0],
              channel: fe.channel?.[0],
              locale: fe.locale?.[0],
              subject: fe.subject?.[0],
              body: fe.body?.[0],
              whatsappTemplateName: fe.whatsappTemplateName?.[0],
            });
          }
          toast(isFailure(failure) ? failure.message : 'Could not save the template.', 'error');
        },
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={editing ? 'Edit message template' : 'Add message template'}
      width={720}
      onSubmit={submit}
      submitLabel={editing ? 'Save template' : 'Add template'}
      busy={save.isPending}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <OpsField
            label="Event"
            required
            error={err.eventCode}
            hint={editing ? 'Fixed once created.' : undefined}
          >
            {editing ? (
              <TextInput value={eventCode} readOnly height={48} />
            ) : customEvent ? (
              <TextInput
                value={eventCode}
                onChange={setEventCode}
                placeholder="e.g. appointment.confirmed"
                height={48}
              />
            ) : (
              <Select
                value={eventCode}
                options={[...events, OTHER_EVENT]}
                onChange={(v) => {
                  if (v === OTHER_EVENT) {
                    setCustomEvent(true);
                    setEventCode('');
                  } else {
                    setEventCode(v);
                  }
                }}
                height={48}
              />
            )}
          </OpsField>
          <OpsField label="Channel" required error={err.channel}>
            <Select
              value={CHANNEL_LABEL[channel]}
              options={MESSAGE_CHANNELS.map((c) => CHANNEL_LABEL[c])}
              onChange={(v) =>
                setChannel(MESSAGE_CHANNELS.find((c) => CHANNEL_LABEL[c] === v) ?? channel)
              }
              disabled={editing}
              height={48}
            />
          </OpsField>
          <OpsField label="Locale" required error={err.locale}>
            <TextInput value={locale} onChange={setLocale} readOnly={editing} height={48} />
          </OpsField>
        </div>
        {subjectLabel && (
          <OpsField label={subjectLabel} required={channel === 'email'} error={err.subject}>
            <TextInput value={subject} onChange={setSubject} height={48} />
          </OpsField>
        )}
        {channel === 'whatsapp' && (
          <OpsField
            label="WhatsApp template name"
            required
            error={err.whatsappTemplateName}
            hint="The name of the template approved in WhatsApp Business. Placeholders are sent as its parameters, in the order they appear."
          >
            <TextInput value={waName} onChange={setWaName} height={48} />
          </OpsField>
        )}
        <OpsField
          label="Message"
          required
          error={err.body}
          hint={
            placeholders.length > 0
              ? `This event fills in: ${placeholders.map((p) => `{{${p}}}`).join(' ')}`
              : 'Use {{name}} placeholders for values the event fills in.'
          }
        >
          <TextArea value={body} onChange={setBody} rows={6} />
        </OpsField>
        {notes.length > 0 && (
          <ul className="bg-y-100 m-0 flex list-none flex-col gap-1.5 rounded-md p-3">
            {notes.map((n) => (
              <li key={n} className="text-caption text-text-body flex items-start gap-2">
                <Icon name="info" size={14} className="text-y-700 mt-0.5 shrink-0" />
                {n}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Toggle value={isActive} onChange={setIsActive} label="Active" />
            <span className="text-body text-text-strong">
              {isActive ? 'Active — used for new messages' : 'Off — kept but not used'}
            </span>
          </div>
          {err.isActive && <span className="text-caption text-d-500">{err.isActive}</span>}
        </div>
      </div>
    </FormModal>
  );
}
