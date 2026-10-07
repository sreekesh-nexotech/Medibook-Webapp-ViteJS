import type { IconName } from '@/shared/ui/icon-registry';

import type {
  SupportTicketCategory,
  SupportTicketStatus,
  TicketAuthorKind,
} from '@/features/help/domain/entities/help.types';

/** View helpers for Help & Support. Pure, no React. */

/* --------------------------------------------------------------- tickets */

/** Readable label for each backend ticket category, in the backend's order. */
export const CATEGORY_LABELS: Readonly<Record<SupportTicketCategory, string>> = {
  billing: 'Billing & settlements',
  technical: 'Technical issue',
  onboarding: 'Onboarding & setup',
  feature_request: 'Feature request',
  complaint: 'Complaint',
  other: 'Other',
};

/** A status as the desk reads it, with the badge palette entry it uses. */
export const STATUS_VIEW: Readonly<
  Record<SupportTicketStatus, { readonly label: string; readonly badge: string }>
> = {
  open: { label: 'Open', badge: 'Open' },
  in_progress: { label: 'In progress', badge: 'Scheduled' },
  waiting_on_requester: { label: 'Waiting for you', badge: 'Pending' },
  resolved: { label: 'Resolved', badge: 'Resolved' },
  closed: { label: 'Closed', badge: 'Inactive' },
};

/** The ticket list's status filter: label → backend status (`null` = all). */
export const TICKET_FILTERS: readonly {
  readonly label: string;
  readonly status: SupportTicketStatus | null;
}[] = [
  { label: 'All', status: null },
  { label: 'Open', status: 'open' },
  { label: 'In progress', status: 'in_progress' },
  { label: 'Waiting for you', status: 'waiting_on_requester' },
  { label: 'Resolved', status: 'resolved' },
  { label: 'Closed', status: 'closed' },
];

/** A closed ticket takes no more replies (the backend answers 409). */
export function canReply(status: SupportTicketStatus): boolean {
  return status !== 'closed';
}

/** Who wrote a message, as the thread names them. */
export function authorLabel(kind: TicketAuthorKind, name: string | null): string {
  if (kind === 'platform_staff') return name ? `${name} · Medibook support` : 'Medibook support';
  return name ?? 'Your hospital';
}

/* ------------------------------------------------------------------ FAQs */

/** The four help topics — both a category tile and the FAQ grouping. */
export const HELP_TOPICS = ['Getting Started', 'Appointments', 'Billing', 'Settlements'] as const;

export type HelpTopic = (typeof HELP_TOPICS)[number];

export interface Faq {
  readonly q: string;
  readonly a: string;
  readonly topic: HelpTopic;
}

/**
 * In-app answers, each checked against what the product does today (UAT-51):
 * email-link invitations only, walk-ins on an open slot, tokens per doctor
 * session called with Call Next, per-hospital receipt series and commission,
 * and no "mark received" step on settlements.
 */
export const FAQS: readonly Faq[] = [
  {
    topic: 'Getting Started',
    q: 'How do I give my staff access?',
    a: 'An admin opens Users & Roles → Add User and sends an email invitation; the staff member sets their own password from the link. Everyone gets one of the four roles — Admin, Front Desk, Accounts or Department Front Desk — and the admin can change what each role may do, except the admin role itself.',
  },
  {
    topic: 'Appointments',
    q: 'How do I book a walk-in?',
    a: 'Go to Appointments → New Appointment, find the patient (or add them), then pick the department, the doctor and one of the doctor’s open slots for each consultation and book. The queue token is issued at booking. Staff who take payments collect the fee straight away; anyone else books and the patient pays at reception.',
  },
  {
    topic: 'Appointments',
    q: 'How does the token queue work?',
    a: 'Each doctor session is its own queue. On Token Management the desk opens the session and presses Call Next, which calls tokens in number order; Start, Done and Skip move the called patient along. Done does not call anyone else — press Call Next for the next patient. After the hospital’s number of skips the desk is offered a no-show; it is never marked automatically.',
  },
  {
    topic: 'Billing',
    q: 'Where do I find a payment receipt?',
    a: 'Open the appointment and choose Receipt, or find the payment on the Payments screen. Receipts are numbered in your hospital’s own receipt series and list every payment line, with tax shown on the lines it applies to.',
  },
  {
    topic: 'Settlements',
    q: 'How do settlements work?',
    a: 'Medibook collects the payment for online bookings and pays your hospital the amount due after its commission, at the rate agreed for your hospital, once each settlement period closes. Billing & Settlements shows every period with its payout and statement. Fees collected at the desk are your hospital’s and are not part of settlements.',
  },
  {
    topic: 'Billing',
    q: 'Can I export data?',
    a: 'Yes. Payments, Reports and Billing & Settlements export what you are looking at, in the formats each screen offers. Very large report exports are prepared in the background and sent to you by email when they are ready.',
  },
];

/** FAQs in a topic (or all) that mention the search text in the question or the answer. */
export function filterFaqs(
  faqs: readonly Faq[],
  topic: HelpTopic | null,
  search: string,
): readonly Faq[] {
  const needle = search.trim().toLowerCase();
  return faqs.filter(
    (f) =>
      (!topic || f.topic === topic) && (!needle || `${f.q} ${f.a}`.toLowerCase().includes(needle)),
  );
}

/* --------------------------------------------------------------- contact */

export interface SupportContact {
  readonly icon: IconName;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
}

const INDIA_PREFIX = '+91';
const INDIAN_MOBILE_DIGITS = 10;

/** "+919876543210" → "+91 98765 43210"; other numbers stay as sent. */
export function formatSupportPhone(e164: string): string {
  const local = e164.startsWith(INDIA_PREFIX) ? e164.slice(INDIA_PREFIX.length) : null;
  if (local && /^\d+$/.test(local) && local.length === INDIAN_MOBILE_DIGITS) {
    return `${INDIA_PREFIX} ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return e164;
}

/**
 * The ways to reach Medibook: the platform's support email and phone from
 * app-config (`support_contacts`). The phone card only appears when the
 * platform has set one — the app never invents a number (UAT-51) — and the
 * email falls back to the one address the rest of the app names.
 */
export function supportContacts(
  phoneE164: string | null,
  email: string | null,
  fallbackEmail: string,
): readonly SupportContact[] {
  const address = email ?? fallbackEmail;
  const contacts: SupportContact[] = [
    { icon: 'mail', title: 'Email Support', detail: address, href: `mailto:${address}` },
  ];
  if (phoneE164) {
    contacts.push({
      icon: 'phone',
      title: 'Call Us',
      detail: formatSupportPhone(phoneE164),
      href: `tel:${phoneE164}`,
    });
  }
  return contacts;
}
