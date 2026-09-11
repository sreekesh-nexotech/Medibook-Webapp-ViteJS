import { useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';
import { SectionTitle } from '@/shared/ui/SectionTitle';

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

/** Frequently asked questions, tagged with the category tile that shows them. */
const FAQS: readonly Faq[] = [
  {
    cat: 'Getting Started',
    q: 'How do I give my staff access?',
    a: 'Go to Users & Roles → Add User, pick the role that matches what they do, and choose how they get access (email invite, mobile OTP, or a password you set). The Access Preview tab shows exactly which screens and actions each role reaches before you assign it.',
  },
  {
    cat: 'Appointments',
    q: 'How do I add a walk-in appointment?',
    a: 'Go to Appointments → New Appointment, set Appointment type to Walk-in, choose the department, doctor and time, then record the payment — the receipt and queue token are generated automatically.',
  },
  {
    cat: 'Appointments',
    q: 'How is the token queue updated?',
    a: 'Tokens advance automatically when a doctor marks a patient Done, or manually via Call Next on the Token Management screen. Token numbers are issued as a hospital-wide running sequence (T-001, T-002 …).',
  },
  {
    cat: 'Billing',
    q: 'Where do I find a payment receipt?',
    a: 'Open the appointment or the Payments screen and use the receipt action — receipts carry the financial-year series (MB/R/2026-27/000123) and show the 18% GST as its own line. Use Save as PDF to print or keep a copy.',
  },
  {
    cat: 'Settlements',
    q: 'How do settlements work?',
    a: 'For online bookings, Medibook collects the fee, keeps a 10% commission, and transfers the net to the hospital by the expected date. Track and reconcile each transfer in Billing & Settlements — mark it Received once it reaches your account. Walk-in payments are collected at the desk and kept 100% by the hospital.',
  },
  {
    cat: 'Billing',
    q: 'Can I export reports?',
    a: 'Yes — the Payments, Settlements and Reports screens export the rows you are looking at as a CSV file. Anything labelled Save as PDF opens your browser print dialog with just that document on the page.',
  },
];

/** Contact channels as `[icon, title, subtitle, href]` tuples. */
const CONTACTS: readonly (readonly [IconName, string, string, string | null])[] = [
  ['mail', 'Email Support', 'support@medibook.app', 'mailto:support@medibook.app'],
  ['phone', 'Call Us', '1800 200 4567', 'tel:+918002004567'],
  ['message-circle', 'Live Chat', 'Mon–Sat, 9am–7pm', null],
];

/**
 * Help & Support screen (design `Admin.jsx` `HelpSupport`): the navy hero with
 * a search field, four category tiles, the FAQ accordion, the contact cards,
 * and the "Raise a Ticket" flow.
 *
 * The hero search and the category tiles are now wired to the FAQ list they
 * sit above — they were decorative controls before (audit 3.1: a control that
 * looks live and does nothing) — and a search that matches nothing gets an
 * empty state offering a way out.
 */
export function HelpSupportScreen() {
  const [open, setOpen] = useState(0);
  const [ticket, setTicket] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<HelpCategoryKey | null>(null);

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
            {CONTACTS.map(([ic, t, s, href]) => {
              const body = (
                <>
                  <div className="bg-blue-soft-bg text-blue flex size-10 flex-none items-center justify-center rounded-md">
                    <Icon name={ic} size={19} />
                  </div>
                  <div>
                    <div className="text-body text-text-strong font-medium">{t}</div>
                    <div className="text-caption text-text-muted">{s}</div>
                  </div>
                </>
              );
              return href ? (
                <a
                  key={t}
                  href={href}
                  className="border-border-soft hover:bg-grey-200 flex items-center gap-3.5 rounded-md border p-3.5 no-underline transition-colors duration-150"
                >
                  {body}
                </a>
              ) : (
                <div
                  key={t}
                  className="border-border-soft flex items-center gap-3.5 rounded-md border p-3.5"
                >
                  {body}
                </div>
              );
            })}
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
