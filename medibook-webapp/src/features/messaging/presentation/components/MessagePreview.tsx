import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

import {
  channelCharLimit,
  smsSegments,
} from '@/features/messaging/application/store/messaging.logic';
import type { MessageChannel } from '@/features/messaging/application/store/messaging.types';

/** Glyph per channel, so a preview is recognisable at a glance. */
const CHANNEL_ICON: Readonly<Record<MessageChannel, IconName>> = {
  SMS: 'message-circle',
  Email: 'mail',
  Push: 'bell-ring',
  WhatsApp: 'message-circle',
};

interface MessagePreviewProps {
  channel: MessageChannel;
  /** Email subject; ignored on the other channels. */
  subject?: string;
  /** The body **after** placeholders were resolved. */
  rendered: string;
  /** Heading above the bubble. Default "Preview". */
  title?: string;
  /** Filled with sample values (the template library) rather than one patient's own. */
  isSample?: boolean;
}

/**
 * What the patient would actually see — with sample values in the template
 * library, with the appointment's own values before a send (UAT-65) — plus
 * the character and segment count, so a long SMS is visible. Hospitals are
 * never billed for messages (Q109), so nothing here talks about cost.
 */
export function MessagePreview({
  channel,
  subject,
  rendered,
  title = 'Preview',
  isSample = true,
}: MessagePreviewProps) {
  const limit = channelCharLimit(channel);
  const overLimit = limit != null && rendered.length > limit;
  const segments = smsSegments(rendered);

  return (
    <div className="border-border-soft bg-bg-subtle rounded-md border px-3.5 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon name={CHANNEL_ICON[channel]} size={15} className="text-text-muted" />
        <span className="text-caption text-text-muted">
          {title} · {channel}
          {isSample ? ' · sample values' : ''}
        </span>
      </div>
      <div className="border-border-soft rounded-md border bg-white px-3.5 py-3">
        {channel === 'Email' && subject && (
          <div className="border-border-soft text-body text-text-strong mb-2 border-b pb-2 font-medium">
            {subject}
          </div>
        )}
        <p className="text-body text-text-body m-0 whitespace-pre-wrap">
          {rendered || 'Nothing to preview yet.'}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span
          className={cn('text-caption', overLimit ? 'text-y-800 font-medium' : 'text-text-muted')}
        >
          {rendered.length} characters
          {limit != null && ` / ${limit} per ${channel === 'SMS' ? 'segment' : 'notification'}`}
        </span>
        {channel === 'SMS' && (
          <span className="text-caption text-text-muted">
            {segments} SMS {segments === 1 ? 'segment' : 'segments'}
          </span>
        )}
        {overLimit && channel === 'Push' && (
          <span className="text-caption text-y-800">
            Longer than {limit} characters — phones will clip the end.
          </span>
        )}
      </div>
    </div>
  );
}
