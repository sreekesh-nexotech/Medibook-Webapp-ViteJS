import { describe, expect, it } from 'vitest';

import { neutraliseCsvFormula, neutraliseFormula, toCsv } from '@/shared/lib/download';

describe('neutraliseCsvFormula (UAT-75)', () => {
  it.each(['=HYPERLINK("http://x","y")', '+SUM(A1)', '-1+1', '@cmd', '\tTAB', '\rCR'])(
    'prefixes %j so it opens as text',
    (cell: string) => {
      expect(neutraliseCsvFormula(cell)).toBe(`'${cell}`);
    },
  );

  it('leaves ordinary text, numbers and numeric strings alone', () => {
    expect(neutraliseCsvFormula('Asha Rao')).toBe('Asha Rao');
    expect(neutraliseCsvFormula(-250)).toBe('-250');
    expect(neutraliseCsvFormula('+12.50')).toBe('+12.50');
    expect(neutraliseCsvFormula('a=b')).toBe('a=b');
  });

  it('turns nullish cells into empty text', () => {
    expect(neutraliseCsvFormula(null)).toBe('');
    expect(neutraliseCsvFormula(undefined)).toBe('');
  });
});

describe('neutraliseFormula (PHI-04)', () => {
  it.each(['=1+1', '+cmd|calc', '-2+3', '@SUM(A1:A2)', '\tleading tab', '\rleading return'])(
    'turns %j into text',
    (cell: string) => {
      expect(neutraliseFormula(cell)).toBe(`'${cell}`);
    },
  );

  it('leaves plain numbers and ordinary text alone', () => {
    expect(neutraliseFormula('-500.00')).toBe('-500.00');
    expect(neutraliseFormula('+919876543210')).toBe('+919876543210');
    expect(neutraliseFormula('Ravi Kumar')).toBe('Ravi Kumar');
    expect(neutraliseFormula('')).toBe('');
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

  it('quotes every cell, doubles quotes and neutralises formulas in text', () => {
    expect(toCsv([['=HYPERLINK("https://x.example","Click")', -500, null, 'a,b']])).toBe(
      '"\'=HYPERLINK(""https://x.example"",""Click"")","-500","","a,b"',
    );
  });
});
