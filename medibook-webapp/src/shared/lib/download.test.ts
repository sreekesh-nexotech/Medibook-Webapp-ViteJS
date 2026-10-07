import { describe, expect, it } from 'vitest';

import { neutraliseCsvFormula, toCsv } from '@/shared/lib/download';

describe('neutraliseCsvFormula (UAT-75)', () => {
  it.each(['=HYPERLINK("http://x","y")', '+SUM(A1)', '-1+1', '@cmd', '\tTAB', '\rCR'])(
    'prefixes %j so it opens as text',
    (cell) => {
      expect(neutraliseCsvFormula(cell)).toBe(`'${cell}`);
    },
  );

  it('leaves ordinary text, numbers and numeric strings alone', () => {
    expect(neutraliseCsvFormula('Asha Rao')).toBe('Asha Rao');
    expect(neutraliseCsvFormula(-250)).toBe('-250');
    expect(neutraliseCsvFormula('-250')).toBe('-250');
    expect(neutraliseCsvFormula('+12.50')).toBe('+12.50');
    expect(neutraliseCsvFormula('a=b')).toBe('a=b');
  });

  it('turns nullish cells into empty text', () => {
    expect(neutraliseCsvFormula(null)).toBe('');
    expect(neutraliseCsvFormula(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('quotes every cell, doubles quotes and neutralises formulas', () => {
    expect(
      toCsv([
        ['Name', 'Amount'],
        ['=1+"2"', -5],
      ]),
    ).toBe('"Name","Amount"\r\n"\'=1+""2""","-5"');
  });
});
