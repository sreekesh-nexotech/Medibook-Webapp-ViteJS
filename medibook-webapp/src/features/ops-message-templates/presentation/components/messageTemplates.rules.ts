/**
 * Message template rules: labels, the checks a template must pass before it
 * is sent, and the hints that keep wording consistent across channels.
 * Pure functions.
 */
import type {
  MessageChannel,
  MessageTemplate,
  MessageTemplateDraft,
} from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';
import {
  DEFAULT_LOCALE,
  MESSAGE_CHANNELS,
} from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';

export const CHANNEL_LABEL: Readonly<Record<MessageChannel, string>> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  push: 'Push notification',
  email: 'Email',
};

/** What the subject field means on each channel; `null` = not used. */
export const SUBJECT_LABEL: Readonly<Record<MessageChannel, string | null>> = {
  sms: null,
  whatsapp: null,
  push: 'Notification title',
  email: 'Email subject',
};

/** Same pattern as the backend renderer (`messaging/services/templates.py`). */
const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
const EVENT_CODE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const LOCALE = /^[a-z]{2,3}(-[A-Z]{2})?$/;

/** One SMS holds 160 GSM characters; longer texts go in 153-character parts. */
const SMS_SINGLE = 160;
const SMS_PART = 153;

export type TemplateErrors = Partial<Record<keyof MessageTemplateDraft, string>>;

/** Placeholder names in a text, in order of first use. */
export function placeholdersIn(text: string | null): readonly string[] {
  if (!text) return [];
  return [...new Set(Array.from(text.matchAll(PLACEHOLDER), (m) => m[1] ?? ''))];
}

/** Placeholders this event's other templates use — what the event is known to fill in. */
export function eventPlaceholders(
  templates: readonly MessageTemplate[],
  eventCode: string,
  excludeId: string | null,
): readonly string[] {
  const names = templates
    .filter((t) => t.eventCode === eventCode && t.id !== excludeId)
    .flatMap((t) => [...placeholdersIn(t.subject), ...placeholdersIn(t.body)]);
  return [...new Set(names)].sort();
}

/** Event codes in use, for suggestions. */
export function knownEvents(templates: readonly MessageTemplate[]): readonly string[] {
  return [...new Set(templates.map((t) => t.eventCode))].sort();
}

/** The other live template an active draft would clash with (one per event × channel × locale). */
function activeTwin(
  draft: MessageTemplateDraft,
  templates: readonly MessageTemplate[],
  editingId: string | null,
): MessageTemplate | undefined {
  if (!draft.isActive) return undefined;
  return templates.find(
    (t) =>
      t.id !== editingId &&
      t.isActive &&
      t.eventCode === draft.eventCode.trim() &&
      t.channel === draft.channel &&
      t.locale === draft.locale.trim(),
  );
}

export function templateErrors(
  draft: MessageTemplateDraft,
  templates: readonly MessageTemplate[],
  editingId: string | null,
): TemplateErrors {
  const e: TemplateErrors = {};
  if (!EVENT_CODE.test(draft.eventCode.trim())) {
    e.eventCode = 'Use the event’s code, e.g. appointment.confirmed.';
  }
  if (!LOCALE.test(draft.locale.trim())) e.locale = 'Use a locale code, e.g. en-IN or hi-IN.';
  if (draft.body.trim() === '') e.body = 'Write the message.';
  if (draft.channel === 'email' && (draft.subject ?? '').trim() === '') {
    e.subject = 'An email needs a subject.';
  }
  if (draft.channel === 'whatsapp' && (draft.whatsappTemplateName ?? '').trim() === '') {
    e.whatsappTemplateName = 'Enter the approved WhatsApp template’s name.';
  }
  if (activeTwin(draft, templates, editingId)) {
    e.isActive =
      'An active template already exists for this event, channel and locale. Switch that one off first, or save this one switched off.';
  }
  return e;
}

export function hasTemplateErrors(e: TemplateErrors): boolean {
  return Object.values(e).some(Boolean);
}

/** Non-blocking advice for the editor. */
export function templateNotes(
  draft: MessageTemplateDraft,
  templates: readonly MessageTemplate[],
  editingId: string | null,
): readonly string[] {
  const notes: string[] = [];
  const event = draft.eventCode.trim();
  const events = knownEvents(templates.filter((t) => t.id !== editingId));
  if (EVENT_CODE.test(event) && !events.includes(event)) {
    notes.push(
      'No other template uses this event code. Check it matches an event Medibook sends, or the template is never used.',
    );
  }
  const known = eventPlaceholders(templates, event, editingId);
  const unknown = [...placeholdersIn(draft.subject), ...placeholdersIn(draft.body)].filter(
    (p) => known.length > 0 && !known.includes(p),
  );
  if (unknown.length > 0) {
    notes.push(
      `${unknown.map((p) => `{{${p}}}`).join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not used by this event’s other templates and may print empty.`,
    );
  }
  if (draft.channel === 'email') {
    notes.push(
      'Email reaches staff only (invites, password resets, tickets, statements, invoices, reports). Patient events use SMS, WhatsApp or push.',
    );
  }
  if (draft.channel === 'sms') {
    const parts = smsParts(draft.body);
    if (parts > 1) {
      notes.push(
        `About ${parts} SMS parts before placeholders are filled in — keep it under ${SMS_SINGLE} characters where you can.`,
      );
    }
  }
  return notes;
}

/** How many SMS parts a text needs (placeholders counted as typed). */
export function smsParts(body: string): number {
  const n = body.length;
  return n <= SMS_SINGLE ? 1 : Math.ceil(n / SMS_PART);
}

export type TemplateStatusFilter = 'all' | 'active' | 'inactive';

export interface TemplateFilter {
  readonly q: string;
  readonly channel: MessageChannel | null;
  readonly status: TemplateStatusFilter;
}

/** Event code / wording search, channel and on/off, in event → channel → locale order. */
export function filterTemplates(
  templates: readonly MessageTemplate[],
  filter: TemplateFilter,
): readonly MessageTemplate[] {
  const q = filter.q.trim().toLowerCase();
  return templates
    .filter((t) => filter.channel === null || t.channel === filter.channel)
    .filter((t) =>
      filter.status === 'all' ? true : filter.status === 'active' ? t.isActive : !t.isActive,
    )
    .filter(
      (t) =>
        q === '' ||
        t.eventCode.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        (t.subject ?? '').toLowerCase().includes(q),
    )
    .sort(
      (a, b) =>
        a.eventCode.localeCompare(b.eventCode) ||
        MESSAGE_CHANNELS.indexOf(a.channel) - MESSAGE_CHANNELS.indexOf(b.channel) ||
        a.locale.localeCompare(b.locale),
    );
}

/**
 * What removing a template does to messages being sent: lookups go
 * locale → en-IN, and an event with no active template on a channel is not
 * sent there.
 */
export function removalEffect(
  template: MessageTemplate,
  templates: readonly MessageTemplate[],
): string {
  const channel = CHANNEL_LABEL[template.channel];
  if (!template.isActive) return 'It is already off, so messages being sent do not change.';
  if (template.locale !== DEFAULT_LOCALE) {
    const fallback = templates.some(
      (t) =>
        t.isActive &&
        t.eventCode === template.eventCode &&
        t.channel === template.channel &&
        t.locale === DEFAULT_LOCALE,
    );
    return fallback
      ? `${template.locale} messages fall back to the ${DEFAULT_LOCALE} wording.`
      : `No active ${DEFAULT_LOCALE} template covers it, so this message stops going out by ${channel} in ${template.locale}.`;
  }
  return `This message stops going out by ${channel}, except in locales with their own active template.`;
}
