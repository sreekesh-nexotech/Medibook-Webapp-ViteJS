/**
 * Display helpers for the live messaging API: event and status labels, the
 * channel names the existing preview component speaks, and the placeholder
 * samples the read-only template preview renders with. Pure functions only.
 */
import { fmtDate, formatInstant, toLocalISO } from '@/shared/lib/format';

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
} from '@/features/messaging/domain/entities/messaging.entities';

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

/** Tokens the platform templates use beyond the desk's six. */
const PLATFORM_PLACEHOLDERS: readonly PlaceholderDef[] = [
  {
    token: '{{hospitalName}}',
    label: 'Your hospital, as patients see it',
    sample: 'Example Hospital',
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

/** Wall-clock time of an ISO date-time on the hospital's clock, e.g. "10:30 am". */
export function fmtLocalTime(iso: string): string {
  return formatInstant(iso, { hour: 'numeric', minute: '2-digit' });
}

/** "20 Jun 2026 · 10:30 am" in the viewer's local time. */
export function fmtLocalDateTime(iso: string): string {
  return `${fmtDate(toLocalISO(new Date(iso)))} · ${fmtLocalTime(iso)}`;
}
