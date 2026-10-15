import { describe, expect, it } from 'vitest';

import type { LegalDocument } from '@/features/ops-content/domain/entities/content.entities';
import {
  toAmbulanceRequest,
  toFaqRequest,
} from '@/features/ops-content/infrastructure/data-sources/remote/content.request';
import { toContentLocation } from '@/features/ops-content/infrastructure/data-sources/remote/content.response';
import {
  ambulanceErrors,
  faqErrors,
  legalVersionsBySlug,
  locationErrors,
  parseOptionalInt,
} from '@/features/ops-content/presentation/components/content.rules';

const doc = (version: number, published: boolean, current: boolean): LegalDocument => ({
  id: `terms-${version}`,
  slug: 'terms',
  version,
  title: `Terms v${version}`,
  bodyMd: '…',
  publishedAt: published ? '2026-09-01T00:00:00Z' : null,
  isCurrent: current,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
});

describe('legalVersionsBySlug', () => {
  it('finds the current version and the draft in progress', () => {
    const [terms, privacy] = legalVersionsBySlug(
      [doc(1, true, false), doc(3, false, false), doc(2, true, true)],
      ['terms', 'privacy'],
    );
    expect(terms?.current?.version).toBe(2);
    expect(terms?.draft?.version).toBe(3);
    expect(terms?.history.map((d) => d.version)).toEqual([3, 2, 1]);
    expect(privacy).toEqual({ slug: 'privacy', current: null, draft: null, history: [] });
  });

  it('has no draft when the newest version is published', () => {
    const [terms] = legalVersionsBySlug([doc(1, true, true)], ['terms']);
    expect(terms?.draft).toBeNull();
  });
});

describe('draft checks', () => {
  it('requires the FAQ text fields', () => {
    expect(
      Object.keys(
        faqErrors({
          category: '',
          question: ' ',
          answerMd: '',
          sortOrder: 0,
          isPublished: true,
          audience: null,
        }),
      ).sort(),
    ).toEqual(['answerMd', 'category', 'question']);
  });

  it('checks coordinates come as a valid pair', () => {
    const base = {
      city: 'Kochi',
      area: 'Kakkanad',
      state: 'Kerala',
      lat: null,
      lng: null,
      isPopular: false,
      isActive: true,
    };
    expect(locationErrors(base)).toEqual({});
    expect(locationErrors({ ...base, lat: '9.981636', lng: '76.299884' })).toEqual({});
    expect(locationErrors({ ...base, lat: '9.98' }).lng).toMatch(/both/);
    expect(locationErrors({ ...base, lat: '95', lng: '76' }).lat).toMatch(/between/);
    expect(locationErrors({ ...base, lat: '9.1234567', lng: '76' }).lat).toMatch(/6 decimal/);
  });

  it('checks the ambulance phone and arrival time', () => {
    const base = {
      locationId: null,
      name: 'Kochi Rescue',
      phoneE164: '+914842000108',
      etaMinutes: 12,
      serviceArea: null,
      isActive: true,
    };
    expect(ambulanceErrors(base)).toEqual({});
    expect(ambulanceErrors({ ...base, phoneE164: '04842000108' }).phoneE164).toBeDefined();
    expect(ambulanceErrors({ ...base, etaMinutes: -1 }).etaMinutes).toBeDefined();
  });

  it('parses optional whole numbers', () => {
    expect(parseOptionalInt('')).toBeNull();
    expect(parseOptionalInt('15')).toBe(15);
    expect(parseOptionalInt('1.5')).toBeUndefined();
  });
});

describe('content requests', () => {
  it('sends the FAQ audience only when the backend has it', () => {
    const draft = {
      category: 'Bookings',
      question: 'Q',
      answerMd: 'A',
      sortOrder: 1,
      isPublished: true,
      audience: null,
    };
    expect('audience' in toFaqRequest(draft)).toBe(false);
    expect(toFaqRequest({ ...draft, audience: 'hospital' }).audience).toBe('hospital');
  });

  it('maps the ambulance location field and decimal coordinates', () => {
    expect(
      toAmbulanceRequest({
        locationId: 'l1',
        name: 'N',
        phoneE164: '+914842000108',
        etaMinutes: null,
        serviceArea: null,
        isActive: true,
      }).location,
    ).toBe('l1');
    expect(
      toContentLocation({
        id: 'l1',
        city: 'Kochi',
        area: 'Edappally',
        state: 'Kerala',
        lat: '10.025000',
        lng: 76.308,
        is_popular: true,
        is_active: true,
        created_at: '',
        updated_at: '',
        version: 1,
      }),
    ).toMatchObject({ lat: '10.025000', lng: '76.308' });
  });
});
