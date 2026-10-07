import { describe, expect, it } from 'vitest';

import type { Failure } from '@/core/error/failure';
import { clientFailure } from '@/core/error/toFailure';

import { describeFailure, mapServerErrors, serverKeyLabel } from '@/shared/lib/serverErrors';

function validation(fieldErrors: Failure['fieldErrors']): Failure {
  return {
    kind: 'validation',
    message: 'Some fields are invalid.',
    code: 'VALIDATION_ERROR',
    status: 400,
    fieldErrors,
    requestId: 'req-1',
    meta: {},
  };
}

describe('mapServerErrors (UAT-48)', () => {
  it('puts the first message of each mapped key under its form field', () => {
    const mapped = mapServerErrors(
      validation({ code: ['Already exists.', 'Too long.'], name: ['Required.'] }),
      { fields: { code: 'code', name: 'name' } },
    );
    expect(mapped.fields).toEqual({ code: 'Already exists.', name: 'Required.' });
    expect(mapped.summary).toEqual([]);
    expect(mapped.fieldCount).toBe(2);
    expect(mapped.headline).toBe('Check the 2 highlighted problems — Code: Already exists.');
  });

  it('matches nested and per-series keys by their longest mapped prefix', () => {
    const mapped = mapServerErrors(
      validation({
        'booking.prefix': ['Another hospital uses this prefix.'],
        'scopes.1.service_id': ['Unknown service.'],
      }),
      { fields: { 'booking.prefix': 'bookingPrefix', booking: 'bookingFormat', scopes: 'scopes' } },
    );
    expect(mapped.fields).toEqual({
      bookingPrefix: 'Another hospital uses this prefix.',
      scopes: 'Unknown service.',
    });
  });

  it('sends unmapped, request-level and header errors to a labelled summary', () => {
    const mapped = mapServerErrors(
      validation({
        non_field_errors: ['The ranges overlap.'],
        'mrn.format': ['Unknown token(s): XX.'],
        'If-Match': ['This header is required (the record version).'],
      }),
      { fields: { name: 'name' }, labels: { mrn: 'MRN' } },
    );
    expect(mapped.fields).toEqual({});
    expect(mapped.summary).toEqual([
      'The ranges overlap.',
      'MRN › Format: Unknown token(s): XX.',
      expect.stringContaining('did not say which version you edited'),
    ]);
    expect(mapped.headline).toBe('The ranges overlap. (and 2 more)');
  });

  it('accepts a function for computed field names', () => {
    const mapped = mapServerErrors(
      validation({ 'hours.2.closes_at': ['Must be after opens_at.'] }),
      {
        fields: (key) => (key.startsWith('hours.') ? `day${key.split('.')[1]}` : undefined),
      },
    );
    expect(mapped.fields).toEqual({ day2: 'Must be after opens_at.' });
  });

  it('keeps the failure’s own message for errors without fields', () => {
    const conflict: Failure = {
      ...validation({}),
      kind: 'conflict',
      status: 409,
      code: 'NUMBERING_LOCKED',
      message: 'This series has already allocated numbers and its format is locked.',
    };
    const mapped = mapServerErrors(conflict, { fields: { format: 'format' } });
    expect(mapped.fields).toEqual({});
    expect(mapped.summary).toEqual([]);
    expect(mapped.headline).toBe(conflict.message);
  });
});

describe('serverKeyLabel', () => {
  it('humanizes snake_case paths and list indexes', () => {
    expect(serverKeyLabel('lines.0.amount_paise')).toBe('Lines › item 1 › Amount paise');
  });

  it('prefers a labelled prefix', () => {
    expect(serverKeyLabel('receipt.pad_width', { receipt: 'Receipt number' })).toBe(
      'Receipt number › Pad width',
    );
  });
});

describe('describeFailure', () => {
  it('names the first field instead of the envelope message', () => {
    expect(describeFailure(validation({ code: ['Already exists.'] }), 'fallback')).toBe(
      'Code: Already exists.',
    );
  });

  it('passes other failures through and falls back for unknown errors', () => {
    const failure = clientFailure('conflict', 'Changed by someone else.');
    expect(describeFailure(failure, 'fallback')).toBe('Changed by someone else.');
    expect(describeFailure(new Error('x'), 'fallback')).toBe('fallback');
  });
});
