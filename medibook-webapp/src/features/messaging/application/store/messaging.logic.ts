/**
 * Pure messaging rules: the placeholder vocabulary, template rendering, the
 * SMS segment count. No React, no store — the editor, the
 * live preview and the outbox all render a body the same way.
 */

import type { MessageChannel } from './messaging.types';

/** One `{{token}}` a template may use, with the sample the preview shows. */
export interface PlaceholderDef {
  readonly token: string;
  readonly label: string;
  readonly sample: string;
}

/**
 * The documented placeholder vocabulary. A template may only use these — the
 * editor flags anything else, because an unknown token would reach the patient
 * as literal `{{...}}` text.
 *
 * Samples follow `CANONICAL_MASTER_DATA` (§2 doctors, §5 token, §6 booking
 * reference), so the preview reads like a real message.
 */
export const PLACEHOLDERS: readonly PlaceholderDef[] = [
  { token: '{{patientName}}', label: "The patient's full name", sample: 'Ellen Kinderson' },
  { token: '{{doctorName}}', label: 'The consulting doctor', sample: 'Dr. Anya Sharma' },
  { token: '{{date}}', label: 'Appointment date', sample: '20 Jun 2026' },
  { token: '{{time}}', label: 'Appointment slot time', sample: '10:30 am' },
  { token: '{{token}}', label: 'Queue token for the day', sample: 'T-008' },
  { token: '{{bookingRef}}', label: 'Permanent booking reference', sample: 'MB-2026-000124' },
];

/** One SMS segment; longer bodies are billed as multiple segments. */
export const SMS_SEGMENT_CHARS = 160;

/** Push notification bodies are clipped by the OS beyond roughly this. */
export const PUSH_BODY_CHARS = 120;

/** Matches every `{{token}}` in a body, valid or not. */
const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Replace every known `{{token}}` with its value. Unknown tokens are left in
 * place on purpose, so the editor's warning and the preview agree about what
 * would actually reach the patient.
 */
export function renderTemplate(body: string, values: Readonly<Record<string, string>>): string {
  return body.replace(PLACEHOLDER_PATTERN, (match, name: string) => {
    const key = `{{${name}}}`;
    return values[key] ?? values[match] ?? match;
  });
}

/** How many SMS segments a rendered body costs (at least one). */
export function smsSegments(rendered: string): number {
  return Math.max(1, Math.ceil(rendered.length / SMS_SEGMENT_CHARS));
}

/** The per-channel character budget, or null when the channel has none. */
export function channelCharLimit(channel: MessageChannel): number | null {
  if (channel === 'SMS') return SMS_SEGMENT_CHARS;
  if (channel === 'Push') return PUSH_BODY_CHARS;
  return null;
}
