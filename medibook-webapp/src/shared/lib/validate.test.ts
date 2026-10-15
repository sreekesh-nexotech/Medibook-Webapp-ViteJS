import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { todayIn } from '@/shared/lib/hospitalTime';

import {
  dateRange,
  email,
  fieldErrors,
  minLen,
  notFutureDate,
  phoneIN,
  pincode,
  positiveAmount,
  required,
} from '@/shared/lib/validate';
import { HOSPITAL_DATE, HOSPITAL_TIME_ZONE, PC_DATE, withPcBehindHospital } from '@/test/pcClock';

describe('required', () => {
  it('accepts any non-blank value', () => {
    expect(required('x')).toBeUndefined();
  });

  it('names the field when it is blank', () => {
    expect(required('   ', 'Name')).toBe('Name is required.');
    expect(required(null)).toBe('This field is required.');
  });
});

describe('phoneIN', () => {
  it('accepts a 10-digit Indian mobile, with or without spaces', () => {
    expect(phoneIN('9876543210')).toBeUndefined();
    expect(phoneIN('98765 43210')).toBeUndefined();
  });

  it('explains what is wrong with the number', () => {
    expect(phoneIN('')).toBe('Mobile number is required.');
    expect(phoneIN('98765abc10')).toBe('Mobile number can only contain digits.');
    expect(phoneIN('98765')).toBe('Enter a 10-digit mobile number.');
    expect(phoneIN('5876543210')).toBe('Mobile number must start with 6, 7, 8 or 9.');
  });
});

describe('email', () => {
  it('accepts a normal address', () => {
    expect(email('front.desk@hospital.example')).toBeUndefined();
  });

  it('refuses blank and malformed addresses', () => {
    expect(email('')).toBe('Email is required.');
    expect(email('front.desk@hospital')).toBe('Enter a valid email address.');
  });
});

describe('pincode', () => {
  it('accepts a 6-digit PIN code', () => {
    expect(pincode('500033')).toBeUndefined();
  });

  it('refuses short codes and codes starting with 0', () => {
    expect(pincode('')).toBe('PIN code is required.');
    expect(pincode('5000')).toBe('Enter a 6-digit PIN code.');
    expect(pincode('012345')).toBe('Enter a valid PIN code.');
  });
});

describe('minLen', () => {
  it('needs at least the given number of characters', () => {
    expect(minLen('ab', 3, 'Name')).toBe('Name must be at least 3 characters.');
    expect(minLen('abc', 3, 'Name')).toBeUndefined();
  });
});

describe('positiveAmount', () => {
  it('accepts amounts above zero', () => {
    expect(positiveAmount(5)).toBeUndefined();
    expect(positiveAmount('0.5')).toBeUndefined();
  });

  it('refuses blank, zero and non-numeric amounts', () => {
    expect(positiveAmount('')).toBe('Amount is required.');
    expect(positiveAmount('0')).toBe('Amount must be greater than zero.');
    expect(positiveAmount('abc')).toBe('Amount must be a number.');
  });
});

describe('notFutureDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 6, 9, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts today and earlier', () => {
    expect(notFutureDate('2026-10-06')).toBeUndefined();
    expect(notFutureDate('1990-01-31', 'Date of birth')).toBeUndefined();
  });

  it('refuses future and malformed dates', () => {
    expect(notFutureDate('2026-10-07', 'Date of birth')).toBe(
      'Date of birth cannot be in the future.',
    );
    expect(notFutureDate('06-10-2026')).toBe('Date must be a valid date.');
    expect(notFutureDate('')).toBe('Date is required.');
  });
});

describe('notFutureDate against the hospital’s today (UAT-47)', () => {
  withPcBehindHospital();

  it('accepts the hospital’s today even when the PC is still on the day before', () => {
    const today = todayIn(HOSPITAL_TIME_ZONE, Date.now());
    expect(today).toBe(HOSPITAL_DATE);
    // A baby born today at the hospital: the PC's own date would call it the future.
    expect(notFutureDate(HOSPITAL_DATE, 'Date of birth')).toBe(
      'Date of birth cannot be in the future.',
    );
    expect(notFutureDate(HOSPITAL_DATE, 'Date of birth', today)).toBeUndefined();
    expect(notFutureDate(PC_DATE, 'Date of birth', today)).toBeUndefined();
  });

  it('still refuses the hospital’s tomorrow', () => {
    expect(notFutureDate('2026-10-09', 'Date of birth', HOSPITAL_DATE)).toBe(
      'Date of birth cannot be in the future.',
    );
  });
});

describe('dateRange', () => {
  it('accepts a range whose end is on or after its start', () => {
    expect(dateRange('2026-10-01', '2026-10-05')).toBeUndefined();
    expect(dateRange('2026-10-05', '2026-10-05')).toBeUndefined();
  });

  it('refuses incomplete or reversed ranges', () => {
    expect(dateRange('2026-10-01', '')).toBe('Pick both a start and an end date.');
    expect(dateRange('2026-10-05', '2026-10-01')).toBe(
      'The end date must be on or after the start date.',
    );
    expect(dateRange('1 Oct', '2026-10-05')).toBe('Enter valid dates.');
  });
});

describe('fieldErrors', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required.'),
    age: z.number().int('Age must be a whole number.'),
  });

  it('keeps the first message for each field', () => {
    expect(fieldErrors(schema, { name: '', age: 1.5 })).toEqual({
      name: 'Name is required.',
      age: 'Age must be a whole number.',
    });
  });

  it('is empty when the value is valid', () => {
    expect(fieldErrors(schema, { name: 'Asha', age: 30 })).toEqual({});
  });
});
