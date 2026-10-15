import { describe, expect, it } from 'vitest';

import type { OpsReportFilter } from '@/features/ops-reports/domain/entities/opsReports.types';
import { cleanParams } from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.api';
import {
  toOpsReportSummary,
  toReportSchedule,
} from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.response';
import {
  describeParams,
  fieldErrorLine,
  formatReportValue,
  parseRecipients,
  validateReportParams,
} from '@/features/ops-reports/presentation/components/opsReportsFormat';

const FILTERS: readonly OpsReportFilter[] = [
  {
    key: 'booking_date',
    label: 'Booking date',
    kind: 'date_range',
    params: ['booking_date_from', 'booking_date_to'],
    choices: [],
  },
  { key: 'hospital', label: 'Hospital', kind: 'uuid', params: ['hospital_id'], choices: [] },
  {
    key: 'status',
    label: 'Status',
    kind: 'choice',
    params: ['status'],
    choices: ['completed', 'no_show'],
  },
];

describe('catalogue mapping', () => {
  it('keeps the sheet filters the old schema stripped', () => {
    const summary = toOpsReportSummary({
      code: 'bookings',
      title: 'Bookings Report',
      filters: [
        { key: 'hospital', label: 'Hospital', kind: 'uuid', params: ['hospital_id'] },
        'legacy_param',
      ],
      columns: [],
      formats: ['csv', 'xlsx', 'pdf'],
      notes: [],
    });
    expect(summary.filters[0]).toEqual({
      key: 'hospital',
      label: 'Hospital',
      kind: 'uuid',
      params: ['hospital_id'],
      choices: [],
    });
    expect(summary.filters[1]?.params).toEqual(['legacy_param']);
  });
});

describe('report filters', () => {
  it('sends only filled-in params', () => {
    expect(cleanParams({ status: 'completed', hospital_id: ' ', booking_date_from: '' })).toEqual({
      status: 'completed',
    });
  });

  it('catches a reversed range and a partial id before the run', () => {
    expect(
      validateReportParams(FILTERS, {
        booking_date_from: '2026-10-07',
        booking_date_to: '2026-10-01',
        hospital_id: '01a1174e',
      }),
    ).toEqual({
      booking_date_to: 'Booking date: the end is before the start.',
      hospital_id: 'Hospital: paste the full id (a UUID).',
    });
  });

  it('describes what is filtered', () => {
    expect(describeParams(FILTERS, {})).toMatch(/whole platform history/);
    expect(
      describeParams(FILTERS, { status: 'no_show', hospital_id: 'h1' }, (f, v) =>
        f.key === 'hospital' ? `Lakeshore (${v})` : v,
      ),
    ).toBe('Hospital: Lakeshore (h1) · Status: No-show');
  });

  it('joins the backend field errors (B7 span limit) into one line', () => {
    expect(fieldErrorLine({ booking_date_to: ['The range may span at most 1830 days.'] })).toBe(
      'The range may span at most 1830 days.',
    );
  });
});

describe('values', () => {
  it('formats paise as rupees and enum codes as labels', () => {
    expect(formatReportValue(150000, 'paise')).toContain('1,500');
    expect(formatReportValue('no_show', 'str')).toBe('No-show');
    expect(formatReportValue('Lakeshore Multispeciality', 'str')).toBe('Lakeshore Multispeciality');
    expect(formatReportValue(null, 'int')).toBe('—');
  });
});

describe('schedules', () => {
  it('parses recipients and stops at the first bad address', () => {
    expect(parseRecipients('A@x.in, b@y.in; a@x.in')).toEqual({ emails: ['a@x.in', 'b@y.in'] });
    expect(parseRecipients('a@x.in nope')).toEqual({ invalid: 'nope' });
  });

  it('maps a schedule from an older backend without version or run fields', () => {
    const s = toReportSchedule({
      id: 's1',
      report_code: 'revenue',
      report_title: 'Revenue Report',
      scope: 'platform',
      hospital_id: null,
      cadence: 'weekly',
      format: 'xlsx',
      recipients: ['farah.khan@medibook.example.com'],
      is_active: true,
      last_sent_at: null,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
    });
    expect(s.version).toBeNull();
    expect(s.lastStatus).toBeNull();
    expect(s.usesDefaultRecipients).toBe(false);
  });
});
