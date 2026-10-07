/**
 * Platform message templates (Q112): one wording per event × channel ×
 * locale, used for every hospital — hospitals have no wording of their own.
 * `{{name}}` placeholders are filled from the event when a message is sent.
 */

export const MESSAGE_CHANNELS = ['sms', 'whatsapp', 'push', 'email'] as const;

export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

/** The locale every lookup falls back to. */
export const DEFAULT_LOCALE = 'en-IN';

export interface MessageTemplate {
  readonly id: string;
  /** e.g. `appointment.confirmed`; fixed once created. */
  readonly eventCode: string;
  /** Fixed once created. */
  readonly channel: MessageChannel;
  /** Fixed once created. */
  readonly locale: string;
  /** Email subject or push title; unused for SMS and WhatsApp. */
  readonly subject: string | null;
  readonly body: string;
  /** The approved WhatsApp template the body maps to (WhatsApp only). */
  readonly whatsappTemplateName: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** `If-Match` token. */
  readonly version: number;
}

/** What the editor sends. Event, channel and locale are read only when creating. */
export interface MessageTemplateDraft {
  readonly eventCode: string;
  readonly channel: MessageChannel;
  readonly locale: string;
  readonly subject: string | null;
  readonly body: string;
  readonly whatsappTemplateName: string | null;
  readonly isActive: boolean;
}
