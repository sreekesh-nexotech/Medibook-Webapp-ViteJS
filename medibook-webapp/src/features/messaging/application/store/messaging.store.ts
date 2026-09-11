import { create } from 'zustand';

import { toast } from '@/shared/ui/toast/toast.store';

import { localDateIso, localTimeHm } from '@/features/audit/application/store/audit.clock';
import { recordAudit } from '@/features/audit/application/store/audit.store';

import { SEED_ANNOUNCEMENTS, SEED_OUTBOX, SEED_TEMPLATES } from './messaging.fixtures';
import type {
  Announcement,
  AnnouncementAudience,
  MessageChannel,
  MessageEvent,
  MessageTemplate,
  OutboxMessage,
} from './messaging.types';

/**
 * Patient-messaging store (audit HA-11 / HA-12): the template library, the
 * outbox the desk queues into, and the announcements the hospital publishes.
 *
 * ## Honesty (THE LAW)
 *
 * Nothing here talks to a gateway, so nothing here ever claims a message was
 * delivered. Queueing appends a real record with the status `Queued` and the
 * toast says queued; the hospital can see, and cancel, exactly what is
 * waiting. When the messaging API lands, only the status transitions change.
 */

/** Editable part of a template — the id, event and channel never change. */
export interface TemplatePatch {
  readonly subject: string;
  readonly body: string;
  readonly active: boolean;
}

/** What the desk queues for one appointment. */
export interface QueueMessageInput {
  readonly event: MessageEvent;
  readonly channel: MessageChannel;
  readonly recipient: string;
  readonly contact: string;
  readonly appointmentId: string;
  readonly bookingRef: string;
  /** The body with placeholders already resolved for this appointment. */
  readonly body: string;
}

/** What the composer publishes as an announcement. */
export interface AnnouncementInput {
  readonly title: string;
  readonly body: string;
  readonly audience: AnnouncementAudience;
  readonly audienceRef: string;
  readonly channel: MessageChannel;
  /** ISO `yyyy-mm-dd` to schedule for, or empty to queue now. */
  readonly scheduledFor: string;
  readonly reach: number;
}

interface MessagingState {
  templates: readonly MessageTemplate[];
  outbox: readonly OutboxMessage[];
  announcements: readonly Announcement[];
}

interface MessagingActions {
  /** Save an edited template body / subject / active flag. */
  saveTemplate: (id: string, patch: TemplatePatch) => void;
  /** Switch a channel on or off for one event. */
  toggleTemplate: (id: string) => void;
  /** Queue one message for an appointment — status `Queued`, never "sent". */
  queueMessage: (input: QueueMessageInput) => string;
  /** Cancel a queued message before the gateway picks it up. */
  cancelMessage: (id: string) => void;
  /** Queue or schedule an announcement. */
  publishAnnouncement: (input: AnnouncementInput) => string;
  /** Cancel a scheduled or queued announcement. */
  cancelAnnouncement: (id: string) => void;
}

export type MessagingStore = MessagingState & MessagingActions;

/** What the selectors below read — the store, or any snapshot of it. */
export interface MessagingSnapshot {
  readonly templates: readonly MessageTemplate[];
  readonly outbox: readonly OutboxMessage[];
  readonly announcements: readonly Announcement[];
}

/** `out-7` / `ann-4` — continues past whatever the seed already used. */
function mintId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export const useMessagingStore = create<MessagingStore>()((set, get) => ({
  templates: SEED_TEMPLATES,
  outbox: SEED_OUTBOX,
  announcements: SEED_ANNOUNCEMENTS,

  saveTemplate: (id, patch) => {
    const before = get().templates.find((t) => t.id === id);
    if (!before) return;
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, ...patch, updatedOn: localDateIso() } : t,
      ),
    }));
    recordAudit({
      action: 'Update',
      entity: 'Template',
      entityId: id,
      summary: `${before.event} ${before.channel} template edited`,
      before: before.body.slice(0, 80),
      after: patch.body.slice(0, 80),
      sev: 'Info',
    });
    toast(`${before.event} · ${before.channel} template saved`, 'success');
  },

  toggleTemplate: (id) => {
    const template = get().templates.find((t) => t.id === id);
    if (!template) return;
    const nowActive = !template.active;
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? { ...t, active: nowActive } : t)),
    }));
    recordAudit({
      action: 'Update',
      entity: 'Template',
      entityId: id,
      summary: `${template.event} on ${template.channel} ${nowActive ? 'switched on' : 'switched off'}`,
      before: template.active ? 'On' : 'Off',
      after: nowActive ? 'On' : 'Off',
      sev: 'Warning',
    });
  },

  queueMessage: (input) => {
    const id = mintId(
      'out-',
      get().outbox.map((m) => m.id),
    );
    const record: OutboxMessage = {
      id,
      date: localDateIso(),
      time: localTimeHm(),
      event: input.event,
      channel: input.channel,
      recipient: input.recipient,
      contact: input.contact,
      appointmentId: input.appointmentId,
      bookingRef: input.bookingRef,
      body: input.body,
      status: 'Queued',
    };
    set((s) => ({ outbox: [record, ...s.outbox] }));
    recordAudit({
      action: 'Create',
      entity: 'Announcement',
      entityId: id,
      summary: `${input.event} queued to ${input.recipient} by ${input.channel}`,
      before: null,
      after: `${input.channel} · ${input.contact} · ${input.appointmentId}`,
      sev: 'Info',
    });
    toast(`${input.event} queued for ${input.recipient} by ${input.channel}`, 'success');
    return id;
  },

  cancelMessage: (id) => {
    const message = get().outbox.find((m) => m.id === id);
    if (!message || message.status !== 'Queued') return;
    set((s) => ({
      outbox: s.outbox.map((m) => (m.id === id ? { ...m, status: 'Cancelled' } : m)),
    }));
    recordAudit({
      action: 'Cancel',
      entity: 'Announcement',
      entityId: id,
      summary: `Queued ${message.event.toLowerCase()} to ${message.recipient} cancelled`,
      before: 'Queued',
      after: 'Cancelled',
      sev: 'Warning',
    });
    toast('Queued message cancelled', 'info');
  },

  publishAnnouncement: (input) => {
    const id = mintId(
      'ann-',
      get().announcements.map((a) => a.id),
    );
    const scheduled = input.scheduledFor !== '';
    const record: Announcement = {
      id,
      title: input.title,
      body: input.body,
      audience: input.audience,
      audienceRef: input.audienceRef,
      channel: input.channel,
      status: scheduled ? 'Scheduled' : 'Queued',
      scheduledFor: input.scheduledFor,
      createdOn: localDateIso(),
      createdTime: localTimeHm(),
      reach: input.reach,
    };
    set((s) => ({ announcements: [record, ...s.announcements] }));
    recordAudit({
      action: 'Create',
      entity: 'Announcement',
      entityId: id,
      summary: scheduled
        ? `Announcement scheduled — ${input.title}`
        : `Announcement queued — ${input.title}`,
      before: null,
      after: `${input.audience}${input.audienceRef ? ` (${input.audienceRef})` : ''} · ${input.channel} · ~${input.reach} recipients`,
      sev: 'Warning',
    });
    toast(
      scheduled
        ? `Announcement scheduled for ${input.scheduledFor} — ~${input.reach} recipients`
        : `Announcement queued — ~${input.reach} recipients`,
      'success',
    );
    return id;
  },

  cancelAnnouncement: (id) => {
    const announcement = get().announcements.find((a) => a.id === id);
    if (!announcement || announcement.status === 'Cancelled') return;
    set((s) => ({
      announcements: s.announcements.map((a) => (a.id === id ? { ...a, status: 'Cancelled' } : a)),
    }));
    recordAudit({
      action: 'Cancel',
      entity: 'Announcement',
      entityId: id,
      summary: `Announcement cancelled — ${announcement.title}`,
      before: announcement.status,
      after: 'Cancelled',
      sev: 'Warning',
    });
    toast('Announcement cancelled — nothing will go out', 'info');
  },
}));

/* ------------------------------------------------------------- selectors */

export function selectTemplates(s: MessagingSnapshot): readonly MessageTemplate[] {
  return s.templates;
}

/** One template by event + channel, or null when the pair has none. */
export function selectTemplate(
  s: MessagingSnapshot,
  event: MessageEvent,
  channel: MessageChannel,
): MessageTemplate | null {
  return s.templates.find((t) => t.event === event && t.channel === channel) ?? null;
}

/** Channels an event is actually messaged on. */
export function selectActiveChannels(
  s: MessagingSnapshot,
  event: MessageEvent,
): readonly MessageChannel[] {
  return s.templates.filter((t) => t.event === event && t.active).map((t) => t.channel);
}

export function selectOutbox(s: MessagingSnapshot): readonly OutboxMessage[] {
  return s.outbox;
}

/** Messages still waiting — what a gateway would pick up next. */
export function selectQueuedCount(s: MessagingSnapshot): number {
  return s.outbox.filter((m) => m.status === 'Queued').length;
}

export function selectAnnouncements(s: MessagingSnapshot): readonly Announcement[] {
  return s.announcements;
}
