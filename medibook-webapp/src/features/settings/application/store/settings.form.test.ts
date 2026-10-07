import { describe, expect, it } from 'vitest';

import type {
  HospitalRuleSettings,
  NumberingSeries,
  TokenPolicy,
} from '@/features/settings/domain/entities/settings.entities';
import {
  numberingChanges,
  refundLabel,
  rulesChanges,
  toNumberingForm,
  toRulesForm,
  toTokenForm,
  tokenChanges,
  withoutSections,
} from '@/features/settings/application/store/settings.form';

/** The test backend's seeded rulebook. */
const RULES: HospitalRuleSettings = {
  bookingWindowDays: 30,
  onlineRequiresApproval: false,
  holdTimeoutSeconds: 300,
  cancellationCutoffHours: 4,
  refundBeforeCutoffBp: 10000,
  refundAfterCutoffBp: 0,
  refundIncludesConvenienceFee: false,
  followUpWindowDays: 7,
  noShowCallAttempts: 3,
  tokenCancelLimitMin: null,
  expectedConsultMinutes: 10,
  patientNotesEnabled: true,
  patientEditRequiresApproval: true,
  displayShowFullName: false,
  version: 1,
  derived: { bookingWindowEndDate: null, cancellationExample: null, slotsPerSessionEstimate: null },
};

const POLICY: TokenPolicy = {
  scope: 'doctor',
  reset: 'session',
  format: '{SRC}{SEQ:3}',
  prefix: 'T',
  onlineMarker: 'A',
  offlineMarker: 'W',
  separateRanges: false,
  onlineRangeStart: null,
  onlineRangeEnd: null,
  offlineRangeStart: null,
  offlineRangeEnd: null,
  reuseCancelled: true,
  pendingScope: null,
  pendingReset: null,
  pendingEffectiveDate: null,
  version: 2,
};

const RECEIPTS: NumberingSeries = {
  kind: 'receipt',
  format: '{PREFIX}/{FY}/{SEQ:5}',
  prefix: 'EXMR',
  padWidth: 4,
  reset: 'fiscal_year',
  fyStartMonth: 4,
  gapless: true,
  hospitalEditable: true,
  locked: false,
  nextPreview: 'EXMR/26-27/00170',
  version: 1,
};

describe('rules', () => {
  it('sends nothing when nothing changed', () => {
    const form = toRulesForm(RULES);
    expect(rulesChanges(form, form)).toEqual({});
  });

  it('sends each changed rule in API units', () => {
    const base = toRulesForm(RULES);
    const draft = {
      ...base,
      onlineApproval: true,
      refundBefore: '75%',
      refundAfter: '25%',
      refundFee: true,
      noShowCalls: '5 missed calls',
      tokenCancel: '1 h before the session',
      consultMinutes: '12',
      patientNotes: false,
      patientEditApproval: false,
      displayFullName: true,
    };
    expect(rulesChanges(base, draft)).toEqual({
      onlineRequiresApproval: true,
      refundBeforeCutoffBp: 7500,
      refundAfterCutoffBp: 2500,
      refundIncludesConvenienceFee: true,
      noShowCallAttempts: 5,
      tokenCancelLimitMin: 60,
      expectedConsultMinutes: 12,
      patientNotesEnabled: false,
      patientEditRequiresApproval: false,
      displayShowFullName: true,
    });
  });

  it('reads the two fixed token-cancel choices as null and 0', () => {
    const base = toRulesForm({ ...RULES, tokenCancelLimitMin: 30 });
    expect(base.tokenCancel).toBe('30 min before the session');
    expect(rulesChanges(base, { ...base, tokenCancel: 'Until the token is called' })).toEqual({
      tokenCancelLimitMin: null,
    });
    expect(rulesChanges(base, { ...base, tokenCancel: 'Until the session starts' })).toEqual({
      tokenCancelLimitMin: 0,
    });
  });

  it('labels refunds the server holds outside the menu', () => {
    expect(refundLabel(3333)).toBe('33.33%');
    expect(refundLabel(10000)).toBe('100%');
  });
});

describe('token policy', () => {
  it('shows the change waiting to apply, so picking today’s value cancels it', () => {
    const pending = {
      ...POLICY,
      pendingScope: 'hospital' as const,
      pendingEffectiveDate: '2026-10-08',
    };
    const base = toTokenForm(pending);
    expect(base.scope).toBe('One series for the hospital');
    expect(tokenChanges(base, { ...base, scope: 'One series per doctor' })).toEqual({
      scope: 'doctor',
    });
  });

  it('sends the label fields trimmed and empty ranges as null', () => {
    const base = toTokenForm(POLICY);
    const draft = {
      ...base,
      format: ' {PREFIX}-{SEQ:3} ',
      prefix: ' OPD ',
      separateRanges: true,
      onlineFrom: '1',
      onlineTo: '50',
      walkInFrom: '',
      reset: 'Every day',
    };
    expect(tokenChanges(base, draft)).toEqual({
      format: '{PREFIX}-{SEQ:3}',
      prefix: 'OPD',
      separateRanges: true,
      onlineRangeStart: 1,
      onlineRangeEnd: 50,
      reset: 'day',
    });
  });
});

describe('numbering', () => {
  it('maps a series to its draft and back', () => {
    const base = toNumberingForm(RECEIPTS);
    expect(base).toEqual({
      format: '{PREFIX}/{FY}/{SEQ:5}',
      prefix: 'EXMR',
      padWidth: '4',
      reset: 'Every financial year',
      fyStartMonth: 'April',
    });
    expect(numberingChanges(base, base)).toEqual({});
    expect(
      numberingChanges(base, {
        ...base,
        prefix: '  ',
        padWidth: '6',
        reset: 'Every month',
        fyStartMonth: 'January',
      }),
    ).toEqual({ prefix: null, padWidth: 6, reset: 'monthly', fyStartMonth: 1 });
  });

  it('drops a saved series from the draft', () => {
    const form = toNumberingForm(RECEIPTS);
    expect(withoutSections({ receipt: form, booking: form }, ['receipt'])).toEqual({
      booking: form,
    });
  });
});
