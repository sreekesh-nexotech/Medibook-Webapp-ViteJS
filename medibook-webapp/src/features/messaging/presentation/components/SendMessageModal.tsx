import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';

import { renderTemplate } from '@/features/messaging/application/store/messaging.logic';
import type { QueueMessageInput } from '@/features/messaging/application/store/messaging.store';
import {
  MESSAGE_CHANNELS,
  type MessageChannel,
  type MessageEvent,
  type MessageTemplate,
  type SendTarget,
} from '@/features/messaging/application/store/messaging.types';
import { MessagePreview } from '@/features/messaging/presentation/components/MessagePreview';

/** The two events a desk legitimately triggers by hand (audit HA-12). */
const MANUAL_EVENTS: readonly MessageEvent[] = ['Booking confirmation', 'Reminder'];

interface SendForm {
  appointmentId: string;
  event: MessageEvent;
  channel: MessageChannel;
}

const VALIDATORS: FormValidators<SendForm> = {
  appointmentId: (v) => (v === '' ? 'Pick the appointment this message is about.' : undefined),
};

interface SendMessageModalProps {
  open: boolean;
  /** Appointments the desk may message, newest first. */
  targets: readonly SendTarget[];
  templates: readonly MessageTemplate[];
  onClose: () => void;
  /** Hands the resolved payload up; the screen confirms before queueing. */
  onReview: (input: QueueMessageInput, target: SendTarget) => void;
}

/** `"AP1000 — Ellen Kinderson · 8:30 am"` — one option line. */
function optionLabel(t: SendTarget): string {
  return `${t.appointmentId} — ${t.patientName} · ${t.doctorName} · ${t.time}`;
}

/**
 * Trigger a confirmation or reminder for one appointment (audit HA-12: "The
 * hospital cannot trigger a confirmation or reminder").
 *
 * The body is the live template with this appointment's values filled in, so
 * the desk sees the exact text before anything is queued. Submitting hands the
 * payload to the screen, which asks for confirmation naming the recipient and
 * the channel — nothing is queued from inside this modal.
 */
export function SendMessageModal({
  open,
  targets,
  templates,
  onClose,
  onReview,
}: SendMessageModalProps) {
  const form = useForm<SendForm>({
    initial: {
      appointmentId: targets[0]?.appointmentId ?? '',
      event: 'Reminder',
      channel: 'SMS',
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      const target = targets.find((t) => t.appointmentId === v.appointmentId);
      const template = templates.find((t) => t.event === v.event && t.channel === v.channel);
      if (!target || !template) return;
      onReview(
        {
          event: v.event,
          channel: v.channel,
          recipient: target.patientName,
          contact: v.channel === 'Email' ? target.email : target.phone,
          appointmentId: target.appointmentId,
          bookingRef: target.bookingRef,
          body: renderTemplate(template.body, {
            '{{patientName}}': target.patientName,
            '{{doctorName}}': target.doctorName,
            '{{date}}': target.date,
            '{{time}}': target.time,
            '{{token}}': target.token,
            '{{bookingRef}}': target.bookingRef,
          }),
        },
        target,
      );
    },
  });

  const target = targets.find((t) => t.appointmentId === form.values.appointmentId) ?? null;
  const template =
    templates.find((t) => t.event === form.values.event && t.channel === form.values.channel) ??
    null;

  const rendered =
    target && template
      ? renderTemplate(template.body, {
          '{{patientName}}': target.patientName,
          '{{doctorName}}': target.doctorName,
          '{{date}}': target.date,
          '{{time}}': target.time,
          '{{token}}': target.token,
          '{{bookingRef}}': target.bookingRef,
        })
      : '';

  const channelOff = template != null && !template.active;
  const noTemplate = template == null;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Send a message"
      width={680}
      onSubmit={form.handleSubmit}
      submitLabel="Review & queue"
      disabled={noTemplate || channelOff || targets.length === 0}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <Field label="Appointment" required error={form.errorFor('appointmentId')}>
          <Select
            value={target ? optionLabel(target) : ''}
            options={targets.map(optionLabel)}
            onChange={(label) => {
              const picked = targets.find((t) => optionLabel(t) === label);
              form.setField('appointmentId', picked?.appointmentId ?? '');
            }}
            placeholder={
              targets.length === 0 ? 'No appointments to message today' : 'Pick an appointment'
            }
            disabled={targets.length === 0}
            height={48}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Message">
            <Select
              value={form.values.event}
              options={MANUAL_EVENTS}
              onChange={(v) => form.setField('event', v as MessageEvent)}
              height={48}
            />
          </Field>
          <Field
            label="Channel"
            hint={
              target
                ? form.values.channel === 'Email'
                  ? `Goes to ${target.email}`
                  : `Goes to ${target.phone}`
                : undefined
            }
          >
            <Select
              value={form.values.channel}
              options={MESSAGE_CHANNELS}
              onChange={(v) => form.setField('channel', v as MessageChannel)}
              height={48}
            />
          </Field>
        </div>

        {noTemplate ? (
          <div className="text-body text-y-800 bg-y-100 flex items-start gap-2 rounded-md px-3.5 py-3">
            <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
            <span>
              There is no {form.values.event.toLowerCase()} template for {form.values.channel} yet.
              Add one in Templates first.
            </span>
          </div>
        ) : channelOff ? (
          <div className="text-body text-y-800 bg-y-100 flex items-start gap-2 rounded-md px-3.5 py-3">
            <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
            <span>
              {form.values.event} is switched off for {form.values.channel}. Switch the channel on
              in Templates, or pick another channel.
            </span>
          </div>
        ) : (
          <MessagePreview
            channel={form.values.channel}
            subject={template?.subject}
            rendered={rendered}
            title="This patient will receive"
          />
        )}

        <div className="text-caption text-text-muted flex items-start gap-2">
          <Icon name="info" size={14} className="mt-0.5 flex-none" />
          <span>
            Messages are queued for the gateway, not delivered from this screen — the outbox shows
            what is waiting and lets you cancel it.
          </span>
        </div>
      </div>
    </FormModal>
  );
}
