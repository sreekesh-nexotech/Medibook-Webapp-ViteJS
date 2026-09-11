/**
 * Pure messaging rules: the placeholder vocabulary, template rendering, the
 * SMS segment count and audience reach. No React, no store — the editor, the
 * live preview and the outbox all render a body the same way.
 */

import type {
  Announcement,
  AnnouncementAudience,
  MessageChannel,
  MessageEvent,
} from './messaging.types';

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

/** The sample values the live preview renders with. */
export function sampleValues(): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of PLACEHOLDERS) out[p.token] = p.sample;
  return out;
}

/**
 * Replace every known `{{token}}` with its value. Unknown tokens are left in
 * place on purpose, so the editor's warning and the preview agree about what
 * would actually reach the patient.
 */
export function renderTemplate(
  body: string,
  values: Readonly<Record<string, string>>,
): string {
  return body.replace(PLACEHOLDER_PATTERN, (match, name: string) => {
    const key = `{{${name}}}`;
    return values[key] ?? values[match] ?? match;
  });
}

/** The `{{tokens}}` a body uses, in order of first appearance, deduplicated. */
export function usedPlaceholders(body: string): readonly string[] {
  const found: string[] = [];
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    const key = `{{${match[1]}}}`;
    if (!found.includes(key)) found.push(key);
  }
  return found;
}

/** Tokens in the body that are not in the documented vocabulary. */
export function unknownPlaceholders(body: string): readonly string[] {
  const known = PLACEHOLDERS.map((p) => p.token);
  return usedPlaceholders(body).filter((t) => !known.includes(t));
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

/** `reminder-sms` — the stable template id for an event on a channel. */
export function templateId(event: MessageEvent, channel: MessageChannel): string {
  return `${event.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${channel.toLowerCase()}`;
}

/** What an announcement's audience reads as in the list. */
export function announcementAudienceCopy(a: Announcement): string {
  if (a.audience === "A department's patients") {
    return `${a.audienceRef || 'Department'} patients`;
  }
  if (a.audience === "A date's appointments") {
    return `Appointments on ${a.audienceRef || 'a chosen date'}`;
  }
  return 'All patients';
}

/** Counts the reach estimate is derived from — passed in by the screen. */
export interface ReachCounts {
  readonly allPatients: number;
  /** Patients per department name. */
  readonly byDepartment: Readonly<Record<string, number>>;
  /** Appointments per ISO date. */
  readonly byDate: Readonly<Record<string, number>>;
}

/** How many patients an audience resolves to right now. */
export function estimateReach(
  audience: AnnouncementAudience,
  audienceRef: string,
  counts: ReachCounts,
): number {
  if (audience === "A department's patients") return counts.byDepartment[audienceRef] ?? 0;
  if (audience === "A date's appointments") return counts.byDate[audienceRef] ?? 0;
  return counts.allPatients;
}
