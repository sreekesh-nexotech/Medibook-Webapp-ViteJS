/**
 * Seed message templates (five events × four channels), a small outbox and
 * three announcements — one queued, one scheduled, one cancelled — so every
 * status is visible on first load.
 *
 * Bodies use only the documented placeholder vocabulary from
 * `messaging.logic.ts`.
 */

import { DEMO_TODAY_ISO } from '@/core/config/demo';

import { shiftIsoDays } from '@/features/audit/application/store/audit.clock';

import { templateId } from './messaging.logic';
import {
  MESSAGE_CHANNELS,
  MESSAGE_EVENTS,
  type Announcement,
  type MessageChannel,
  type MessageEvent,
  type MessageTemplate,
  type OutboxMessage,
} from './messaging.types';

/** Per-event copy: the email subject plus one body per channel. */
interface EventCopy {
  readonly subject: string;
  readonly bodies: Readonly<Record<MessageChannel, string>>;
}

const HOSPITAL = 'Apollo Hospital';

const EVENT_COPY: Readonly<Record<MessageEvent, EventCopy>> = {
  'Booking confirmation': {
    subject: `Your ${HOSPITAL} appointment is confirmed — {{date}}`,
    bodies: {
      SMS: `Hi {{patientName}}, your appointment with {{doctorName}} on {{date}} at {{time}} is confirmed. Token {{token}}. Ref {{bookingRef}}. — ${HOSPITAL}`,
      Email: `Dear {{patientName}},\n\nYour appointment with {{doctorName}} is confirmed for {{date}} at {{time}}.\n\nToken: {{token}}\nBooking reference: {{bookingRef}}\n\nPlease arrive 10 minutes early and carry a photo ID. You can reschedule or cancel from the Medibook app.\n\n— ${HOSPITAL}`,
      Push: `Appointment confirmed: {{doctorName}}, {{date}} at {{time}}. Token {{token}}.`,
      WhatsApp: `Hello {{patientName}} 👋\nYour appointment with {{doctorName}} is confirmed.\n*Date:* {{date}}\n*Time:* {{time}}\n*Token:* {{token}}\n*Ref:* {{bookingRef}}`,
    },
  },
  Reminder: {
    subject: `Reminder: your visit is on {{date}}`,
    bodies: {
      SMS: `Hi {{patientName}}, reminder: {{doctorName}} on {{date}} at {{time}}. Token {{token}}. Reply or call us to reschedule. — ${HOSPITAL}`,
      Email: `Dear {{patientName}},\n\nThis is a reminder of your appointment with {{doctorName}} on {{date}} at {{time}}. Your token is {{token}}.\n\nIf you cannot attend, please cancel from the Medibook app so the slot can be offered to someone else.\n\n— ${HOSPITAL}`,
      Push: `Tomorrow: {{doctorName}} at {{time}}. Token {{token}}.`,
      WhatsApp: `Reminder for {{patientName}}: {{doctorName}} on {{date}} at {{time}} (token {{token}}).`,
    },
  },
  'Reschedule notice': {
    subject: `Your appointment has moved to {{date}}`,
    bodies: {
      SMS: `Hi {{patientName}}, your appointment with {{doctorName}} has moved to {{date}} at {{time}}. Ref {{bookingRef}}. — ${HOSPITAL}`,
      Email: `Dear {{patientName}},\n\nYour appointment with {{doctorName}} has been rescheduled to {{date}} at {{time}}.\n\nBooking reference: {{bookingRef}}\n\nNo payment is needed again — your existing payment carries over.\n\n— ${HOSPITAL}`,
      Push: `Rescheduled: {{doctorName}} now on {{date}} at {{time}}.`,
      WhatsApp: `Hello {{patientName}}, your visit to {{doctorName}} is now on {{date}} at {{time}}. Ref {{bookingRef}}.`,
    },
  },
  Cancellation: {
    subject: `Your appointment on {{date}} was cancelled`,
    bodies: {
      SMS: `Hi {{patientName}}, your appointment with {{doctorName}} on {{date}} at {{time}} is cancelled. Ref {{bookingRef}}. — ${HOSPITAL}`,
      Email: `Dear {{patientName}},\n\nYour appointment with {{doctorName}} on {{date}} at {{time}} has been cancelled.\n\nBooking reference: {{bookingRef}}\n\nIf a refund applies it will be processed by Medibook to the original payment method.\n\n— ${HOSPITAL}`,
      Push: `Cancelled: {{doctorName}}, {{date}} at {{time}}.`,
      WhatsApp: `Hello {{patientName}}, your appointment with {{doctorName}} on {{date}} is cancelled. Ref {{bookingRef}}.`,
    },
  },
  Refund: {
    subject: `Refund for booking {{bookingRef}}`,
    bodies: {
      SMS: `Hi {{patientName}}, the refund for booking {{bookingRef}} has been initiated and reaches your account in 5-7 working days. — ${HOSPITAL}`,
      Email: `Dear {{patientName}},\n\nThe refund for booking {{bookingRef}} ({{doctorName}}, {{date}}) has been initiated by Medibook.\n\nIt is credited to the original payment method within 5-7 working days.\n\n— ${HOSPITAL}`,
      Push: `Refund initiated for {{bookingRef}}.`,
      WhatsApp: `Hello {{patientName}}, the refund for {{bookingRef}} is on its way — 5-7 working days.`,
    },
  },
};

/** Which channels a hospital usually has switched on per event. */
const INACTIVE_BY_DEFAULT: readonly string[] = [
  templateId('Reschedule notice', 'WhatsApp'),
  templateId('Refund', 'Push'),
  templateId('Refund', 'WhatsApp'),
];

export const SEED_TEMPLATES: readonly MessageTemplate[] = MESSAGE_EVENTS.flatMap((event) =>
  MESSAGE_CHANNELS.map((channel) => {
    const id = templateId(event, channel);
    return {
      id,
      event,
      channel,
      subject: channel === 'Email' ? EVENT_COPY[event].subject : '',
      body: EVENT_COPY[event].bodies[channel],
      active: !INACTIVE_BY_DEFAULT.includes(id),
      updatedOn: shiftIsoDays(DEMO_TODAY_ISO, -12),
    };
  }),
);

export const SEED_OUTBOX: readonly OutboxMessage[] = [
  {
    id: 'out-3',
    date: DEMO_TODAY_ISO,
    time: '09:22',
    event: 'Booking confirmation',
    channel: 'SMS',
    recipient: 'Ellen Kinderson',
    contact: '9876543210',
    appointmentId: 'AP1000',
    bookingRef: 'MB-2026-000120',
    body: 'Hi Ellen Kinderson, your appointment with Dr. Thomas Kurian on 13 Jun 2026 at 8:30 am is confirmed. Token T-001. Ref MB-2026-000120. — Apollo Hospital',
    status: 'Queued',
  },
  {
    id: 'out-2',
    date: DEMO_TODAY_ISO,
    time: '09:05',
    event: 'Reminder',
    channel: 'WhatsApp',
    recipient: 'Maya Rao',
    contact: '9876543212',
    appointmentId: 'AP1002',
    bookingRef: 'MB-2026-000121',
    body: 'Reminder for Maya Rao: Dr. Kumar Venkat on 13 Jun 2026 at 9:15 am (token T-002).',
    status: 'Queued',
  },
  {
    id: 'out-1',
    date: shiftIsoDays(DEMO_TODAY_ISO, -1),
    time: '16:48',
    event: 'Cancellation',
    channel: 'SMS',
    recipient: 'John Miller',
    contact: '9876543211',
    appointmentId: 'AP1007',
    bookingRef: 'MB-2026-000118',
    body: 'Hi John Miller, your appointment with Dr. Thomas Kurian on 12 Jun 2026 at 9:00 am is cancelled. Ref MB-2026-000118. — Apollo Hospital',
    status: 'Cancelled',
  },
];

export const SEED_ANNOUNCEMENTS: readonly Announcement[] = [
  {
    id: 'ann-3',
    title: 'OPD closed on Bakrid',
    body: 'The hospital OPD and online booking will be closed on 17 June for Bakrid. Emergency care runs as usual.',
    audience: 'All patients',
    audienceRef: '',
    channel: 'SMS',
    status: 'Scheduled',
    scheduledFor: shiftIsoDays(DEMO_TODAY_ISO, 3),
    createdOn: shiftIsoDays(DEMO_TODAY_ISO, -1),
    createdTime: '11:30',
    reach: 1240,
  },
  {
    id: 'ann-2',
    title: 'Cardiology consultants at a conference',
    body: 'Cardiology consultations are unavailable on 3 and 4 July. Existing appointments will be rescheduled and patients contacted individually.',
    audience: "A department's patients",
    audienceRef: 'Cardiology',
    channel: 'Email',
    status: 'Queued',
    scheduledFor: '',
    createdOn: shiftIsoDays(DEMO_TODAY_ISO, -2),
    createdTime: '15:10',
    reach: 312,
  },
  {
    id: 'ann-1',
    title: 'Parking closed at the main gate',
    body: 'Visitor parking at the main gate is closed for resurfacing. Please use the Bannerghatta Road entrance.',
    audience: "A date's appointments",
    audienceRef: shiftIsoDays(DEMO_TODAY_ISO, -4),
    channel: 'Push',
    status: 'Cancelled',
    scheduledFor: shiftIsoDays(DEMO_TODAY_ISO, -4),
    createdOn: shiftIsoDays(DEMO_TODAY_ISO, -6),
    createdTime: '09:40',
    reach: 68,
  },
];
