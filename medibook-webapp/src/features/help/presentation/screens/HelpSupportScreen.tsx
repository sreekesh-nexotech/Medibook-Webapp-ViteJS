import { useState } from 'react';

import { useSupportContacts } from '@/shared/hooks/useSupportContacts';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonBlock } from '@/shared/ui/Skeleton';

import { RaiseTicketModal } from '@/features/help/presentation/components/RaiseTicketModal';

/** The four help topics — both a category tile and the FAQ grouping. */
const CATEGORY_KEYS = ['Getting Started', 'Appointments', 'Billing', 'Settlements'] as const;

type HelpCategoryKey = (typeof CATEGORY_KEYS)[number];

interface HelpCategory {
  readonly key: HelpCategoryKey;
  readonly icon: IconName;
  readonly subtitle: string;
}

/** The four help category tiles (design `HelpSupport` `cats`). */
const CATEGORIES: readonly HelpCategory[] = [
  { key: 'Getting Started', icon: 'rocket', subtitle: 'Setup & first steps' },
  { key: 'Appointments', icon: 'calendar-days', subtitle: 'Booking & queue' },
  { key: 'Billing', icon: 'wallet', subtitle: 'Payments & invoices' },
  { key: 'Settlements', icon: 'scale', subtitle: 'Medibook transfers' },
];

interface Faq {
  readonly q: string;
  readonly a: string;
  readonly cat: HelpCategoryKey;
}

/**
 * Frequently asked questions, tagged with the category tile that shows them.
 * Each answer describes the product as it works today (OBS-07); change it in
 * the same pull request as the behaviour it describes.
 */
const FAQS: readonly Faq[] = [
  {
    cat: 'Getting Started',
    q: 'How do I give my staff access?',
    a: 'Go to Users & Roles → Add User, enter their name, email and role, and send the invitation. They get an email link, set their own password and can then sign in. The link expires after 7 days; you can resend it from their row. The Access Preview tab shows which screens and actions each role can reach.',
  },
  {
    cat: 'Appointments',
    q: 'How do I book a walk-in?',
    a: 'Go to Appointments → New Appointment. Find the patient or add a new one, pick the date, then for each consultation choose the department, doctor and an open slot, and book. The next window shows each token and fee: collect the payment there by cash, UPI or card (cash needs your cash drawer open on the Payments screen), then print the receipt and token slip. If the patient pays later, the booking stays Pending Payment in the list.',
  },
  {
    cat: 'Appointments',
    q: 'How does the token queue move?',
    a: "On Token Management, each doctor's session has its own queue. Call Next calls the next token, Start begins the consultation and Done finishes it. Skip calls a token again later; after the attempts your hospital allows, it can be marked a no-show. Tokens are numbered in booking order, following the token rules in Hospital Settings.",
  },
  {
    cat: 'Billing',
    q: 'Where do I find a payment receipt?',
    a: 'Open the appointment and choose Receipt, or use the receipt action on the Payments screen. The receipt shows its number, each service with its own tax, how it was paid and your GSTIN. You can download it as a PDF or print it from the same window.',
  },
  {
    cat: 'Settlements',
    q: 'How do settlements work?',
    a: "For online bookings, Medibook collects the fee from the patient, keeps its commission at the rate in your agreement, and pays the rest into your hospital's bank account for each settlement period. Billing & Settlements lists every period with its gross amount, commission, net payable and status; open one for its breakdown, payout and statement. Payments you collect at the desk stay with the hospital and are not part of settlements.",
  },
  {
    cat: 'Billing',
    q: 'Can I export reports?',
    a: 'Yes. Payments, Billing & Settlements, Reports and the Audit Trail download the rows you are looking at as a CSV file that opens in Excel. A very large report is prepared in the background and its download link is emailed to you. Reports can also be printed or saved as a PDF.',
  },
];

/** A contact channel as an `[icon, title, shown value, link]` tuple. */
type Contact = readonly [IconName, string, string, string];

/**
 * Help & Support screen (design `Admin.jsx` `HelpSupport`): the navy hero with
 * a search field, four category tiles, the FAQ accordion, the contact cards,
 * and the "Raise a Ticket" flow.
 *
 * The hero search and the category tiles are now wired to the FAQ list they
 * sit above — they were decorative controls before (audit 3.1: a control that
 * looks live and does nothing) — and a search that matches nothing gets an
 * empty state offering a way out.
 *
 * The FAQs are in-app copy: the hospital API has no FAQ endpoint (FAQs exist
 * only on the patient and platform surfaces). The contacts are the platform's
 * own, from app config (OBS-06); a channel the platform has not set is not
 * shown, so nobody calls a number or writes to an address that goes nowhere.
 */
export function HelpSupportScreen() {
  const [open, setOpen] = useState(0);
  const [ticket, setTicket] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<HelpCategoryKey | null>(null);
  const support = useSupportContacts();
  const contacts: readonly Contact[] = [
    ...(support.email
      ? [['mail', 'Email Support', support.email.label, support.email.href] as const]
      : []),
    ...(support.phone
      ? [['phone', 'Call Us', support.phone.label, support.phone.href] as const]
      : []),
  ];

  const needle = q.trim().toLowerCase();
  const shown = FAQS.filter((f) => {
    if (cat && f.cat !== cat) return false;
    if (needle && !(f.q + f.a).toLowerCase().includes(needle)) return false;
    return true;
  });
  const filtered = needle !== '' || cat !== null;
  const clear = (): void => {
    setQ('');
    setCat(null);
    setOpen(0);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="shadow-card bg-p-500 rounded-xl p-9 text-center">
        <div className="mb-2 text-[26px] font-bold text-white">How can we help?</div>
        <div className="text-body mb-5.5 text-white/75">
          Search our help center or browse common topics.
        </div>
        <div className="text-text-muted mx-auto flex h-13 max-w-130 items-center gap-3 rounded-lg bg-white px-4.5">
          <Icon name="search" size={20} />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(-1);
            }}
            aria-label="Search help topics"
            placeholder="Search for help..."
            className="text-body-lg text-text-strong flex-1 border-none bg-transparent outline-none"
          />
          {q !== '' && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear help search"
              className="text-text-muted hover:text-text-strong cursor-pointer border-0 bg-transparent p-0"
            >
              <Icon name="x" size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {CATEGORIES.map((c) => {
          const on = cat === c.key;
          return (
            <Card
              key={c.key}
              hover
              onClick={() => {
                setCat(on ? null : c.key);
                setOpen(0);
              }}
              pad={22}
              className={cn('text-center', on && 'border-blue border-2')}
            >
              <div
                className={cn(
                  'mx-auto mb-3 flex size-12 items-center justify-center rounded-lg',
                  on ? 'bg-blue text-white' : 'bg-blue-soft-bg text-blue',
                )}
              >
                <Icon name={c.icon} size={24} />
              </div>
              <div className="text-body text-text-strong font-semibold">{c.key}</div>
              <div className="text-caption text-text-muted mt-1">{c.subtitle}</div>
            </Card>
          );
        })}
      </div>

      <div className="flex items-start gap-5">
        <Card className="flex-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle size={16}>Frequently Asked Questions</SectionTitle>
            <span className="text-caption text-text-muted">
              {filtered ? `${shown.length} of ${FAQS.length} answers` : `${FAQS.length} answers`}
            </span>
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon="circle-help"
              title="No answers match that search."
              message="Clear the search to see every topic, or raise a ticket and the Medibook team will answer directly."
              actionLabel="Clear search"
              onAction={clear}
            >
              <Button size="sm" icon="ticket" onClick={() => setTicket(true)}>
                Raise a Ticket
              </Button>
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((f, i) => (
                <div key={f.q} className="border-border-soft overflow-hidden rounded-md border">
                  <button
                    type="button"
                    aria-expanded={open === i}
                    onClick={() => setOpen(open === i ? -1 : i)}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between px-4.5 py-4 text-left transition-colors duration-150',
                      open === i ? 'bg-grey-200' : 'bg-white',
                    )}
                  >
                    <span className="text-body text-text-strong font-medium">{f.q}</span>
                    <Icon
                      name={open === i ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      className="text-text-muted"
                    />
                  </button>
                  {open === i && (
                    <div className="text-body text-text-body px-4.5 pb-4.5 leading-[1.7]">
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex-1" pad={24}>
          <SectionTitle size={16} className="mb-4">
            Still need help?
          </SectionTitle>
          <div className="flex flex-col gap-3.5">
            {support.isPending && <SkeletonBlock w="100%" h={64} />}
            {contacts.map(([ic, t, s, href]) => (
              <a
                key={t}
                href={href}
                className="border-border-soft hover:bg-grey-200 flex items-center gap-3.5 rounded-md border p-3.5 no-underline transition-colors duration-150"
              >
                <div className="bg-blue-soft-bg text-blue flex size-10 flex-none items-center justify-center rounded-md">
                  <Icon name={ic} size={19} />
                </div>
                <div>
                  <div className="text-body text-text-strong font-medium">{t}</div>
                  <div className="text-caption text-text-muted">{s}</div>
                </div>
              </a>
            ))}
            <p className="text-caption text-text-muted">
              Raise a ticket and the Medibook team replies by email.
            </p>
            <Button icon="ticket" className="mt-1 w-full" onClick={() => setTicket(true)}>
              Raise a Ticket
            </Button>
          </div>
        </Card>
      </div>

      <RaiseTicketModal open={ticket} onClose={() => setTicket(false)} />
    </div>
  );
}
