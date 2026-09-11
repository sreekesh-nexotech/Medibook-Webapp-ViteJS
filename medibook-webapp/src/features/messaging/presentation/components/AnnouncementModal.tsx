import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { fmtDate } from '@/shared/lib/format';
import { minLen, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { SegTabs } from '@/shared/ui/SegTabs';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import {
  estimateReach,
  type ReachCounts,
} from '@/features/messaging/application/store/messaging.logic';
import type { AnnouncementInput } from '@/features/messaging/application/store/messaging.store';
import {
  ANNOUNCEMENT_AUDIENCES,
  MESSAGE_CHANNELS,
  type AnnouncementAudience,
  type MessageChannel,
} from '@/features/messaging/application/store/messaging.types';
import { MessagePreview } from '@/features/messaging/presentation/components/MessagePreview';

const MIN_TITLE_CHARS = 6;
const MIN_BODY_CHARS = 15;

const TIMINGS = ['Queue now', 'Schedule'] as const;

type Timing = (typeof TIMINGS)[number];

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-12 w-full border bg-white px-3';

interface AnnouncementForm {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  audienceRef: string;
  channel: MessageChannel;
  timing: Timing;
  scheduledFor: string;
}

const VALIDATORS: FormValidators<AnnouncementForm> = {
  title: (v) => minLen(v, MIN_TITLE_CHARS, 'Title'),
  body: (v) => minLen(v, MIN_BODY_CHARS, 'Announcement'),
  audienceRef: (v, values) => {
    if (values.audience === 'All patients') return undefined;
    if (v.trim() !== '') return undefined;
    return values.audience === "A department's patients"
      ? 'Pick the department whose patients this is for.'
      : 'Pick the date whose appointments this is for.';
  },
  scheduledFor: (v, values) =>
    values.timing === 'Schedule' ? required(v, 'Send date') : undefined,
};

interface AnnouncementModalProps {
  open: boolean;
  departments: readonly string[];
  /** Counts the reach estimate is derived from. */
  reach: ReachCounts;
  onClose: () => void;
  onPublish: (input: AnnouncementInput) => void;
}

/**
 * Compose an announcement (audit HA-12: the hospital "cannot publish an
 * announcement"). Audience, channel and timing are real choices, and the
 * reach figure is derived from the chosen audience so the composer cannot
 * claim an audience it does not have.
 */
export function AnnouncementModal({
  open,
  departments,
  reach,
  onClose,
  onPublish,
}: AnnouncementModalProps) {
  const form = useForm<AnnouncementForm>({
    initial: {
      title: '',
      body: '',
      audience: 'All patients',
      audienceRef: '',
      channel: 'SMS',
      timing: 'Queue now',
      scheduledFor: '',
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      onPublish({
        title: v.title.trim(),
        body: v.body.trim(),
        audience: v.audience,
        audienceRef: v.audience === 'All patients' ? '' : v.audienceRef,
        channel: v.channel,
        scheduledFor: v.timing === 'Schedule' ? v.scheduledFor : '',
        reach: estimateReach(v.audience, v.audienceRef, reach),
      });
      onClose();
    },
  });

  const recipients = estimateReach(form.values.audience, form.values.audienceRef, reach);

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="New Announcement"
      width={680}
      onSubmit={form.handleSubmit}
      submitLabel={form.values.timing === 'Schedule' ? 'Schedule Announcement' : 'Queue Now'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <Field label="Title" required error={form.errorFor('title')}>
          <TextInput
            value={form.values.title}
            onChange={(v) => form.setField('title', v)}
            onBlur={() => form.blurField('title')}
            placeholder="e.g. OPD closed on 17 June"
            height={48}
            autoFocus
          />
        </Field>

        <Field label="Announcement" required error={form.errorFor('body')}>
          <textarea
            value={form.values.body}
            onChange={(e) => form.setField('body', e.target.value)}
            onBlur={() => form.blurField('body')}
            placeholder="What patients need to know, and what they should do."
            className="rounded-input border-border text-body text-text-strong box-border h-24 w-full resize-none border p-3"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Audience">
            <Select
              value={form.values.audience}
              options={ANNOUNCEMENT_AUDIENCES}
              onChange={(v) => {
                form.setField('audience', v as AnnouncementAudience);
                form.setField('audienceRef', '');
              }}
              height={48}
            />
          </Field>
          {form.values.audience === "A department's patients" && (
            <Field label="Department" required error={form.errorFor('audienceRef')}>
              <Select
                value={form.values.audienceRef}
                options={departments}
                onChange={(v) => form.setField('audienceRef', v)}
                onBlur={() => form.blurField('audienceRef')}
                placeholder="Select a department"
                height={48}
              />
            </Field>
          )}
          {form.values.audience === "A date's appointments" && (
            <Field label="Appointment date" required error={form.errorFor('audienceRef')}>
              <input
                type="date"
                value={form.values.audienceRef}
                onChange={(e) => form.setField('audienceRef', e.target.value)}
                onBlur={() => form.blurField('audienceRef')}
                aria-label="Appointment date"
                className={DATE_INPUT_CLASS}
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Channel">
            <Select
              value={form.values.channel}
              options={MESSAGE_CHANNELS}
              onChange={(v) => form.setField('channel', v as MessageChannel)}
              height={48}
            />
          </Field>
          <Field label="Timing">
            <SegTabs
              tabs={TIMINGS}
              value={form.values.timing}
              onChange={(v) => form.setField('timing', v as Timing)}
            />
          </Field>
        </div>

        {form.values.timing === 'Schedule' && (
          <Field
            label="Send on"
            required
            error={form.errorFor('scheduledFor')}
            hint="Scheduled announcements go out at 09:00 local time."
          >
            <input
              type="date"
              value={form.values.scheduledFor}
              onChange={(e) => form.setField('scheduledFor', e.target.value)}
              onBlur={() => form.blurField('scheduledFor')}
              aria-label="Send on"
              className={DATE_INPUT_CLASS}
            />
          </Field>
        )}

        <MessagePreview
          channel={form.values.channel}
          subject={form.values.title}
          rendered={form.values.body}
          title="Patients will see"
        />

        <div className="text-body text-text-body bg-blue-soft-bg flex items-start gap-2 rounded-md px-3.5 py-3">
          <Icon name="megaphone" size={16} className="text-blue mt-0.5 flex-none" />
          <span>
            {form.values.timing === 'Schedule'
              ? `Queued for ~${recipients} ${recipients === 1 ? 'recipient' : 'recipients'} on ${
                  form.values.scheduledFor ? fmtDate(form.values.scheduledFor) : 'the chosen date'
                }. You can cancel it until it goes out.`
              : `Queued immediately for ~${recipients} ${recipients === 1 ? 'recipient' : 'recipients'} by ${form.values.channel}. You can cancel it while it is still queued.`}
          </span>
        </div>
      </div>
    </FormModal>
  );
}
