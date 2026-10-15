/**
 * Patient messaging as the hospital API serves it (`/hospital/messaging/*`,
 * HA-11 / HA-12). Templates are the platform's and read-only (Q112); the
 * outbox is the delivery history; a staff send queues deliveries for one
 * appointment. The rendered body is never stored server-side (PII).
 */

/** Every channel a delivery or template can be on. */
export type MessagingChannel = 'sms' | 'whatsapp' | 'email' | 'push';

/** Channels a patient can be messaged on — patients never receive email. */
export const PATIENT_CHANNELS = ['sms', 'whatsapp', 'push'] as const;

export type PatientChannel = (typeof PATIENT_CHANNELS)[number];

/** Events staff may trigger by hand for an appointment (`rules.MANUAL_EVENT_CODES`). */
export const MANUAL_EVENT_CODES = [
  'appointment.confirmed',
  'appointment.approved',
  'appointment.rejected',
  'appointment.cancelled',
  'appointment.no_show',
  'appointment.reminder',
] as const;

export type ManualEventCode = (typeof MANUAL_EVENT_CODES)[number];

/** One platform template for an event on a channel. */
export interface MessagingTemplate {
  readonly id: string;
  /** Backend event code, e.g. `appointment.reminder`. */
  readonly eventCode: string;
  readonly channel: MessagingChannel;
  readonly locale: string;
  readonly subject: string | null;
  /** The body, with `{{placeholder}}` tokens. */
  readonly body: string;
  readonly version: number;
  /** ISO date-time of the last platform edit. */
  readonly updatedAt: string;
}

export const DELIVERY_STATUSES = [
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'bounced',
  'suppressed',
  'cancelled',
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/**
 * Where the address came from (backend B7): the booking account's phone (every
 * app booking, dependants included), the hospital record's phone (a walk-in
 * without an app account), the account's devices (push) or a staff email.
 */
export type RecipientSource = 'account' | 'hospital_record' | 'devices' | 'staff';

/** One outbox row — a message to one recipient on one channel. */
export interface MessageDelivery {
  readonly id: string;
  readonly channel: MessagingChannel;
  readonly eventCode: string;
  /** Phone number, email address or device the channel actually used. */
  readonly recipientAddress: string;
  /** `null` on an older backend. */
  readonly recipientSource: RecipientSource | null;
  readonly status: DeliveryStatus;
  readonly renderedSubject: string | null;
  /** ISO date-time it was queued. */
  readonly queuedAt: string;
  readonly sentAt: string | null;
  readonly deliveredAt: string | null;
  readonly failedAt: string | null;
  /** Provider's reason for a failure, when one was given. */
  readonly errorMessage: string | null;
  /** Machine code for a failure or a hold (`OUTCOME_UNKNOWN`, `NO_RECIPIENT`, …). */
  readonly errorCode: string | null;
  /** `staff` for a desk send, otherwise the automatic trigger. */
  readonly triggeredByKind: string | null;
  /** Held back (quiet hours or a retry backoff) until then; `null` otherwise. */
  readonly deferredUntil: string | null;
  readonly provider: string | null;
  readonly providerMessageId: string | null;
  readonly attempts: number | null;
}

export type DeliverySortField = 'queued_at' | 'sent_at';

export type DeliverySortDirection = 'asc' | 'desc';

/** Server-side filters for the outbox. */
export interface DeliveryFilters {
  readonly status: DeliveryStatus | null;
  readonly channel: MessagingChannel | null;
  /** Hospital-local `yyyy-mm-dd` the message was queued, inclusive; blank = no bound. */
  readonly dateFrom: string;
  readonly dateTo: string;
  /** Exact phone (10 digits are tried as +91), provider message id or event code. */
  readonly q: string;
}

/** One outbox page request. */
export interface DeliveryListParams extends DeliveryFilters {
  /** One-based. */
  readonly page: number;
  readonly pageSize: number;
  readonly sortField: DeliverySortField;
  readonly sortDirection: DeliverySortDirection;
}

/** A staff-triggered send for one appointment. */
export interface MessageSendInput {
  readonly appointmentId: string;
  readonly eventCode: ManualEventCode;
  readonly channels: readonly PatientChannel[];
  /** Replay key, minted once per user intent so a retry is not sent twice. */
  readonly idempotencyKey: string;
}
