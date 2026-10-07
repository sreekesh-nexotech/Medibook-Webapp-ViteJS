import { describe, expect, it } from 'vitest';

import {
  faqFeedSchema,
  supportTicketDetailSchema,
  toHelpFaqs,
  toSupportTicketDetail,
} from '@/features/help/infrastructure/data-sources/remote/help.response';
import {
  authorLabel,
  canReply,
  faqsToShow,
  filterFaqs,
  formatSupportPhone,
  STATIC_FAQS,
  supportContacts,
  topicsOf,
} from '@/features/help/presentation/components/help.view';

const FALLBACK = 'support@medibook.in';

describe('support contacts (UAT-51)', () => {
  it('shows one email and no invented phone when the platform set none', () => {
    const contacts = supportContacts(null, null, FALLBACK);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ detail: FALLBACK, href: `mailto:${FALLBACK}` });
  });

  it('uses the platform phone and email from app-config, dialling the same number it shows', () => {
    const contacts = supportContacts('+919876543210', 'help@medibook.in', FALLBACK);
    expect(contacts.map((c) => c.href)).toEqual(['mailto:help@medibook.in', 'tel:+919876543210']);
    expect(contacts[1].detail).toBe('+91 98765 43210');
  });

  it('leaves non-mobile numbers as sent', () => {
    expect(formatSupportPhone('+18005550199')).toBe('+18005550199');
  });
});

describe('FAQs', () => {
  it('describes no removed or missing features', () => {
    const text = STATIC_FAQS.map((f) => f.a)
      .join(' ')
      .toLowerCase();
    for (const claim of [
      'otp',
      'password you set',
      'appointment type',
      '10%',
      'mark it received',
      'live chat',
      't-001',
    ]) {
      expect(text).not.toContain(claim);
    }
  });

  it('prefers the platform feed and groups by its categories', () => {
    const feed = toHelpFaqs(
      faqFeedSchema.parse({
        categories: [
          {
            category: 'Queue',
            entries: [
              { id: 'b', question: 'Second?', answer_md: 'Two', sort_order: 2 },
              { id: 'a', question: 'First?', answer_md: 'One', sort_order: 1 },
            ],
          },
        ],
      }),
    );
    const faqs = faqsToShow(feed);
    expect(faqs.map((f) => f.q)).toEqual(['First?', 'Second?']);
    expect(topicsOf(faqs)).toEqual(['Queue']);
    expect(faqsToShow([])).toBe(STATIC_FAQS);
  });

  it('filters by topic and by text in question or answer', () => {
    expect(filterFaqs(STATIC_FAQS, 'Settlements', '')).toHaveLength(1);
    expect(filterFaqs(STATIC_FAQS, null, 'call next').map((f) => f.key)).toEqual(['token-queue']);
  });
});

describe('ticket thread', () => {
  it('parses a ticket detail with its messages and optional names', () => {
    const detail = toSupportTicketDetail(
      supportTicketDetailSchema.parse({
        id: 't1',
        ticket_no: 'TKT-2026-0001',
        raised_by_kind: 'hospital_staff',
        raised_by_name: 'Anita Menon',
        hospital_id: 'h1',
        hospital_name: 'Lakeshore',
        category: 'billing',
        subject: 'Statement',
        description: 'Missing',
        priority: 'normal',
        status: 'waiting_on_requester',
        resolved_at: null,
        closed_at: null,
        created_at: '2026-10-05T10:00:00Z',
        updated_at: '2026-10-05T11:00:00Z',
        version: 2,
        messages: [
          {
            id: 'm1',
            author_kind: 'platform_staff',
            author_name: 'Deepak Nair',
            body: 'Could you share the period?',
            attachment_file_ids: ['f1'],
            occurred_at: '2026-10-05T11:00:00Z',
          },
        ],
      }),
    );
    expect(detail.raisedByName).toBe('Anita Menon');
    expect(detail.messages[0].attachmentFileIds).toEqual(['f1']);
    expect(authorLabel(detail.messages[0].authorKind, detail.messages[0].authorName)).toBe(
      'Deepak Nair · Medibook support',
    );
  });

  it('takes replies until the ticket is closed', () => {
    expect(canReply('waiting_on_requester')).toBe(true);
    expect(canReply('resolved')).toBe(true);
    expect(canReply('closed')).toBe(false);
  });
});
