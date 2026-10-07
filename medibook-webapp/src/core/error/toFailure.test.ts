import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { referenceOf } from '@/core/error/reference';
import { clientFailure, toFailure } from '@/core/error/toFailure';

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
      [501, 'unavailable'],
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

  it('never shows a server error’s own message to the user', () => {
    const failure = toFailure(httpError(500, envelope('INTERNAL', 'Traceback: db password…')));
    expect(failure.kind).toBe('server');
    expect(failure.message).not.toContain('Traceback');
    expect(failure.code).toBe('INTERNAL');
  });

  it('says plainly that a 501 feature is not available, never the developer message', () => {
    const failure = toFailure(
      httpError(
        501,
        envelope('NOT_IMPLEMENTED_YET', 'This endpoint is part of the contract but not built yet.'),
      ),
    );
    expect(failure).toMatchObject({
      kind: 'unavailable',
      status: 501,
      code: 'NOT_IMPLEMENTED_YET',
      message: "This isn't available in Medibook yet.",
    });
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

describe('toFailure request ids (OBS-04)', () => {
  function sentWith(id: string) {
    return { headers: new AxiosHeaders({ 'X-Request-Id': id }) };
  }

  it('prefers the id in the error envelope', () => {
    const error = httpError(500, envelope('INTERNAL_ERROR', 'x', { request_id: 'from-body' }));
    expect(toFailure(error).requestId).toBe('from-body');
  });

  it('falls back to the response header when the body is not the envelope', () => {
    const config = sentWith('sent-id');
    const response: AxiosResponse = {
      status: 502,
      statusText: '',
      data: '<html>Bad gateway</html>',
      headers: { 'x-request-id': 'from-header' },
      config,
    };
    const error = new AxiosError(
      'Bad gateway',
      AxiosError.ERR_BAD_RESPONSE,
      config,
      null,
      response,
    );
    expect(toFailure(error).requestId).toBe('from-header');
  });

  it('keeps the id a request was sent with when no response came back', () => {
    const error = new AxiosError('timeout', AxiosError.ECONNABORTED, sentWith('sent-id'));
    expect(toFailure(error)).toMatchObject({ kind: 'network', requestId: 'sent-id' });
  });
});

describe('referenceOf', () => {
  it('shows the first 8 characters of a failed request id', () => {
    const failure = toFailure(httpError(500, envelope('X', 'x', { request_id: '1a2b3c4d-5e6f' })));
    expect(referenceOf(failure)).toBe('1a2b3c4d');
  });

  it('has nothing to show for a failure without a request, or a non-failure', () => {
    expect(referenceOf(clientFailure('validation', 'Too big'))).toBeNull();
    expect(referenceOf(new Error('boom'))).toBeNull();
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
