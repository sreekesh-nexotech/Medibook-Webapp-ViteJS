import { describe, expect, it } from 'vitest';

import {
  PLAN_LIMIT_META,
  bpToPercentText,
  gstPercentError,
  parseGstPercent,
  parseSortOrder,
  parseTrialDays,
  trialDaysError,
  trialLabel,
} from '@/features/ops-plans/application/store/plans.limits';

describe('GST rate field (11·R11)', () => {
  it('turns a percentage into basis points and back', () => {
    expect(parseGstPercent('18')).toBe(1800);
    expect(parseGstPercent(' 12.5 ')).toBe(1250);
    expect(parseGstPercent('0')).toBe(0);
    expect(bpToPercentText(1800)).toBe('18');
    expect(bpToPercentText(1250)).toBe('12.5');
  });

  it('refuses what the backend would refuse', () => {
    expect(parseGstPercent('101')).toBeUndefined();
    expect(parseGstPercent('18.255')).toBeUndefined();
    expect(parseGstPercent('-1')).toBeUndefined();
    expect(parseGstPercent('eighteen')).toBeUndefined();
    expect(gstPercentError('')).toMatch(/required/);
    expect(gstPercentError('150')).toMatch(/0 to 100/);
    expect(gstPercentError('18')).toBeUndefined();
  });
});

describe('trial days field (UAT-14)', () => {
  it('accepts 0 to 365 whole days', () => {
    expect(parseTrialDays('14')).toBe(14);
    expect(parseTrialDays('0')).toBe(0);
    expect(parseTrialDays('365')).toBe(365);
    expect(parseTrialDays('366')).toBeUndefined();
    expect(parseTrialDays('1.5')).toBeUndefined();
    expect(trialDaysError('')).toMatch(/0 for no trial/);
  });

  it('labels the trial', () => {
    expect(trialLabel(14)).toBe('14-day trial');
    expect(trialLabel(0)).toBe('No trial');
  });
});

describe('catalog position field', () => {
  it('takes any whole number', () => {
    expect(parseSortOrder('10')).toBe(10);
    expect(parseSortOrder('-5')).toBe(-5);
    expect(parseSortOrder('1.5')).toBeUndefined();
    expect(parseSortOrder('')).toBeUndefined();
  });
});

describe('limit vocabulary (11·F24)', () => {
  it('names only the ceilings v2 keeps', () => {
    expect(Object.keys(PLAN_LIMIT_META).sort()).toEqual(['doctors', 'staff', 'storageGb']);
  });
});
