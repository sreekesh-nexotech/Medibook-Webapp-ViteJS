import { describe, expect, it } from 'vitest';

import type { PlatformHospital } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import {
  bookabilityGaps,
  bpCopy,
  convenienceFeeCopy,
  hundredthsInput,
} from '@/features/ops-hospitals/presentation/components/hospitals.view';

function hospital(overrides: Partial<PlatformHospital> = {}): PlatformHospital {
  return {
    id: 'h-1',
    slug: 'test-hospital',
    name: 'Test Hospital',
    legalName: null,
    gstin: null,
    registrationNo: null,
    email: 'desk@hospital.example',
    phone: '+910000000000',
    website: null,
    addressLine1: 'Road 1',
    addressLine2: null,
    addressLine3: null,
    city: 'Kochi',
    state: 'Kerala',
    pincode: '682001',
    status: 'active',
    appVisibility: 'visible',
    onlineBookingEnabled: true,
    commissionBp: 450,
    convenienceFeeKind: 'flat',
    convenienceFeeValue: 2000,
    goLiveAt: '2026-08-01T00:00:00Z',
    createdAt: '2026-07-01T00:00:00Z',
    version: 1,
    ...overrides,
  };
}

describe('bpCopy', () => {
  it('shows basis points as a percentage', () => {
    expect(bpCopy(450)).toBe('4.5%');
    expect(bpCopy(1000)).toBe('10%');
    expect(bpCopy(1234)).toBe('12.34%');
    expect(bpCopy(0)).toBe('0%');
  });
});

describe('convenienceFeeCopy', () => {
  it('reads a flat fee in rupees and a percentage of the consultation fee', () => {
    expect(convenienceFeeCopy('flat', 2000)).toBe('₹ 20 per booking');
    expect(convenienceFeeCopy('flat', 1550)).toBe('₹ 15.5 per booking');
    expect(convenienceFeeCopy('percent', 300)).toBe('3% of the consultation fee');
  });
});

describe('hundredthsInput', () => {
  it('turns paise or basis points back into the number a person edits', () => {
    expect(hundredthsInput(2000)).toBe('20');
    expect(hundredthsInput(450)).toBe('4.5');
    expect(hundredthsInput(123456)).toBe('1234.56');
  });
});

describe('bookabilityGaps', () => {
  it('is empty when patients can find and book the hospital', () => {
    expect(bookabilityGaps(hospital())).toEqual([]);
  });

  it('names every reason patients cannot book online', () => {
    expect(
      bookabilityGaps(
        hospital({ status: 'onboarding', appVisibility: 'hidden', onlineBookingEnabled: false }),
      ),
    ).toEqual([
      'It has not gone live yet.',
      'It is hidden from the patient app.',
      'Online booking is switched off.',
    ]);
    expect(bookabilityGaps(hospital({ status: 'suspended' }))).toEqual(['It is suspended.']);
  });
});
