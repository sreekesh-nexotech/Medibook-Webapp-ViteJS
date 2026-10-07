import { describe, expect, it } from 'vitest';

import {
  calendarDay,
  financialYearToken,
  renderSeriesNumber,
  renderTokenLabel,
  seqOfNumber,
  seriesFormatProblem,
  tokenFormatProblem,
} from '@/features/settings/application/store/settings.rules';

const OCT_7 = calendarDay('2026-10-07');

function label(format: string, marker = 'W', seq = 7): string {
  return renderTokenLabel(format, {
    prefix: 'T',
    marker,
    seq,
    doctorCode: 'dr-anita',
    departmentCode: 'card',
    date: OCT_7,
  });
}

describe('renderTokenLabel (backend render_label)', () => {
  it('pads {SEQ:n}, leaves {SEQ} as is and prints the source marker', () => {
    expect(label('{SRC}{SEQ:3}')).toBe('W007');
    expect(label('{SRC}{SEQ:3}', 'A')).toBe('A007');
    expect(label('{PREFIX}-{SEQ}', 'W', 42)).toBe('T-42');
  });

  it('upper-cases the doctor and department codes', () => {
    expect(label('{DEPT}/{DOC}/{SEQ:2}')).toBe('CARD/DR-ANITA/07');
  });

  it('prints the date as DDMM unless a pattern is given', () => {
    expect(label('{DATE}-{SEQ}')).toBe('0710-7');
    expect(label('{DATE:YYYYMMDD}-{SEQ}')).toBe('20261007-7');
    expect(label('{DATE:YYMM}-{SEQ}')).toBe('2610-7');
  });
});

describe('tokenFormatProblem (backend validate_label_format)', () => {
  it('accepts a format with one number', () => {
    expect(tokenFormatProblem('{SRC}{SEQ:3}')).toBeNull();
  });

  it('refuses no number, two numbers and unknown placeholders', () => {
    expect(tokenFormatProblem('{PREFIX}')).toMatch(/exactly once/);
    expect(tokenFormatProblem('{SEQ}-{SEQ:3}')).toMatch(/exactly once/);
    expect(tokenFormatProblem('{SEQ}{FY}')).toBe('Unknown placeholder: {FY}.');
  });
});

describe('seriesFormatProblem (backend numbering.validate_format)', () => {
  it('accepts the seeded formats', () => {
    expect(seriesFormatProblem('{PREFIX}/{FY}/{SEQ:5}')).toBeNull();
    expect(seriesFormatProblem('{PREFIX}-{YY}{MM}-{SEQ:5}')).toBeNull();
  });

  it('refuses bad digit counts, unknown placeholders and stray braces', () => {
    expect(seriesFormatProblem('{SEQ:13}')).toMatch(/1 to 12 digits/);
    expect(seriesFormatProblem('{SEQ}{SRC}')).toBe('Unknown placeholder: {SRC}.');
    expect(seriesFormatProblem('{PREFIX}-{SEQ}}')).toBe('A brace is not closed.');
    expect(seriesFormatProblem('{PREFIX}')).toMatch(/exactly once/);
  });
});

describe('renderSeriesNumber (backend numbering.render)', () => {
  const parts = { prefix: 'EXMR', padWidth: 4, fyStartMonth: 4, date: OCT_7 };

  it('renders the seeded receipt, booking and MRN formats', () => {
    expect(renderSeriesNumber('{PREFIX}/{FY}/{SEQ:5}', { ...parts, seq: 170 })).toBe(
      'EXMR/26-27/00170',
    );
    expect(
      renderSeriesNumber('{PREFIX}-{YY}{MM}-{SEQ:5}', { ...parts, prefix: 'EXMB', seq: 227 }),
    ).toBe('EXMB-2610-00227');
    expect(renderSeriesNumber('{PREFIX}{SEQ:6}', { ...parts, prefix: 'EXMM', seq: 44 })).toBe(
      'EXMM000044',
    );
  });

  it('pads a bare {SEQ} to the series width', () => {
    expect(renderSeriesNumber('{PREFIX}-{YYYY}-{SEQ}', { ...parts, seq: 9 })).toBe(
      'EXMR-2026-0009',
    );
  });
});

describe('financialYearToken', () => {
  it('follows the start month', () => {
    expect(financialYearToken(calendarDay('2026-03-31'), 4)).toBe('25-26');
    expect(financialYearToken(calendarDay('2026-04-01'), 4)).toBe('26-27');
    expect(financialYearToken(calendarDay('2026-01-15'), 1)).toBe('26-27');
  });
});

describe('seqOfNumber', () => {
  it('reads the running number back out of a rendered number', () => {
    expect(seqOfNumber('{PREFIX}/{FY}/{SEQ:5}', 'EXMR', 'EXMR/26-27/00170')).toBe(170);
    expect(seqOfNumber('{PREFIX}-{YY}{MM}-{SEQ:5}', 'EXMB', 'EXMB-2610-00227')).toBe(227);
  });

  it('gives up when the number does not match the format', () => {
    expect(seqOfNumber('{PREFIX}/{FY}/{SEQ:5}', 'EXMR', 'OTHER/26-27/00170')).toBeNull();
  });

  it('treats prefix characters literally', () => {
    expect(seqOfNumber('{PREFIX}{SEQ}', 'A.B', 'A.B12')).toBe(12);
    expect(seqOfNumber('{PREFIX}{SEQ}', 'A.B', 'AxB12')).toBeNull();
  });
});
