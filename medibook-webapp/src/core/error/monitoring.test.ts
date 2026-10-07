import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { clientFailure } from '@/core/error/toFailure';
import type { Failure } from '@/core/error/failure';

const MONITOR = 'https://monitor.example.test/collect';

vi.mock('@/core/config/env', () => ({ MONITORING_URL: 'https://monitor.example.test/collect' }));

/** A fresh copy of the module, so the per-page cap and memory start empty. */
async function monitoring() {
  vi.resetModules();
  return import('@/core/error/monitoring');
}

const sent = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

function reports(): Record<string, unknown>[] {
  return sent.mock.calls.map(
    ([, init]) => JSON.parse(String(init.body)) as Record<string, unknown>,
  );
}

function serverFailure(overrides: Partial<Failure> = {}): Failure {
  return {
    kind: 'server',
    message: 'Something went wrong on our side. Please try again.',
    code: 'INTERNAL_ERROR',
    status: 500,
    fieldErrors: {},
    requestId: 'req-0001-abcd',
    meta: {},
    ...overrides,
  };
}

beforeEach(() => {
  sent.mockReset();
  sent.mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', sent);
  vi.stubGlobal('window', {
    location: { pathname: '/admin/patients', search: '?q=Ravi%20Kumar' },
    addEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reportError', () => {
  it('sends the path, build and a stack, and returns the id shown as the reference', async () => {
    const { reportError } = await monitoring();
    const id = reportError(new Error('Cannot read properties of undefined'), {
      source: 'render',
      componentStack: '\n    at PatientsScreen',
    });
    expect(id).toEqual(expect.any(String));
    expect(sent).toHaveBeenCalledWith(MONITOR, expect.objectContaining({ method: 'POST' }));
    const [report] = reports();
    expect(report).toMatchObject({
      id,
      source: 'render',
      name: 'Error',
      message: 'Cannot read properties of undefined',
      path: '/admin/patients',
      componentStack: '\n    at PatientsScreen',
    });
    expect(report).toHaveProperty('release');
    expect(report).toHaveProperty('commit');
    expect(JSON.stringify(report)).not.toContain('Ravi');
  });

  it('sends one report per error object, however many places catch it', async () => {
    const { reportError, reportIdFor } = await monitoring();
    const error = new Error('once');
    const shown = reportIdFor(error);
    expect(reportError(error, { source: 'route' })).toBe(shown);
    expect(reportError(error, { source: 'window' })).toBe(shown);
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it('stops after 10 reports a minute', async () => {
    const { reportError } = await monitoring();
    for (let i = 0; i < 12; i += 1) reportError(new Error(`loop ${i}`), { source: 'window' });
    expect(sent).toHaveBeenCalledTimes(10);
  });
});

describe('reportFailure', () => {
  it('sends a server error with its request id and code, not the server’s sentence', async () => {
    const { reportFailure } = await monitoring();
    reportFailure(serverFailure({ message: 'Ravi Kumar already has a booking' }));
    const [report] = reports();
    expect(report).toMatchObject({
      source: 'api',
      name: 'server',
      status: 500,
      code: 'INTERNAL_ERROR',
      requestId: 'req-0001-abcd',
      message: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(report)).not.toContain('Ravi');
  });

  it('names the fields of a response that failed validation, without their values', async () => {
    const { reportFailure } = await monitoring();
    const parsed = z.object({ patient: z.object({ name: z.string() }) }).safeParse({
      patient: { name: 42 },
    });
    expect(parsed.success).toBe(false);
    reportFailure(serverFailure({ kind: 'parse', code: null, status: 200 }), parsed.error);
    const [report] = reports();
    expect(report).toMatchObject({
      name: 'parse',
      issues: [{ path: 'patient.name', code: 'invalid_type' }],
    });
  });

  it('leaves expected failures (validation, permission, offline, not built yet) alone', async () => {
    const { reportFailure } = await monitoring();
    reportFailure(clientFailure('validation', 'Enter a name'));
    reportFailure(serverFailure({ kind: 'forbidden', status: 403 }));
    reportFailure(serverFailure({ kind: 'network', status: null }));
    reportFailure(serverFailure({ kind: 'unavailable', status: 501 }));
    expect(sent).not.toHaveBeenCalled();
  });

  it('never lets a monitoring outage break the app', async () => {
    sent.mockRejectedValue(new TypeError('Failed to fetch'));
    const { reportFailure } = await monitoring();
    expect(() => reportFailure(serverFailure())).not.toThrow();
  });
});
