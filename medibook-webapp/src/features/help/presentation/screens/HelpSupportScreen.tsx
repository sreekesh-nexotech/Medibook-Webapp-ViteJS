import { useState } from 'react';

import { SUPPORT_EMAIL_FALLBACK } from '@/core/config/support';
import { useAppConfigQuery } from '@/shared/hooks/useAppConfigQuery';
import { useHospitalTimeZone } from '@/shared/hooks/useHospitalTime';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import { useHelpFaqsQuery } from '@/features/help/application/queries/useHelpFaqsQuery';
import {
  faqsToShow,
  filterFaqs,
  supportContacts,
  topicsOf,
  topicTile,
} from '@/features/help/presentation/components/help.view';
import { RaiseTicketModal } from '@/features/help/presentation/components/RaiseTicketModal';
import { SupportTicketDrawer } from '@/features/help/presentation/components/SupportTicketDrawer';
import { SupportTicketsCard } from '@/features/help/presentation/components/SupportTicketsCard';

/**
 * Help & Support screen (design `Admin.jsx` `HelpSupport`): the navy hero with
 * a search field, four category tiles, the FAQ accordion, the contact cards,
 * "Raise a Ticket", and the hospital's own tickets with Medibook's replies
 * (UAT-30).
 *
 * The FAQs come from the platform's hospital FAQ feed (`GET
 * /hospital/content/faqs`, BE-34); while it is empty or unavailable the app
 * shows its own answers, checked against what the product does (UAT-51).
 * The topic tiles follow the answers' categories. The support email and phone are the
 * platform's `support_contacts` from app-config: the phone card only shows
 * when one is set, and the email falls back to the address the rest of the
 * app names. There is no live chat.
 */
export function HelpSupportScreen() {
  const [open, setOpen] = useState(0);
  const [raising, setRaising] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const timeZone = useHospitalTimeZone();
  const appConfig = useAppConfigQuery();
  const contacts = supportContacts(
    appConfig.data?.supportPhoneE164 ?? null,
    appConfig.data?.supportEmail ?? null,
    SUPPORT_EMAIL_FALLBACK,
  );

  const faqsQuery = useHelpFaqsQuery();
  const faqs = faqsToShow(faqsQuery.data);
  const topics = topicsOf(faqs);
  const shown = filterFaqs(faqs, topic, q);
  const filtered = q.trim() !== '' || topic !== null;
  const clear = (): void => {
    setQ('');
    setTopic(null);
    setOpen(0);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="shadow-card bg-p-500 rounded-xl p-9 text-center">
        <div className="text-h1 mb-2 font-bold text-white">How can we help?</div>
        <div className="text-body mb-5.5 text-white/75">
          Search the answers below, or raise a ticket with the Medibook team.
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
        {topics.map((key) => {
          const on = topic === key;
          const c = { key, ...topicTile(key) };
          return (
            <Card
              key={c.key}
              hover
              onClick={() => {
                setTopic(on ? null : c.key);
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
              {filtered ? `${shown.length} of ${faqs.length} answers` : `${faqs.length} answers`}
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
              <Button size="sm" icon="ticket" onClick={() => setRaising(true)}>
                Raise a Ticket
              </Button>
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((f, i) => (
                <div key={f.key} className="border-border-soft overflow-hidden rounded-md border">
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
                    <div className="text-body text-text-body px-4.5 pb-4.5 leading-relaxed whitespace-pre-wrap">
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
            {contacts.map((c) => (
              <a
                key={c.title}
                href={c.href}
                className="border-border-soft hover:bg-grey-200 flex items-center gap-3.5 rounded-md border p-3.5 no-underline transition-colors duration-150"
              >
                <div className="bg-blue-soft-bg text-blue flex size-10 flex-none items-center justify-center rounded-md">
                  <Icon name={c.icon} size={19} />
                </div>
                <div>
                  <div className="text-body text-text-strong font-medium">{c.title}</div>
                  <div className="text-caption text-text-muted">{c.detail}</div>
                </div>
              </a>
            ))}
            <Button icon="ticket" className="mt-1 w-full" onClick={() => setRaising(true)}>
              Raise a Ticket
            </Button>
          </div>
        </Card>
      </div>

      <SupportTicketsCard
        timeZone={timeZone}
        onOpen={setTicketId}
        onRaise={() => setRaising(true)}
      />

      <RaiseTicketModal
        open={raising}
        onClose={() => setRaising(false)}
        onRaised={(id) => setTicketId(id)}
      />
      <SupportTicketDrawer
        ticketId={ticketId}
        timeZone={timeZone}
        onClose={() => setTicketId(null)}
      />
    </div>
  );
}
