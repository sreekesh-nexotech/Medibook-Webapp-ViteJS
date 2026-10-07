import { describe, expect, it } from 'vitest';

import {
  bookingSeriesErrors,
  bpToPercentInput,
  durationCopy,
  fiscalYearToken,
  formatError,
  labelShowsSource,
  labelsCollideAcrossDepartments,
  NUMBERING_TOKENS,
  numberingLiteralText,
  numberingPeriodError,
  percentInputToBp,
  renderNumberingSample,
  renderTokenLabel,
  TOKEN_LABEL_TOKENS,
  type TokenSampleInput,
} from '@/features/settings/application/store/settings.rules';

const sample = (over: Partial<TokenSampleInput> = {}): TokenSampleInput => ({
  format: '{SRC}{SEQ:3}',
  prefix: '',
  onlineMarker: 'A',
  offlineMarker: 'W',
  seq: 7,
  source: 'online',
  doctorCode: 'rk',
  departmentCode: 'card',
  date: '2026-10-07',
  ...over,
});

describe('durationCopy', () => {
  it('reads minutes and hours', () => {
    expect(durationCopy(45)).toBe('45 min');
    expect(durationCopy(60)).toBe('1 h');
    expect(durationCopy(90)).toBe('1 h 30 min');
  });
});

describe('percent ↔ basis points', () => {
  it('shows basis points as a percent input', () => {
    expect(bpToPercentInput(10_000)).toBe('100');
    expect(bpToPercentInput(2550)).toBe('25.5');
    expect(bpToPercentInput(2505)).toBe('25.05');
    expect(bpToPercentInput(0)).toBe('0');
  });

  it('parses a 0–100 percentage exactly, refusing anything else', () => {
    expect(percentInputToBp('25.5')).toBe(2550);
    expect(percentInputToBp('100')).toBe(10_000);
    expect(percentInputToBp('0')).toBe(0);
    expect(percentInputToBp('100.01')).toBeNull();
    expect(percentInputToBp('abc')).toBeNull();
  });
});

describe('formatError (UAT-27, D-25)', () => {
  it('accepts the decision-8 default and full token formats', () => {
    expect(formatError('{SRC}{SEQ:3}', TOKEN_LABEL_TOKENS)).toBeUndefined();
    expect(formatError('{DEPT}-{DOC}-{SEQ}-{DATE:DDMM}', TOKEN_LABEL_TOKENS)).toBeUndefined();
    expect(formatError('{PREFIX}/{FY}/{SEQ:5}', NUMBERING_TOKENS)).toBeUndefined();
  });

  it('refuses placeholders the backend does not know', () => {
    expect(formatError('{SRC}{SEQ}', NUMBERING_TOKENS)).toBe('Unknown placeholder: {SRC}.');
    expect(formatError('{FY}{SEQ}', TOKEN_LABEL_TOKENS)).toBe('Unknown placeholder: {FY}.');
  });

  it('needs exactly one sequence with a sane width', () => {
    expect(formatError('{PREFIX}', NUMBERING_TOKENS)).toMatch(/exactly one/);
    expect(formatError('{SEQ}{SEQ}', NUMBERING_TOKENS)).toMatch(/exactly one/);
    expect(formatError('{SEQ:13}', NUMBERING_TOKENS)).toMatch(/between 1 and 12/);
    expect(formatError('{SEQ:0}', NUMBERING_TOKENS)).toMatch(/between 1 and 12/);
  });

  it('refuses empty formats and stray braces', () => {
    expect(formatError('  ', NUMBERING_TOKENS)).toMatch(/Enter a format/);
    expect(formatError('{SEQ}}', NUMBERING_TOKENS)).toBe('Check the braces in the format.');
    expect(formatError('{seq}{SEQ}', NUMBERING_TOKENS)).toBe('Check the braces in the format.');
  });
});

describe('renderTokenLabel (allocator.render_label)', () => {
  it('renders the default format per source', () => {
    expect(renderTokenLabel(sample())).toBe('A007');
    expect(renderTokenLabel(sample({ source: 'desk', seq: 12 }))).toBe('W012');
  });

  it('does not pad a bare {SEQ}', () => {
    expect(renderTokenLabel(sample({ format: '{SEQ}', seq: 4 }))).toBe('4');
  });

  it('upper-cases the doctor and department codes and formats the date', () => {
    expect(renderTokenLabel(sample({ format: '{DEPT}-{DOC}-{SEQ:2}-{DATE}', prefix: 'T' }))).toBe(
      'CARD-RK-07-0710',
    );
    expect(renderTokenLabel(sample({ format: '{PREFIX}{DATE:YYMMDD}{SEQ}', prefix: 'T' }))).toBe(
      'T2610077',
    );
  });

  it('warns when labels could read alike', () => {
    expect(labelsCollideAcrossDepartments('{SRC}{SEQ:3}')).toBe(true);
    expect(labelsCollideAcrossDepartments('{DEPT}{SEQ:3}')).toBe(false);
    expect(labelShowsSource('{SRC}{SEQ:3}', 'A', 'W')).toBe(true);
    expect(labelShowsSource('{SRC}{SEQ:3}', 'A', 'A')).toBe(false);
    expect(labelShowsSource('{SEQ:3}', 'A', 'W')).toBe(false);
  });
});

describe('numbering samples (numbering.render)', () => {
  it('labels the fiscal year from its start month', () => {
    expect(fiscalYearToken('2026-10-07', 4)).toBe('26-27');
    expect(fiscalYearToken('2026-03-31', 4)).toBe('25-26');
    expect(fiscalYearToken('2026-01-15', 1)).toBe('26-27');
    expect(fiscalYearToken('2099-06-01', 4)).toBe('99-00');
  });

  it('pads the sequence to the series width unless the format names one', () => {
    const base = {
      prefix: 'RC',
      padWidth: 6,
      fyStartMonth: 4,
      seq: 42,
      date: '2026-10-07',
    } as const;
    expect(renderNumberingSample({ ...base, format: '{PREFIX}/{FY}/{SEQ}' })).toBe(
      'RC/26-27/000042',
    );
    expect(renderNumberingSample({ ...base, format: '{PREFIX}{YYYY}{MM}-{SEQ:3}' })).toBe(
      'RC202610-042',
    );
    expect(renderNumberingSample({ ...base, prefix: null, format: '{PREFIX}{YY}{SEQ:4}' })).toBe(
      '260042',
    );
  });
});

describe('numbering series rules (B4: M-21, H-02)', () => {
  it('needs the period a resetting series restarts in', () => {
    expect(numberingPeriodError('{PREFIX}{SEQ:5}', 'never', 4)).toBeUndefined();
    expect(numberingPeriodError('{PREFIX}/{FY}/{SEQ}', 'fiscal_year', 4)).toBeUndefined();
    expect(numberingPeriodError('{PREFIX}{YYYY}{MM}{SEQ}', 'fiscal_year', 4)).toBeUndefined();
    expect(numberingPeriodError('{PREFIX}{YYYY}{SEQ}', 'fiscal_year', 1)).toBeUndefined();
    expect(numberingPeriodError('{PREFIX}{YYYY}{SEQ}', 'fiscal_year', 4)).toMatch(/\{FY\}/);
    expect(numberingPeriodError('{PREFIX}{SEQ}', 'calendar_year', 4)).toMatch(/\{YYYY\}/);
    expect(numberingPeriodError('{FY}{MM}{SEQ}', 'calendar_year', 4)).toBeUndefined();
    expect(numberingPeriodError('{YY}{SEQ}', 'monthly', 4)).toMatch(/\{MM\}/);
    expect(numberingPeriodError('{YY}{MM}{SEQ}', 'monthly', 4)).toBeUndefined();
  });

  it('keeps booking references unique across hospitals', () => {
    expect(bookingSeriesErrors('{PREFIX}-{YY}-{SEQ:6}', 'CC')).toEqual({});
    expect(bookingSeriesErrors('{PREFIX}{SEQ:6}', 'CC').format).toMatch(/separator/);
    expect(bookingSeriesErrors('BK-{SEQ:6}', 'CC').format).toBeDefined();
    expect(bookingSeriesErrors('{PREFIX}-{SEQ}', '').prefix).toMatch(/1–16/);
    expect(bookingSeriesErrors('{PREFIX}-{SEQ}', 'C-C').prefix).toBeDefined();
  });

  it('compares the fixed text of two formats', () => {
    expect(numberingLiteralText('{PREFIX}-{SEQ:5}')).toBe(numberingLiteralText('{PREFIX}-{SEQ}'));
    expect(numberingLiteralText('{PREFIX}-{SEQ}')).not.toBe(numberingLiteralText('{PREFIX}/{SEQ}'));
  });
});
