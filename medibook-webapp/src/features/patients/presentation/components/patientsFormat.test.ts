import { describe, expect, it } from 'vitest';

import type { PatientRecord } from '@/features/patients/domain/entities/patients.entities';
import {
  changeSummary,
  changeValueText,
  demographicsOf,
  diffDemographics,
  displayPhone,
  phoneError,
  pincodeError,
  toE164,
} from '@/features/patients/presentation/components/patientsFormat';

const RECORD: PatientRecord = {
  id: 'p-1',
  mrn: 'LKSM000043',
  legacyMrn: null,
  firstName: 'Mary Ann',
  lastName: 'Thomas',
  fullName: 'Mary Ann Thomas',
  phone: '+919876543210',
  email: null,
  dateOfBirth: '1990-04-02',
  gender: 'female',
  addressLine1: '12 MG Road',
  addressLine2: null,
  addressLine3: null,
  city: 'Kochi',
  state: 'Kerala',
  pincode: '682001',
  source: 'online',
  isLinked: false,
  linkMethod: null,
  linkedAt: null,
  pendingChange: null,
  createdAt: '2026-10-01T09:00:00Z',
  version: 3,
};

describe('toE164', () => {
  it('adds +91 to an Indian mobile typed without a country code', () => {
    expect(toE164('98765 43210')).toBe('+919876543210');
    expect(toE164('09876543210')).toBe('+919876543210');
    expect(toE164('919876543210')).toBe('+919876543210');
  });

  it('keeps an international number as typed, without separators', () => {
    expect(toE164('+1 (415) 555-0100')).toBe('+14155550100');
    expect(toE164('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('is null for a blank field', () => {
    expect(toE164('   ')).toBeNull();
  });
});

describe('phoneError', () => {
  it('accepts what the backend accepts', () => {
    expect(phoneError('9876543210', true)).toBeUndefined();
    expect(phoneError('+14155550100', true)).toBeUndefined();
    expect(phoneError('+971501234567', true)).toBeUndefined();
  });

  it('refuses a short number, a landline without a code and junk', () => {
    expect(phoneError('98765', true)).toBeDefined();
    expect(phoneError('4712345678', true)).toBeDefined();
    expect(phoneError('+0123', true)).toBeDefined();
    expect(phoneError('phone', true)).toBeDefined();
  });

  it('allows a blank field only when the phone is optional', () => {
    expect(phoneError('', true)).toBe('Phone number is required.');
    expect(phoneError('', false)).toBeUndefined();
  });

  it('round-trips a stored foreign number through the edit form', () => {
    expect(phoneError(displayPhone('+14155550100'), true)).toBeUndefined();
    expect(toE164(displayPhone('+919876543210'))).toBe('+919876543210');
  });
});

describe('pincodeError', () => {
  it('takes six digits or nothing', () => {
    expect(pincodeError('682001')).toBeUndefined();
    expect(pincodeError('')).toBeUndefined();
    expect(pincodeError('68200')).toBeDefined();
    expect(pincodeError('68200A')).toBeDefined();
  });
});

describe('diffDemographics', () => {
  it('sends only the phone when only the phone changed (UAT-07)', () => {
    // A first name with a space used to be re-split into first/last on every edit.
    const next = { ...demographicsOf(RECORD), phone: '+919999999999' };
    expect(diffDemographics(RECORD, next)).toEqual({ phone: '+919999999999' });
  });

  it('sends nothing when nothing changed', () => {
    expect(diffDemographics(RECORD, demographicsOf(RECORD))).toEqual({});
  });

  it('includes the structured address and legacy MRN', () => {
    const next = {
      ...demographicsOf(RECORD),
      addressLine2: 'Ernakulam',
      pincode: '682016',
      legacyMrn: 'OLD-77',
    };
    expect(diffDemographics(RECORD, next)).toEqual({
      addressLine2: 'Ernakulam',
      pincode: '682016',
      legacyMrn: 'OLD-77',
    });
  });

  it('sends a cleared field as null', () => {
    const next = { ...demographicsOf(RECORD), city: null };
    expect(diffDemographics(RECORD, next)).toEqual({ city: null });
  });
});

describe('change values', () => {
  it('reads codes and dates the way the desk does', () => {
    expect(changeValueText('gender', 'female')).toBe('Female');
    expect(changeValueText('date_of_birth', '1990-04-02')).toBe('02 Apr 1990');
    expect(changeValueText('city', null)).toBe('not set');
  });

  it('summarises old → new per field', () => {
    expect(
      changeSummary([{ field: 'phone_e164', before: '+919876543210', after: '+919999999999' }]),
    ).toBe('phone: +919876543210 → +919999999999');
  });
});
