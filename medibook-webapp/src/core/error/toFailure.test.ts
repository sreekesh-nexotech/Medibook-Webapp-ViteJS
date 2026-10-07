import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { clientFailure, isHospitalWriteBlock, toFailure } from '@/core/error/toFailure';

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response: AxiosResponse = { status, statusText: '', data, headers: {}, config };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, null, response);
}

function envelope(code: string, message: string, extra: Record<string, unknown> = {}) {
  return { code, message, errors: {}, request_id: 'req-1', meta: {}, ...extra };
}

describe('toFailure', () => {
  it('reports a request that never got a response as a network failure', () => {
    const error = new AxiosError('Network Error', AxiosError.ERR_NETWORK, {
      headers: new AxiosHeaders(),
    });
    const failure = toFailure(error);
    expect(failure.kind).toBe('network');
    expect(failure.status).toBeNull();
  });

  it('maps each status to the kind screens branch on', () => {
    const kinds: readonly [number, string][] = [
      [400, 'validation'],
      [401, 'unauthorized'],
      [403, 'forbidden'],
      [404, 'notFound'],
      [409, 'conflict'],
      [412, 'conflict'],
      [423, 'rateLimited'],
      [429, 'rateLimited'],
      [500, 'server'],
      [503, 'server'],
      [418, 'unknown'],
    ];
    for (const [status, kind] of kinds) {
      expect(toFailure(httpError(status, envelope('X', 'x'))).kind, String(status)).toBe(kind);
    }
  });

  it('passes the backend message, code, request id and field errors through on a 4xx', () => {
    const failure = toFailure(
      httpError(
        400,
        envelope('VALIDATION_ERROR', 'Some details need fixing.', {
          errors: { name: ['This field is required.'], pincode: 'Enter 6 digits.' },
          meta: { max_bytes: 10 },
        }),
      ),
    );
    expect(failure).toMatchObject({
      kind: 'validation',
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Some details need fixing.',
      requestId: 'req-1',
      meta: { max_bytes: 10 },
      fieldErrors: { name: ['This field is required.'], pincode: ['Enter 6 digits.'] },
    });
  });

  it('flattens nested and per-item field errors into dotted paths (UAT-48)', () => {
    const failure = toFailure(
      httpError(
        400,
        envelope('VALIDATION_ERROR', 'Some fields are invalid.', {
          errors: {
            booking: { prefix: ['Another hospital already uses this prefix.'] },
            lines: [{}, { amount_paise: ['Must be positive.'] }],
            scopes: ['Pick at least one.', { service_id: 'Unknown service.' }],
            'If-Match': ['This header is required (the record version).'],
          },
        }),
      ),
    );
    expect(failure.fieldErrors).toEqual({
      'booking.prefix': ['Another hospital already uses this prefix.'],
      'lines.1.amount_paise': ['Must be positive.'],
      scopes: ['Pick at least one.'],
      'scopes.1.service_id': ['Unknown service.'],
      'If-Match': ['This header is required (the record version).'],
    });
  });

  it('never shows a server error’s own message to the user', () => {
    const failure = toFailure(httpError(500, envelope('INTERNAL', 'Traceback: db password…')));
    expect(failure.kind).toBe('server');
    expect(failure.message).not.toContain('Traceback');
    expect(failure.code).toBe('INTERNAL');
  });

  it('still maps a status when the body is not the error envelope (e.g. a proxy page)', () => {
    const failure = toFailure(httpError(502, '<html>Bad gateway</html>'));
    expect(failure.kind).toBe('server');
    expect(failure.status).toBe(502);
    expect(failure.code).toBeNull();
  });

  it('reports a response that fails schema validation as a parse failure', () => {
    const result = z.object({ id: z.string() }).safeParse({ id: 1 });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFailure(result.error).kind).toBe('parse');
  });

  it('returns an existing failure unchanged', () => {
    const failure = clientFailure('validation', 'The file is too large.', 'FILE_TOO_LARGE');
    expect(toFailure(failure)).toBe(failure);
  });

  it('treats anything else as unknown', () => {
    expect(toFailure(new Error('boom')).kind).toBe('unknown');
  });
});

describe('hospital write blocks (UAT-38)', () => {
  it('words a read-only hospital as such, not as a permission problem', () => {
    const failure = toFailure(
      httpError(403, envelope('HOSPITAL_READ_ONLY', 'This hospital is in read-only mode.')),
    );
    expect(failure.kind).toBe('forbidden');
    expect(failure.message).toContain('read-only until its Medibook subscription is paid');
    expect(isHospitalWriteBlock(failure)).toBe(true);
  });

  it('words a suspended hospital, and leaves other 403s alone', () => {
    const suspended = toFailure(httpError(403, envelope('HOSPITAL_SUSPENDED', 'Suspended.')));
    expect(suspended.message).toContain('suspended by Medibook operations');
    expect(isHospitalWriteBlock(suspended)).toBe(true);
    const denied = toFailure(httpError(403, envelope('PERMISSION_DENIED', 'No.')));
    expect(denied.message).toBe('No.');
    expect(isHospitalWriteBlock(denied)).toBe(false);
  });
});

describe('clientFailure', () => {
  it('builds a failure for a check made before any request', () => {
    expect(clientFailure('validation', 'The file is too large.', 'FILE_TOO_LARGE')).toMatchObject({
      kind: 'validation',
      message: 'The file is too large.',
      code: 'FILE_TOO_LARGE',
      status: null,
    });
  });
});
