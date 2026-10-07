import { describe, expect, it } from 'vitest';

import {
  toCreateRequest,
  toPatchRequest,
} from '@/features/ops-notifications/infrastructure/data-sources/remote/notifications.request';
import {
  audienceLabel,
  ctaErrors,
  ctaTargetError,
} from '@/features/ops-notifications/presentation/components/bannerRules';

describe('ctaTargetError (L-01 rule)', () => {
  it('accepts app deep links and https URLs', () => {
    expect(ctaTargetError('medibook://hospitals/abc')).toBeNull();
    expect(ctaTargetError('https://medibook.in/offers')).toBeNull();
  });

  it('refuses everything else', () => {
    expect(ctaTargetError('http://medibook.in')).not.toBeNull();
    expect(ctaTargetError('javascript:alert(1)')).not.toBeNull();
    expect(ctaTargetError('medibook://')).not.toBeNull();
    expect(ctaTargetError('medibook://two words')).not.toBeNull();
    expect(ctaTargetError('www.example.com')).not.toBeNull();
  });
});

describe('ctaErrors', () => {
  it('allows no CTA at all', () => {
    expect(ctaErrors('', '  ')).toEqual({ label: null, target: null });
  });

  it('needs both halves', () => {
    expect(ctaErrors('Book now', '').target).not.toBeNull();
    expect(ctaErrors('', 'https://x.in').label).not.toBeNull();
  });
});

describe('banner requests', () => {
  const fields = {
    title: 'Camp',
    body: null,
    ctaLabel: 'Book',
    ctaTarget: 'medibook://hospitals',
    audience: 'all_patients_in_city',
    imageFileId: null,
    from: null,
    to: null,
  };

  it('sends body, CTA and audience on create', () => {
    expect(toCreateRequest(fields, 2)).toMatchObject({
      cta_label: 'Book',
      cta_target: 'medibook://hospitals',
      audience: 'all_patients_in_city',
      body: null,
      sort_order: 2,
    });
  });

  it('patches only what changed', () => {
    expect(toPatchRequest({ audience: 'hospital_patients' })).toEqual({
      audience: 'hospital_patients',
    });
  });

  it('labels audiences', () => {
    expect(audienceLabel('all_patients_in_city')).toBe('All app users');
    expect(audienceLabel('new_audience')).toBe('new audience');
  });
});
