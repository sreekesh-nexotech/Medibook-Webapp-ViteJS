import { describe, expect, it } from 'vitest';

import type {
  MessageTemplate,
  MessageTemplateDraft,
} from '@/features/ops-message-templates/domain/entities/messageTemplates.entities';
import {
  toTemplateCreateBody,
  toTemplatePatchBody,
} from '@/features/ops-message-templates/infrastructure/data-sources/remote/messageTemplates.request';
import {
  eventPlaceholders,
  filterTemplates,
  hasTemplateErrors,
  placeholdersIn,
  removalEffect,
  smsParts,
  templateErrors,
  templateNotes,
} from '@/features/ops-message-templates/presentation/components/messageTemplates.rules';

const tpl = (over: Partial<MessageTemplate> = {}): MessageTemplate => ({
  id: 't1',
  eventCode: 'appointment.confirmed',
  channel: 'sms',
  locale: 'en-IN',
  subject: null,
  body: 'Medibook: {{patientName}}, booking {{bookingRef}} is confirmed.',
  whatsappTemplateName: null,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  version: 1,
  ...over,
});

const draft = (over: Partial<MessageTemplateDraft> = {}): MessageTemplateDraft => ({
  eventCode: 'appointment.confirmed',
  channel: 'push',
  locale: 'en-IN',
  subject: 'Booking confirmed',
  body: 'Booking {{bookingRef}} is confirmed.',
  whatsappTemplateName: null,
  isActive: true,
  ...over,
});

const TEMPLATES = [
  tpl(),
  tpl({ id: 't2', channel: 'push', subject: 'Confirmed {{bookingRef}}', body: 'See you soon.' }),
  tpl({ id: 't3', eventCode: 'refund.processed', body: '{{amount}} refunded.' }),
];

describe('placeholders', () => {
  it('reads names like the backend renderer, once each', () => {
    expect(placeholdersIn('Hi {{ name }}, {{name}} {{ref_no}} {{1bad}}')).toEqual([
      'name',
      'ref_no',
    ]);
    expect(placeholdersIn(null)).toEqual([]);
  });

  it('lists what the event’s other templates fill in', () => {
    expect(eventPlaceholders(TEMPLATES, 'appointment.confirmed', 't2')).toEqual([
      'bookingRef',
      'patientName',
    ]);
  });
});

describe('templateErrors', () => {
  it('accepts a complete push template switched off next to an active one', () => {
    expect(hasTemplateErrors(templateErrors(draft({ isActive: false }), TEMPLATES, null))).toBe(
      false,
    );
  });

  it('refuses a second active template for the same event, channel and locale', () => {
    expect(templateErrors(draft(), TEMPLATES, null).isActive).toMatch(/already exists/);
    expect(templateErrors(draft(), TEMPLATES, 't2').isActive).toBeUndefined();
    expect(templateErrors(draft({ locale: 'hi-IN' }), TEMPLATES, null).isActive).toBeUndefined();
  });

  it('checks codes and channel requirements', () => {
    const e = templateErrors(
      draft({ eventCode: 'Confirmed', locale: 'english', body: ' ', channel: 'whatsapp' }),
      [],
      null,
    );
    expect(Object.keys(e).sort()).toEqual(['body', 'eventCode', 'locale', 'whatsappTemplateName']);
    expect(
      templateErrors(draft({ channel: 'email', subject: '' }), [], null).subject,
    ).toBeDefined();
  });
});

describe('templateNotes', () => {
  it('flags an event code nothing else uses and unknown placeholders', () => {
    expect(templateNotes(draft({ eventCode: 'appointment.confirmd' }), TEMPLATES, null)[0]).toMatch(
      /No other template/,
    );
    const notes = templateNotes(draft({ body: 'Hi {{doctorName}}' }), TEMPLATES, null);
    expect(notes.some((n) => n.includes('{{doctorName}} is not used'))).toBe(true);
  });

  it('warns about long SMS and staff-only email', () => {
    expect(smsParts('x'.repeat(160))).toBe(1);
    expect(smsParts('x'.repeat(161))).toBe(2);
    expect(
      templateNotes(draft({ channel: 'sms', body: 'x'.repeat(200) }), TEMPLATES, null).some((n) =>
        n.includes('SMS parts'),
      ),
    ).toBe(true);
    expect(
      templateNotes(draft({ channel: 'email' }), TEMPLATES, null).some((n) =>
        n.includes('staff only'),
      ),
    ).toBe(true);
  });
});

describe('filterTemplates', () => {
  it('searches codes and wording, in event → channel order', () => {
    expect(
      filterTemplates(TEMPLATES, { q: '', channel: null, status: 'all' }).map((t) => t.id),
    ).toEqual(['t1', 't2', 't3']);
    expect(
      filterTemplates(TEMPLATES, { q: 'refund', channel: null, status: 'all' }).map((t) => t.id),
    ).toEqual(['t3']);
    expect(filterTemplates(TEMPLATES, { q: '', channel: 'push', status: 'inactive' })).toEqual([]);
  });
});

describe('removalEffect', () => {
  it('says what happens to messages being sent', () => {
    expect(removalEffect(tpl({ isActive: false }), TEMPLATES)).toMatch(/already off/);
    expect(removalEffect(tpl({ id: 'h', locale: 'hi-IN' }), TEMPLATES)).toMatch(/fall back/);
    expect(
      removalEffect(tpl({ id: 'h', locale: 'hi-IN', channel: 'whatsapp' }), TEMPLATES),
    ).toMatch(/stops going out by WhatsApp in hi-IN/);
    expect(removalEffect(tpl(), TEMPLATES)).toMatch(/stops going out by SMS/);
  });
});

describe('template requests', () => {
  it('sends the fixed fields only on create and drops unused ones', () => {
    expect(toTemplateCreateBody(draft({ eventCode: ' appointment.confirmed ' }))).toMatchObject({
      event_code: 'appointment.confirmed',
      channel: 'push',
      locale: 'en-IN',
      subject: 'Booking confirmed',
      whatsapp_template_name: null,
    });
    const patch = toTemplatePatchBody(draft({ subject: ' ' }));
    expect('event_code' in patch).toBe(false);
    expect(patch.subject).toBeNull();
  });
});
