import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { newRequestId, withRequestId } from '@/core/api/requestId';

/** What the backend accepts as a client-sent id (`core/middleware.py`). */
const BACKEND_ID = /^[A-Za-z0-9-]{8,64}$/;

function config(headers: Record<string, string> = {}): InternalAxiosRequestConfig {
  return { headers: new AxiosHeaders(headers) };
}

describe('newRequestId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a fresh id the backend accepts', () => {
    const a = newRequestId();
    expect(a).toMatch(BACKEND_ID);
    expect(newRequestId()).not.toBe(a);
  });

  it('still works without crypto.randomUUID (plain-http dev server)', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const id = newRequestId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).toMatch(BACKEND_ID);
  });
});

describe('withRequestId', () => {
  it('tags a request that has no id', () => {
    expect(withRequestId(config()).headers.get('X-Request-Id')).toMatch(BACKEND_ID);
  });

  it('keeps the id of a retried request', () => {
    const retried = withRequestId(config({ 'X-Request-Id': 'kept-id-1' }));
    expect(retried.headers.get('X-Request-Id')).toBe('kept-id-1');
  });
});
