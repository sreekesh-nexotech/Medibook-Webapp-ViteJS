import { describe, expect, it } from 'vitest';

import {
  bookingFormatProblem,
  numberingFormatProblem,
  tokenFormatProblem,
} from '@/features/ops-hospitals/presentation/components/hospitalSettings.view';

describe('numberingFormatProblem', () => {
  it('accepts the documented tokens with one sequence', () => {
    expect(numberingFormatProblem('{PREFIX}-{FY}-{SEQ:6}')).toBeNull();
    expect(numberingFormatProblem('MRN{YYYY}{MM}{SEQ:4}')).toBeNull();
    expect(numberingFormatProblem('R-{SEQ}')).toBeNull();
  });

  it('refuses unknown tokens, missing or duplicate sequences, bad widths and stray braces', () => {
    expect(numberingFormatProblem('{PREFIX}{DOC}{SEQ:4}')).toBe('Unknown token {DOC}.');
    expect(numberingFormatProblem('{PREFIX}')).toBe('Use exactly one {SEQ:n}.');
    expect(numberingFormatProblem('{SEQ:4}{SEQ:2}')).toBe('Use exactly one {SEQ:n}.');
    expect(numberingFormatProblem('{SEQ:13}')).toBe('{SEQ:n} takes a width from 1 to 12.');
    expect(numberingFormatProblem('{SEQ:4}}')).toBe('A brace is not closed.');
    expect(numberingFormatProblem('  ')).toBe('Enter a format.');
  });
});

describe('tokenFormatProblem', () => {
  it('accepts the token-label tokens, including the online marker', () => {
    expect(tokenFormatProblem('{SRC}{SEQ:3}')).toBeNull();
    expect(tokenFormatProblem('{DEPT}-{SRC}{SEQ:3}')).toBeNull();
  });

  it('refuses tokens that only numbering formats know', () => {
    expect(tokenFormatProblem('{FY}{SEQ:3}')).toBe('Unknown token {FY}.');
  });
});

describe('bookingFormatProblem (H-02)', () => {
  it('needs {PREFIX} first, then a separator', () => {
    expect(bookingFormatProblem('{PREFIX}-{YY}{MM}-{SEQ:5}')).toBeNull();
    expect(bookingFormatProblem('{PREFIX}B{SEQ:6}')).not.toBeNull();
    expect(bookingFormatProblem('B-{PREFIX}-{SEQ:6}')).not.toBeNull();
  });
});
