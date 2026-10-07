import type { InternalAxiosRequestConfig } from 'axios';

import { REQUEST_ID_HEADER } from '@/core/config/api';

/** Random bytes in the fallback id: 128 bits, like a UUID. */
const FALLBACK_ID_BYTES = 16;
const HEX_RADIX = 16;
const HEX_DIGITS_PER_BYTE = 2;

/**
 * A fresh id for one API request. The backend logs it with every line it
 * writes for that request and echoes it back (`core/middleware.py`), so the
 * reference a user reads out finds the request in the server logs (OBS-04).
 *
 * `crypto.randomUUID()` exists only on https or localhost; a dev server opened
 * over plain http on the office network falls back to random hex, which the
 * backend accepts too (8–64 letters, digits and dashes).
 */
export function newRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(FALLBACK_ID_BYTES)), (byte) =>
    byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0'),
  ).join('');
}

/** Request interceptor: gives each request its own id, keeping one already set (a retry). */
export function withRequestId(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  if (!config.headers.has(REQUEST_ID_HEADER)) config.headers.set(REQUEST_ID_HEADER, newRequestId());
  return config;
}
