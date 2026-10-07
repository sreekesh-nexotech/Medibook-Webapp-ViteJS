import { describe, expect, it } from 'vitest';

import type { Failure } from '@/core/error/failure';

import {
  appliesToChoices,
  catalogueCodeError,
  overrideFromText,
  taxesConsultations,
} from '@/features/settings/presentation/components/services.labels';
import { taxRateInUseOf } from '@/features/settings/presentation/components/taxRateInUse';

function failure(code: string, meta: Record<string, unknown> = {}): Failure {
  return {
    kind: 'conflict',
    message: 'Conflict.',
    code,
    status: 409,
    fieldErrors: {},
    requestId: null,
    meta,
  };
}

describe('TAX_RATE_IN_USE (BE-10, UAT-09)', () => {
  it('names the services that still bill with the rate', () => {
    const view = taxRateInUseOf(
      failure('TAX_RATE_IN_USE', {
        service_count: 7,
        services: [
          { id: '1', code: 'ECG', name: 'ECG', hospital_id: 'h' },
          { id: '2', code: 'ECHO', name: 'Echo', hospital_id: 'h' },
        ],
      }),
    );
    expect(view?.serviceCount).toBe(7);
    expect(view?.serviceNames).toEqual(['ECG', 'Echo']);
    expect(view?.message).toBe(
      '7 services still bill with this rate: ECG, Echo and 5 more. Pick another rate on them first.',
    );
  });

  it('ignores any other failure', () => {
    expect(taxRateInUseOf(failure('CONFLICT_VERSION'))).toBeNull();
    expect(taxRateInUseOf(new Error('x'))).toBeNull();
  });
});

describe('tax rate scope (O-04, decision 7)', () => {
  it('offers services only, keeping a rate that already taxes consultations visible', () => {
    expect(appliesToChoices(null)).toEqual(['service']);
    expect(appliesToChoices('service')).toEqual(['service']);
    expect(appliesToChoices('all')).toEqual(['service', 'all']);
    expect(appliesToChoices('consultation')).toEqual(['service', 'consultation']);
    expect(taxesConsultations('all')).toBe(true);
    expect(taxesConsultations('service')).toBe(false);
  });
});

describe('typed codes and prices (UAT-49)', () => {
  it('accepts an empty code (server-made) or the backend’s code shape', () => {
    expect(catalogueCodeError('')).toBeUndefined();
    expect(catalogueCodeError('GST_5.1-a')).toBeUndefined();
    expect(catalogueCodeError('-GST')).toBeDefined();
    expect(catalogueCodeError('x'.repeat(41))).toBeDefined();
  });

  it('reads a doctor’s own price: empty = the service’s, whole rupees otherwise', () => {
    expect(overrideFromText('')).toBeNull();
    expect(overrideFromText(' 450 ')).toBe(450);
    expect(overrideFromText('0')).toBe(0);
    expect(overrideFromText('4.5')).toBeUndefined();
  });
});
