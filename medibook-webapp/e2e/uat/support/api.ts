import { randomUUID } from 'node:crypto';

import { request, type APIRequestContext, type APIResponse } from '@playwright/test';

import { passwordOf } from './accounts.ts';
import { API_PREFIX, UAT_ENV } from './env.ts';
import { spendSignIn } from './throttle.ts';

/**
 * A small REST client for the setup the report says comes from outside the web
 * app (online bookings from the patient app, the Razorpay webhook) and for
 * reading ids a step needs (which doctor is in session today, which invoice is
 * unpaid). It talks to the API directly, never through the web app's proxy.
 * Steps assert through the UI; this client never stands in for a UI action.
 */

export type ApiSurface = 'hospital' | 'platform' | 'patient';

type Query = Readonly<Record<string, string | number | boolean | undefined | null>>;

export interface ApiErrorBody {
  readonly code?: string;
  readonly message?: string;
  readonly errors?: Readonly<Record<string, unknown>>;
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** A refused call: status, the envelope's `code`, and the whole body. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: ApiErrorBody;

  constructor(method: string, url: string, status: number, body: ApiErrorBody) {
    super(`${method} ${url} → ${status} ${body.code ?? ''} ${body.message ?? ''}`.trim());
    this.status = status;
    this.code = body.code ?? '';
    this.body = body;
  }
}

export interface Page<T> {
  readonly results: readonly T[];
  readonly total: number;
  readonly has_next: boolean;
}

interface Tokens {
  access: string;
  refresh: string;
}

interface WriteOptions {
  readonly params?: Query;
  /** The row version for `If-Match`. */
  readonly ifMatch?: number;
  /** A fixed replay key; a fresh one is sent otherwise. */
  readonly idempotencyKey?: string;
}

const UNAUTHORIZED = 401;
const MAX_PAGE_SIZE = 100;
const DEVICE_FINGERPRINT = 'medibook-uat-device-0001';

function cleanQuery(params?: Query): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) out[k] = v;
  return out;
}

async function parse(response: APIResponse): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // A non-JSON answer (a file, an HTML error page) is returned as text.
    return text;
  }
}

export class ApiClient {
  private tokens: Tokens | null = null;
  private readonly context: APIRequestContext;
  readonly surface: ApiSurface;
  private readonly identifier: string | null;

  private constructor(context: APIRequestContext, surface: ApiSurface, identifier: string | null) {
    this.context = context;
    this.surface = surface;
    this.identifier = identifier;
  }

  /** A signed-in hospital or operations staff member. */
  static async staff(surface: 'hospital' | 'platform', email: string): Promise<ApiClient> {
    const client = new ApiClient(await ApiClient.newContext(email), surface, email);
    await client.signIn();
    return client;
  }

  /** A signed-in patient (phone in E.164 or email). */
  static async patient(identifier: string): Promise<ApiClient> {
    const client = new ApiClient(await ApiClient.newContext(identifier), 'patient', identifier);
    await client.signIn();
    return client;
  }

  /** No session: public patient discovery, webhooks. */
  static async anonymous(surface: ApiSurface = 'patient'): Promise<ApiClient> {
    return new ApiClient(await ApiClient.newContext('anonymous'), surface, null);
  }

  private static newContext(label: string): Promise<APIRequestContext> {
    return request.newContext({
      baseURL: UAT_ENV.apiUrl,
      extraHTTPHeaders: {
        'User-Agent': `Medibook UAT setup (${label})`,
        'X-Device-Fingerprint': DEVICE_FINGERPRINT,
      },
    });
  }

  /** The raw request context, for calls outside `/api/v1` (webhooks). */
  get raw(): APIRequestContext {
    return this.context;
  }

  get accessToken(): string | null {
    return this.tokens?.access ?? null;
  }

  get refreshToken(): string | null {
    return this.tokens?.refresh ?? null;
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }

  /** Sign in again (after a password change or a revoked session). */
  async signIn(): Promise<void> {
    if (!this.identifier) throw new Error('An anonymous client cannot sign in.');
    await spendSignIn(this.identifier);
    const password = passwordOf(this.identifier);
    const [path, body] =
      this.surface === 'patient'
        ? ['/patient/auth/login/password', { identifier: this.identifier, password }]
        : [`/${this.surface}/auth/login`, { email: this.identifier, password }];
    const response = await this.context.post(`${API_PREFIX}${path}`, { data: body });
    const data = (await parse(response)) as Partial<Tokens> & ApiErrorBody;
    if (!response.ok() || !data.access || !data.refresh) {
      throw new ApiError('POST', path, response.status(), data);
    }
    this.tokens = { access: data.access, refresh: data.refresh };
  }

  private async refresh(): Promise<boolean> {
    if (!this.tokens) return false;
    const response = await this.context.post(`${API_PREFIX}/${this.surface}/auth/token/refresh`, {
      data: { refresh: this.tokens.refresh },
    });
    if (!response.ok()) return false;
    const data = (await parse(response)) as Partial<Tokens>;
    if (!data.access || !data.refresh) return false;
    this.tokens = { access: data.access, refresh: data.refresh };
    return true;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      ...(this.tokens ? { Authorization: `Bearer ${this.tokens.access}` } : {}),
      ...extra,
    };
  }

  /**
   * `/payments` → `/api/v1/<surface>/payments`. A path that already names its
   * surface (`/patient/…`, `/shared/…`) is only prefixed; a webhook is used as given.
   */
  private urlOf(path: string): string {
    if (path.startsWith('/webhooks')) return path;
    const named = [`/${this.surface}/`, '/shared/'].some((p) => path.startsWith(p));
    return named ? `${API_PREFIX}${path}` : `${API_PREFIX}/${this.surface}${path}`;
  }

  private async send(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body: unknown,
    options: WriteOptions = {},
  ): Promise<APIResponse> {
    const url = this.urlOf(path);
    const extra: Record<string, string> = {};
    if (method !== 'GET') extra['Idempotency-Key'] = options.idempotencyKey ?? randomUUID();
    if (options.ifMatch !== undefined) extra['If-Match'] = `"${options.ifMatch}"`;
    const run = () =>
      this.context.fetch(url, {
        method,
        params: cleanQuery(options.params),
        headers: this.headers(extra),
        ...(body === undefined ? {} : { data: body }),
      });
    let response = await run();
    if (response.status() === UNAUTHORIZED && this.identifier) {
      // An expired access token (15 minutes) or a session a step revoked.
      if (!(await this.refresh())) await this.signIn();
      response = await run();
    }
    return response;
  }

  private async call<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: WriteOptions,
  ): Promise<T> {
    const response = await this.send(method, path, body, options);
    const data = await parse(response);
    if (!response.ok()) {
      throw new ApiError(method, path, response.status(), (data ?? {}) as ApiErrorBody);
    }
    return data as T;
  }

  get<T>(path: string, params?: Query): Promise<T> {
    return this.call<T>('GET', path, undefined, { params });
  }

  post<T>(path: string, body?: unknown, options?: WriteOptions): Promise<T> {
    return this.call<T>('POST', path, body ?? {}, options);
  }

  put<T>(path: string, body: unknown, options?: WriteOptions): Promise<T> {
    return this.call<T>('PUT', path, body, options);
  }

  patch<T>(path: string, body: unknown, options?: WriteOptions): Promise<T> {
    return this.call<T>('PATCH', path, body, options);
  }

  delete<T>(path: string, options?: WriteOptions): Promise<T> {
    return this.call<T>('DELETE', path, undefined, options);
  }

  /** Every row of a paginated list. */
  async all<T>(path: string, params: Query = {}): Promise<T[]> {
    const rows: T[] = [];
    for (let page = 1; ; page += 1) {
      const data = await this.get<Page<T>>(path, { ...params, page, page_size: MAX_PAGE_SIZE });
      rows.push(...data.results);
      if (!data.has_next) return rows;
    }
  }

  /** The status of a call that is expected to fail (for "writes are refused" checks). */
  async statusOf(
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: WriteOptions,
  ): Promise<{ readonly status: number; readonly code: string }> {
    const response = await this.send(method, path, body ?? {}, options);
    const data = ((await parse(response)) ?? {}) as ApiErrorBody;
    return { status: response.status(), code: data.code ?? '' };
  }
}

/** Is `error` the API refusing with `code`? */
export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
