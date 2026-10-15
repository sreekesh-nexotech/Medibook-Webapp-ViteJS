import { describe, expect, it } from 'vitest';

import { clientFailure } from '@/core/error/toFailure';

import { reportFailureText } from '@/features/reports/presentation/components/reportsFormat';

describe('reportFailureText', () => {
  it('shows the field sentences behind a generic validation message (B7 M-39)', () => {
    const failure = {
      ...clientFailure('validation', 'Some details need fixing.'),
      fieldErrors: {
        created_to: ['The range may span at most 1830 days.'],
        created_from: ['Must be between 2000-01-01 and 2100-12-31.'],
      },
    };
    expect(reportFailureText(failure, 'x')).toBe(
      'The range may span at most 1830 days. Must be between 2000-01-01 and 2100-12-31.',
    );
  });

  it('keeps the server message otherwise, and the fallback for non-failures', () => {
    const tooLarge = clientFailure('validation', 'Narrow the filters.', 'REPORT_TOO_LARGE');
    expect(reportFailureText(tooLarge, 'x')).toBe('Narrow the filters.');
    expect(reportFailureText(new Error('boom'), 'fallback')).toBe('fallback');
  });
});
