import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { isUnknownQueryParam, withQueryParamFallback } from '@/core/api/queryParams';
import { exportTruncation, readFileOrUrl, withJsonErrorBody } from '@/core/api/blobResponses';

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response: AxiosResponse = { status, statusText: '', data, headers: {}, config };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, null, response);
}

const UNKNOWN_MRN = httpError(400, {
  code: 'VALIDATION_ERROR',
  message: 'Some details need fixing.',
  errors: { mrn: ['Unknown query parameter.'] },
});

describe('isUnknownQueryParam', () => {
  it('recognises the allowlist refusal for that parameter only', () => {
    expect(isUnknownQueryParam(UNKNOWN_MRN, 'mrn')).toBe(true);
    expect(isUnknownQueryParam(UNKNOWN_MRN, 'q')).toBe(false);
    expect(isUnknownQueryParam(httpError(403, { errors: { mrn: [] } }), 'mrn')).toBe(false);
    expect(isUnknownQueryParam(new Error('x'), 'mrn')).toBe(false);
  });
});

describe('withQueryParamFallback', () => {
  it('retries the old way when the backend does not know the filter yet', async () => {
    const without = vi.fn(async () => 'fallback');
    await expect(
      withQueryParamFallback('mrn', () => Promise.reject(UNKNOWN_MRN), without),
    ).resolves.toBe('fallback');
    expect(without).toHaveBeenCalledOnce();
  });

  it('passes any other failure through', async () => {
    const forbidden = httpError(403, { code: 'PERMISSION_DENIED' });
    await expect(
      withQueryParamFallback(
        'mrn',
        () => Promise.reject(forbidden),
        async () => 'fallback',
      ),
    ).rejects.toBe(forbidden);
  });
});

describe('exportTruncation', () => {
  it('reads the flag and the row cap in either form', () => {
    expect(exportTruncation({ 'x-export-truncated': 'true' })).toEqual({
      truncated: true,
      rowLimit: null,
    });
    expect(exportTruncation({ 'X-Export-Truncated': '10000' })).toEqual({
      truncated: true,
      rowLimit: 10000,
    });
    expect(exportTruncation({ 'x-export-truncated': '1', 'x-export-row-limit': '10000' })).toEqual({
      truncated: true,
      rowLimit: 10000,
    });
  });

  it('reads the row count the payments export sends (B3)', () => {
    expect(
      exportTruncation({ 'x-export-truncated': 'true', 'x-export-row-count': '10000' }),
    ).toEqual({ truncated: true, rowLimit: 10000 });
    expect(exportTruncation({ 'x-export-truncated': 'false', 'x-export-row-count': '42' })).toEqual(
      { truncated: false, rowLimit: null },
    );
  });

  it('is not truncated without the header, or when it says false', () => {
    expect(exportTruncation({})).toEqual({ truncated: false, rowLimit: null });
    expect(exportTruncation({ 'x-export-truncated': 'false' }).truncated).toBe(false);
    expect(exportTruncation(undefined).truncated).toBe(false);
  });
});

describe('readFileOrUrl', () => {
  it('passes a PDF through and reads a JSON {url} answer', async () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    await expect(readFileOrUrl(pdf)).resolves.toEqual({ kind: 'file', blob: pdf });
    const link = new Blob([JSON.stringify({ url: 'https://files.example.com/s.pdf' })], {
      type: 'application/json',
    });
    await expect(readFileOrUrl(link)).resolves.toEqual({
      kind: 'url',
      url: 'https://files.example.com/s.pdf',
    });
  });
});

describe('withJsonErrorBody', () => {
  it('turns a blob error body back into the JSON envelope', async () => {
    const body = new Blob([JSON.stringify({ code: 'PERMISSION_DENIED', message: 'No.' })], {
      type: 'application/json',
    });
    const error = httpError(403, body);
    await withJsonErrorBody(error);
    expect(error.response?.data).toEqual({ code: 'PERMISSION_DENIED', message: 'No.' });
  });
});
