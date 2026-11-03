import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Failure } from '@/core/error/failure';

const init = vi.fn();
const captureException = vi.fn();

vi.mock('@sentry/react', () => ({ init, captureException }));
vi.mock('@/core/config/env', () => ({
  MONITORING_URL: '',
  SENTRY_DSN: 'https://key@o1.ingest.us.sentry.io/2',
  SENTRY_ENVIRONMENT: 'test',
}));

/** Fresh copies, so the started flag and the per-page cap start empty. */
async function modules() {
  vi.resetModules();
  const sentry = await import('@/core/error/sentry');
  const monitoring = await import('@/core/error/monitoring');
  return { ...sentry, ...monitoring };
}

function capturedError(): Error {
  const [error] = captureException.mock.calls[0] as [Error];
  return error;
}

function capturedHint(): { tags: Record<string, unknown> } {
  const [, hint] = captureException.mock.calls[0] as [Error, { tags: Record<string, unknown> }];
  return hint;
}

beforeEach(() => {
  init.mockReset();
  captureException.mockReset();
  vi.stubGlobal('fetch', vi.fn());
  vi.stubGlobal('window', {
    location: { pathname: '/admin/patients', search: '?q=Ravi%20Kumar' },
    addEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startSentry', () => {
  it('starts once, without personal data or the SDK’s own collectors', async () => {
    const { startSentry } = await modules();
    startSentry();
    startSentry();
    expect(init).toHaveBeenCalledTimes(1);
    const [options] = init.mock.calls[0] as [
      {
        dataCollection: Record<string, unknown>;
        environment: string;
        integrations: (defaults: { name: string }[]) => { name: string }[];
      },
    ];
    expect(options).toMatchObject({
      environment: 'test',
      dataCollection: { userInfo: false, cookies: false, urlQueryParams: false },
    });
    const kept = options
      .integrations(
        ['GlobalHandlers', 'Breadcrumbs', 'HttpContext', 'Console', 'Dedupe'].map((name) => ({
          name,
        })),
      )
      .map(({ name }) => name);
    expect(kept).toEqual(['Dedupe']);
  });
});

describe('reporting with only a Sentry DSN', () => {
  it('forwards a crash with its report id as a tag and returns that id', async () => {
    const { startSentry, reportError } = await modules();
    startSentry();
    const id = reportError(new Error('Cannot read properties of undefined'), { source: 'render' });
    expect(id).toEqual(expect.any(String));
    expect(fetch).not.toHaveBeenCalled();
    expect(capturedError().message).toBe('Cannot read properties of undefined');
    expect(capturedHint().tags).toMatchObject({
      report_id: id,
      source: 'render',
      path: '/admin/patients',
    });
  });

  it('sends an API failure as its code, never the server’s sentence or the search terms', async () => {
    const { startSentry, reportFailure } = await modules();
    startSentry();
    const failure: Failure = {
      kind: 'server',
      message: 'Ravi Kumar already has a booking',
      code: 'INTERNAL_ERROR',
      status: 500,
      fieldErrors: {},
      requestId: 'req-0001-abcd',
      meta: {},
    };
    reportFailure(failure);
    expect(capturedError()).toMatchObject({ name: 'server', message: 'INTERNAL_ERROR' });
    expect(capturedHint().tags).toMatchObject({ request_id: 'req-0001-abcd', status: 500 });
    expect(JSON.stringify(captureException.mock.calls)).not.toContain('Ravi');
  });

  it('never lets a Sentry failure break the app', async () => {
    captureException.mockImplementation(() => {
      throw new Error('SDK down');
    });
    const { startSentry, reportError } = await modules();
    startSentry();
    expect(() => reportError(new Error('boom'), { source: 'window' })).not.toThrow();
  });
});
