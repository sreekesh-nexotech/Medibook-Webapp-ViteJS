import { describe, expect, it } from 'vitest';

import { neutraliseFormula, toCsv } from '@/shared/lib/download';

describe('neutraliseFormula (PHI-04)', () => {
  it.each(['=1+1', '+cmd|calc', '-2+3', '@SUM(A1:A2)', '\tleading tab', '\rleading return'])(
    'turns %j into text',
    (cell) => {
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
  it('quotes every cell, doubles quotes and neutralises formulas in text', () => {
    expect(toCsv([['=HYPERLINK("https://x.example","Click")', -500, null, 'a,b']])).toBe(
      '"\'=HYPERLINK(""https://x.example"",""Click"")","-500","","a,b"',
    );
  });
});
