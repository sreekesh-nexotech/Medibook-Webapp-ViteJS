import { describe, expect, it } from 'vitest';

import type {
  HospitalProfile,
  HospitalRuleSettings,
  TokenPolicy,
} from '@/features/settings/domain/entities/settings.entities';
import {
  bankInput,
  hoursErrors,
  hoursFromForm,
  phoneToE164,
  profileChanges,
  rulesChanges,
  rulesErrors,
  toHoursForm,
  toProfileForm,
  toRulesForm,
  tokenChanges,
  tokenErrors,
  toTokenForm,
} from '@/features/settings/application/store/settings.form';

const profile: HospitalProfile = {
  id: 'h-1',
  name: 'City Care',
  legalName: null,
  email: 'desk@citycare.in',
  phoneE164: '+918045678900',
  website: null,
  addressLine1: '12 MG Road',
  addressLine2: null,
  addressLine3: null,
  city: 'Kochi',
  state: 'Kerala',
  pincode: '682011',
  lat: null,
  lng: null,
  logoFileId: null,
  coverFileId: null,
  stampFileId: null,
  onlineBookingEnabled: true,
  timezone: 'Asia/Kolkata',
  registrationNo: null,
  gstin: null,
  version: 1,
};

const rules: HospitalRuleSettings = {
  bookingWindowDays: 30,
  onlineRequiresApproval: false,
  holdTimeoutSeconds: 300,
  cancellationCutoffHours: 24,
  refundBeforeCutoffBp: 10_000,
  refundAfterCutoffBp: 5000,
  refundIncludesConvenienceFee: false,
  followUpWindowDays: 7,
  noShowCallAttempts: 3,
  tokenCancelLimitMin: null,
  expectedConsultMinutes: 10,
  patientNotesEnabled: true,
  receiptPaper: 'A5',
  receiptShowStaff: true,
  patientEditRequiresApproval: false,
  displayShowFullName: false,
  deskPaymentMethods: null,
  version: 4,
  derived: {
    bookingWindowEndDate: null,
    cancellationExample: null,
    slotsPerSessionEstimate: null,
    tokenCancelRule: null,
  },
};

const policy: TokenPolicy = {
  scope: 'doctor',
  reset: 'session',
  format: '{SRC}{SEQ:3}',
  prefix: '',
  onlineMarker: 'A',
  offlineMarker: 'W',
  separateRanges: false,
  onlineRangeStart: null,
  onlineRangeEnd: null,
  offlineRangeStart: null,
  offlineRangeEnd: null,
  reuseCancelled: true,
  printTemplateId: null,
  pendingScope: null,
  pendingReset: null,
  pendingEffectiveDate: null,
  version: 2,
};

describe('profileChanges (UAT-28, 07·F1)', () => {
  it('sends nothing when nothing changed — no invented coordinates', () => {
    const form = toProfileForm(profile);
    expect(form.lat).toBe('');
    expect(profileChanges(form, form)).toEqual({});
  });

  it('sends typed coordinates and blank optional text as null', () => {
    const base = toProfileForm({ ...profile, website: 'https://citycare.in' });
    const draft = {
      ...base,
      lat: ' 9.9312 ',
      lng: '76.2673',
      website: '  ',
      address2: 'Near Park',
    };
    expect(profileChanges(base, draft)).toEqual({
      lat: 9.9312,
      lng: 76.2673,
      website: null,
      addressLine2: 'Near Park',
    });
  });

  it('turns a national phone number into E.164', () => {
    expect(phoneToE164('080 4567 8900')).toBe('+918045678900');
    expect(phoneToE164('9876543210')).toBe('+919876543210');
    expect(phoneToE164('+44 20 7946 0958')).toBe('+442079460958');
  });
});

describe('hospital hours per weekday (UAT-50, 07·F14)', () => {
  it('reads missing days as closed and keeps each day its own hours', () => {
    const form = toHoursForm([
      { weekday: 0, isClosed: false, opensAt: '07:15', closesAt: '23:59' },
      { weekday: 5, isClosed: false, opensAt: '09:00', closesAt: '13:00' },
    ]);
    expect(form.days[0]).toEqual({ open: true, from: '7:15 am', to: '11:59 pm' });
    expect(form.days[5]).toEqual({ open: true, from: '9:00 am', to: '1:00 pm' });
    expect(form.days[6]?.open).toBe(false);
  });

  it('sends exactly seven rows, closed days without times', () => {
    const form = toHoursForm([
      { weekday: 0, isClosed: false, opensAt: '07:15', closesAt: '23:59' },
    ]);
    const week = hoursFromForm(form);
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ weekday: 0, isClosed: false, opensAt: '07:15', closesAt: '23:59' });
    expect(week[3]).toEqual({ weekday: 3, isClosed: true, opensAt: null, closesAt: null });
  });

  it('needs closing after opening on open days only', () => {
    const form = toHoursForm([
      { weekday: 1, isClosed: false, opensAt: '18:00', closesAt: '09:00' },
      { weekday: 2, isClosed: false, opensAt: '09:00', closesAt: '09:00' },
    ]);
    expect(hoursErrors(form)).toEqual({
      1: 'Closing time must be after opening time.',
      2: 'Closing time must be after opening time.',
    });
  });
});

describe('rulebook (07·F2, D-29, Q27)', () => {
  it('round-trips without changes', () => {
    const form = toRulesForm(rules);
    expect(form.holdTimeoutMinutes).toBe('5');
    expect(form.refundAfterPct).toBe('50');
    expect(rulesErrors(form)).toEqual({});
    expect(rulesChanges(form, form)).toEqual({});
  });

  it('sends only changed fields in API units', () => {
    const base = toRulesForm(rules);
    const draft = {
      ...base,
      holdTimeoutMinutes: '7',
      refundAfterPct: '25.5',
      tokenCancelLimitMin: '',
      patientEditRequiresApproval: true,
      noShowCallAttempts: '4',
    };
    expect(rulesChanges(base, draft)).toEqual({
      holdTimeoutSeconds: 420,
      refundAfterCutoffBp: 2550,
      patientEditRequiresApproval: true,
      noShowCallAttempts: 4,
    });
  });

  it('clears the token cancel limit with null', () => {
    const base = toRulesForm({ ...rules, tokenCancelLimitMin: 30 });
    expect(rulesChanges(base, { ...base, tokenCancelLimitMin: '' })).toEqual({
      tokenCancelLimitMin: null,
    });
  });

  it('flags out-of-range values the backend would refuse', () => {
    const form = {
      ...toRulesForm({ ...rules, deskPaymentMethods: ['cash'] }),
      bookingWindowDays: '181',
      expectedConsultMinutes: '0',
      refundBeforePct: '120',
      tokenCancelLimitMin: 'x',
      deskPaymentMethods: [],
    };
    expect(Object.keys(rulesErrors(form)).sort()).toEqual([
      'bookingWindowDays',
      'deskPaymentMethods',
      'expectedConsultMinutes',
      'refundBeforePct',
      'tokenCancelLimitMin',
    ]);
  });

  it('never sends desk methods while the backend does not offer them', () => {
    const base = toRulesForm(rules);
    expect(rulesChanges(base, { ...base, deskPaymentMethods: null })).toEqual({});
  });
});

describe('token policy (UAT-27, 07·F4)', () => {
  it('starts at the pending scope, and choosing today’s value again cancels it', () => {
    const pending: TokenPolicy = {
      ...policy,
      pendingScope: 'department',
      pendingEffectiveDate: '2026-10-08',
    };
    const base = toTokenForm(pending);
    expect(base.scope).toBe('department');
    expect(tokenChanges(base, { ...base, scope: 'doctor' })).toEqual({ scope: 'doctor' });
  });

  it('sends only what changed, with the default template as null', () => {
    const base = toTokenForm({ ...policy, printTemplateId: 'tpl-1' });
    const draft = {
      ...base,
      format: ' {DEPT}{SEQ:3} ',
      printTemplateId: '',
      reuseCancelled: false,
    };
    expect(tokenChanges(base, draft)).toEqual({
      format: '{DEPT}{SEQ:3}',
      printTemplateId: null,
      reuseCancelled: false,
    });
  });

  it('mirrors the backend range checks (Q21)', () => {
    const base = { ...toTokenForm(policy), separateRanges: true };
    expect(tokenErrors({ ...base, onlineRangeStart: '' }).onlineRangeStart).toBeDefined();
    expect(
      tokenErrors({
        ...base,
        onlineRangeStart: '1',
        onlineRangeEnd: '50',
        offlineRangeStart: '40',
        offlineRangeEnd: '99',
      }).separateRanges,
    ).toMatch(/overlap/);
    expect(
      tokenErrors({
        ...base,
        onlineRangeStart: '1',
        onlineRangeEnd: '49',
        offlineRangeStart: '50',
        offlineRangeEnd: '99',
      }),
    ).toEqual({});
    expect(
      tokenErrors({
        ...base,
        onlineRangeStart: '10',
        onlineRangeEnd: '10',
        offlineRangeStart: '50',
        offlineRangeEnd: '99',
      }).onlineRangeEnd,
    ).toMatch(/greater/);
  });

  it('requires both markers and a valid label format', () => {
    const errors = tokenErrors({ ...toTokenForm(policy), offlineMarker: ' ', format: '{SRC}' });
    expect(errors.offlineMarker).toBe('Required.');
    expect(errors.format).toMatch(/exactly one/);
  });
});

describe('bankInput (decision 4)', () => {
  it('keeps the stored account number unless a new one is typed', () => {
    const form = {
      accountName: ' City Care ',
      bank: 'SBI',
      account: '',
      ifsc: 'sbin0001',
      upi: '',
    };
    expect(bankInput(form)).toEqual({
      accountHolder: 'City Care',
      ifsc: 'SBIN0001',
      bankName: 'SBI',
      upiId: null,
    });
    expect(bankInput({ ...form, account: '1234 5678 90' }).accountNumber).toBe('1234567890');
  });
});
