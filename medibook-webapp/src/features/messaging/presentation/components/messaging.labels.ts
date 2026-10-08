/**
 * Display helpers for the live messaging API: event and status labels, the
 * channel names the existing preview component speaks, and the placeholder
 * samples the read-only template preview renders with. Pure functions only.
 */
import { fmtDate, toLocalISO } from '@/shared/lib/format';
import { safeTimeZone } from '@/shared/lib/hospitalTime';

import {
  PLACEHOLDERS,
  type PlaceholderDef,
} from '@/features/messaging/application/store/messaging.logic';
import type { MessageChannel } from '@/features/messaging/application/store/messaging.types';
import type {
  DeliveryStatus,
  ManualEventCode,
  MessagingChannel,
  PatientChannel,
  RecipientSource,
} from '@/features/messaging/domain/entities/messaging.entities';
import type {
  AppointmentStatus,
  PatientAppointment,
} from '@/features/patients/domain/entities/patients.entities';

/** Patient-facing events, in the order the template library lists them. */
export const PATIENT_TEMPLATE_EVENTS = [
  'appointment.confirmed',
  'appointment.approved',
  'appointment.reminder',
  'appointment.rejected',
  'appointment.cancelled',
  'appointment.no_show',
  'token.called',
  'payment.captured',
  'refund.processed',
  'patient.auto_linked',
] as const;

const EVENT_LABELS: Readonly<Record<string, string>> = {
  'appointment.confirmed': 'Booking confirmation',
  'appointment.approved': 'Booking approved',
  'appointment.reminder': 'Reminder',
  'appointment.rejected': 'Booking declined',
  'appointment.cancelled': 'Cancellation',
  'appointment.no_show': 'Missed appointment',
  'token.called': 'Token called',
  'payment.captured': 'Payment received',
  'refund.processed': 'Refund',
  'patient.auto_linked': 'Record linked',
};

/** "Reminder" for `appointment.reminder`; an unmapped code reads as itself. */
export function eventLabel(code: string): string {
  return EVENT_LABELS[code] ?? code;
}

/** The two events the desk triggers by hand (audit HA-12). */
export const DESK_SEND_EVENTS: readonly ManualEventCode[] = [
  'appointment.confirmed',
  'appointment.reminder',
];

const CHANNEL_LABELS: Readonly<Record<MessagingChannel, MessageChannel>> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'Email',
  push: 'Push',
};

export function channelLabel(channel: MessagingChannel): MessageChannel {
  return CHANNEL_LABELS[channel];
}

/** Patient channel by its display name, or `null` for anything else. */
export function patientChannelFromLabel(label: string): PatientChannel | null {
  if (label === 'SMS') return 'sms';
  if (label === 'WhatsApp') return 'whatsapp';
  if (label === 'Push') return 'push';
  return null;
}

const STATUS_LABELS: Readonly<Record<DeliveryStatus, string>> = {
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed',
  bounced: 'Bounced',
  suppressed: 'Suppressed',
  cancelled: 'Cancelled',
};

export function deliveryStatusLabel(status: DeliveryStatus): string {
  return STATUS_LABELS[status];
}

/**
 * The badge palette per delivery status (UAT-65, 05 F26): waiting states
 * blue/amber, delivered green, every way of not arriving red or grey — so a
 * bounced or failed message never looks queued.
 */
const STATUS_BADGES: Readonly<Record<DeliveryStatus, string>> = {
  queued: 'Queued',
  sending: 'Pending',
  sent: 'Sent',
  delivered: 'Completed',
  failed: 'Failed',
  bounced: 'Failed',
  suppressed: 'Inactive',
  cancelled: 'Cancelled',
};

export function deliveryStatusBadge(status: DeliveryStatus): {
  readonly status: string;
  readonly label: string;
} {
  return { status: STATUS_BADGES[status], label: STATUS_LABELS[status] };
}

/** What a delivery's error code means to the desk (backend B7). */
const ERROR_CODE_TEXT: Readonly<Record<string, string>> = {
  OUTCOME_UNKNOWN: 'The provider did not confirm it; it is not sent again automatically.',
  PROVIDER_UNAVAILABLE: 'The provider was unavailable; it will be retried.',
  NO_RECIPIENT: 'The patient has no address on this channel.',
  EMAIL_STAFF_ONLY: 'Patients are never emailed.',
  UNKNOWN_CHANNEL: 'This channel is not available.',
};

/** A readable reason for an error code, or `null` when there is none to give. */
export function deliveryErrorText(code: string | null): string | null {
  return code ? (ERROR_CODE_TEXT[code] ?? null) : null;
}

const RECIPIENT_SOURCE_TEXT: Readonly<Record<RecipientSource, string>> = {
  account: 'The phone on the booking’s Medibook account',
  hospital_record: 'The phone on the hospital’s patient record',
  devices: 'The patient’s Medibook app',
  staff: 'A staff email address',
};

export function recipientSourceText(source: RecipientSource | null): string | null {
  return source ? RECIPIENT_SOURCE_TEXT[source] : null;
}

/** Tokens the platform templates use beyond the desk's six. */
const PLATFORM_PLACEHOLDERS: readonly PlaceholderDef[] = [
  {
    token: '{{hospitalName}}',
    label: 'Your hospital, as patients see it',
    sample: 'Apollo Hospital',
  },
  { token: '{{name}}', label: "The recipient's first name", sample: 'Ellen' },
  { token: '{{amount}}', label: 'Amount paid or refunded', sample: 'Rs 500.00' },
  { token: '{{link}}', label: 'A link into the Medibook app', sample: 'https://medibook.app/a/X1' },
  { token: '{{minutes}}', label: 'Minutes until the turn', sample: '10' },
  { token: '{{rebookText}}', label: 'How to rebook, when offered', sample: 'Rebook from the app.' },
];

/** The full vocabulary the platform templates draw on. */
export const MESSAGING_PLACEHOLDERS: readonly PlaceholderDef[] = [
  ...PLACEHOLDERS,
  ...PLATFORM_PLACEHOLDERS,
];

/** Sample values for every token, for the template preview. */
export function messagingSampleValues(): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of MESSAGING_PLACEHOLDERS) out[p.token] = p.sample;
  return out;
}

/**
 * An appointment time as the server writes it into a message: in the
 * hospital's zone (`messaging/services/context.py`, D-09) and as
 * `strftime("%I:%M %p")`, e.g. "10:30 AM", so the preview matches the SMS.
 */
export function templateTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: safeTimeZone(timeZone),
  });
}

/** Appointments still worth confirming or reminding about. */
const MESSAGEABLE_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  'pending_approval',
  'scheduled',
  'checked_in',
]);

/**
 * The patient's appointments a desk message can be about: still active and
 * on or after `today` — the hospital's calendar day (D-09, UAT-47) — soonest
 * first.
 */
export function messageableAppointments(
  items: readonly PatientAppointment[],
  today: string,
): readonly PatientAppointment[] {
  return items
    .filter((a) => MESSAGEABLE_STATUSES.has(a.status) && a.scheduledDate >= today)
    .toSorted((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));
}

/** Local wall-clock time of an ISO date-time, e.g. "10:30 am". */
export function fmtLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** "20 Jun 2026 · 10:30 am" in the viewer's local time. */
export function fmtLocalDateTime(iso: string): string {
  return `${fmtDate(toLocalISO(new Date(iso)))} · ${fmtLocalTime(iso)}`;
}
