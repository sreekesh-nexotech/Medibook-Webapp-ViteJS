/**
 * Patient-messaging view-model types — audit HA-11 / HA-12 (§2.4): "The
 * hospital cannot trigger a confirmation or reminder, and cannot publish an
 * announcement. Message templates have no screen."
 *
 * Three records: the **templates** (per event × channel), the **outbox** of
 * messages the desk has queued for a specific appointment, and the
 * **announcements** the hospital publishes to a whole audience.
 *
 * Nothing in the demo actually sends, so every queued record carries the
 * status `Queued` and the copy says queued — never "sent" (THE LAW).
 */

/** The five lifecycle events a patient hears about. */
export const MESSAGE_EVENTS = [
  'Booking confirmation',
  'Reminder',
  'Reschedule notice',
  'Cancellation',
  'Refund',
] as const;

export type MessageEvent = (typeof MESSAGE_EVENTS)[number];

/** The four channels a message can go out on. */
export const MESSAGE_CHANNELS = ['SMS', 'Email', 'Push', 'WhatsApp'] as const;

export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

/** One editable message body for an event on a channel. */
export interface MessageTemplate {
  /** `<event-slug>-<channel-slug>`, e.g. `reminder-sms`. */
  readonly id: string;
  readonly event: MessageEvent;
  readonly channel: MessageChannel;
  /** Email subject line; empty for the other channels. */
  readonly subject: string;
  /** The body, with `{{placeholder}}` tokens. */
  readonly body: string;
  /** Off means this event is not messaged on this channel at all. */
  readonly active: boolean;
  /** ISO `yyyy-mm-dd` the body was last edited. */
  readonly updatedOn: string;
}

/** A queued message never claims to have been delivered. */
export type OutboxStatus = 'Queued' | 'Cancelled';

/** One message the desk queued for a specific appointment. */
export interface OutboxMessage {
  readonly id: string;
  /** Local calendar date it was queued, `yyyy-mm-dd`. */
  readonly date: string;
  /** Local wall-clock time it was queued, `HH:MM`. */
  readonly time: string;
  readonly event: MessageEvent;
  readonly channel: MessageChannel;
  readonly recipient: string;
  /** Phone number or email address the channel would use. */
  readonly contact: string;
  readonly appointmentId: string;
  readonly bookingRef: string;
  /** The body after placeholders were filled in — what would go out. */
  readonly body: string;
  readonly status: OutboxStatus;
}

/**
 * One appointment the desk may message, flattened to exactly what a template
 * needs: the recipient, the contact the channel would use, and the values the
 * placeholders resolve to.
 */
export interface SendTarget {
  readonly appointmentId: string;
  readonly patientName: string;
  readonly phone: string;
  readonly email: string;
  readonly doctorName: string;
  readonly dept: string;
  /** Display date, e.g. "20 Jun 2026" — already formatted for the message. */
  readonly date: string;
  readonly time: string;
  /** Queue token, or an em dash when none has been issued. */
  readonly token: string;
  readonly bookingRef: string;
}

/** Who an announcement reaches. */
export const ANNOUNCEMENT_AUDIENCES = [
  'All patients',
  "A department's patients",
  "A date's appointments",
] as const;

export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export type AnnouncementStatus = 'Queued' | 'Scheduled' | 'Cancelled';

/** A hospital-wide notice published to patients. */
export interface Announcement {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly audience: AnnouncementAudience;
  /** Department name, or ISO date, depending on `audience`; else empty. */
  readonly audienceRef: string;
  readonly channel: MessageChannel;
  readonly status: AnnouncementStatus;
  /** ISO `yyyy-mm-dd` it is scheduled for; empty when queued immediately. */
  readonly scheduledFor: string;
  readonly createdOn: string;
  readonly createdTime: string;
  /** Recipients the audience resolves to at the time of composing. */
  readonly reach: number;
}
