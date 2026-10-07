import { describe, expect, it } from 'vitest';

import { csvRowCount, filterCsvRows } from '@/shared/lib/csv';

const FILE = [
  'captured_at,patient_name,channel,reference_note',
  '2026-10-06T09:00:00Z,Asha Menon,desk,',
  '2026-10-06T09:05:00Z,"Kumar, Ravi",online,"note with ""quotes"""',
  '2026-10-06T09:10:00Z,Meera,desk,"two',
  'lines"',
  '',
].join('\r\n');

describe('filterCsvRows', () => {
  it('keeps the header and only the rows whose column matches, unchanged', () => {
    const desk = filterCsvRows(FILE, 'channel', (v) => v === 'desk');
    expect(desk.total).toBe(3);
    expect(desk.kept).toBe(2);
    expect(desk.csv).toBe(
      [
        'captured_at,patient_name,channel,reference_note',
        '2026-10-06T09:00:00Z,Asha Menon,desk,',
        '2026-10-06T09:10:00Z,Meera,desk,"two\r\nlines"',
        '',
      ].join('\r\n'),
    );
  });

  it('reads quoted commas and doubled quotes as part of the field', () => {
    const online = filterCsvRows(FILE, 'channel', (v) => v === 'online');
    expect(online.kept).toBe(1);
    expect(online.csv).toContain('"Kumar, Ravi",online,"note with ""quotes"""');
  });

  it('handles LF-only files', () => {
    const lf = 'a,channel\n1,desk\n2,online\n';
    expect(filterCsvRows(lf, 'channel', (v) => v === 'online').csv).toBe(
      'a,channel\r\n2,online\r\n',
    );
  });

  it('returns a file without the column unchanged', () => {
    const other = 'a,b\r\n1,2\r\n';
    expect(filterCsvRows(other, 'channel', () => false)).toEqual({ csv: other, total: 1, kept: 1 });
  });
});

describe('csvRowCount', () => {
  it('counts data rows, not the header or a multi-line field’s lines', () => {
    expect(csvRowCount(FILE)).toBe(3);
    expect(csvRowCount('only,a,header\r\n')).toBe(0);
    expect(csvRowCount('')).toBe(0);
  });
});
