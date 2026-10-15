import { describe, expect, it } from 'vitest';

import type { WeekDay } from '@/features/doctors/application/store/catalog.types';
import { END_OF_DAY_LABEL, TIME_OPTS } from '@/features/doctors/domain/calendar';
import {
  feeError,
  paiseToRupeeInput,
  rupeeInputToPaise,
  sanitizeRupeeInput,
  timeOptionsWith,
  weekErrors,
} from '@/features/doctors/presentation/components/doctors.view';

describe('doctor fee input keeps paise (UAT-08)', () => {
  it('shows stored paise exactly, whole rupees without decimals', () => {
    expect(paiseToRupeeInput(49950)).toBe('499.50');
    expect(paiseToRupeeInput(50000)).toBe('500');
    expect(paiseToRupeeInput(5)).toBe('0.05');
    expect(paiseToRupeeInput(0)).toBe('0');
  });

  it('round-trips a fee with paise without multiplying it', () => {
    expect(rupeeInputToPaise(paiseToRupeeInput(49950))).toBe(49950);
    expect(rupeeInputToPaise('499.5')).toBe(49950);
    expect(rupeeInputToPaise('1,250.75')).toBe(125075);
    expect(rupeeInputToPaise('500.')).toBe(50000);
  });

  it('keeps typing to digits, one dot and two decimals', () => {
    expect(sanitizeRupeeInput('₹ 499.505')).toBe('499.50');
    expect(sanitizeRupeeInput('4.9.9')).toBe('4.99');
    expect(sanitizeRupeeInput('abc')).toBe('');
  });

  it('accepts a free (₹0) consultation and rejects junk (06·Profile F4)', () => {
    expect(feeError('0', 'Fee')).toBeUndefined();
    expect(rupeeInputToPaise('0')).toBe(0);
    expect(feeError('', 'Fee')).toMatch(/required/);
    expect(feeError('.', 'Fee')).toMatch(/amount/);
  });
});

describe('working-hours checks (06·Profile F6)', () => {
  const day = (from: string, to: string, on = true): WeekDay => ({
    day: 'Mon',
    on,
    from,
    to,
    patternIds: [],
  });

  it('flags a day whose end is not after its start', () => {
    expect(weekErrors([day('9:00 am', '5:00 pm'), day('5:00 pm', '9:00 am')])).toEqual({
      1: 'The end time must be after the start time.',
    });
  });

  it('ignores closed days and days run on patterns', () => {
    expect(
      weekErrors([
        day('5:00 pm', '9:00 am', false),
        { ...day('5:00 pm', '9:00 am'), patternIds: ['p'] },
      ]),
    ).toEqual({});
  });
});

describe('time pickers cover the whole day (UAT-50)', () => {
  it('offers every quarter hour from midnight to 11:45 pm', () => {
    expect(TIME_OPTS).toHaveLength(96);
    expect(TIME_OPTS[0]).toBe('12:00 am');
    expect(TIME_OPTS).toContain('7:15 am');
    expect(TIME_OPTS).toContain('9:30 pm');
    expect(TIME_OPTS[TIME_OPTS.length - 1]).toBe('11:45 pm');
    expect(END_OF_DAY_LABEL).toBe('11:59 pm');
  });

  it('adds a stored off-grid time in order', () => {
    const options = timeOptionsWith('9:10 am');
    expect(options.indexOf('9:10 am')).toBe(options.indexOf('9:00 am') + 1);
  });
});
