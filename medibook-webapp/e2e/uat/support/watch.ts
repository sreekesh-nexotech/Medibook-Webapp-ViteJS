import type { Page, Request, Response } from '@playwright/test';

/**
 * Watches one browser page for what a tester would call "something went
 * wrong": any API answer of 400 or above and any uncaught page error. Each
 * step starts from a clean slate and fails if anything was recorded that the
 * step did not expect (a step that deliberately triggers a refusal, such as
 * deleting a tax rate still in use, allows exactly that answer).
 */

export interface AllowedFailure {
  readonly status?: number;
  /** Matched against `METHOD /path` (e.g. `DELETE /api/v1/hospital/tax-rates/…`). */
  readonly path?: RegExp;
  /** Why this answer is expected — for the reader of the spec. */
  readonly why: string;
}

const API_PATH = /^\/api\//;
const BAD_STATUS = 400;
const QUIET_MS = 800;
const SETTLE_MAX_MS = 20_000;
const SETTLE_POLL_MS = 100;

function isApi(request: Request): boolean {
  return API_PATH.test(new URL(request.url()).pathname);
}

export class ApiWatch {
  readonly label: string;
  private readonly failures: string[] = [];
  private readonly pageErrors: string[] = [];
  private allowed: readonly AllowedFailure[] = [];
  private inFlight = 0;
  private lastActivity = Date.now();

  constructor(page: Page, label: string) {
    this.label = label;
    page.on('response', (response) => this.onResponse(response));
    page.on('pageerror', (error) => this.pageErrors.push(String(error)));
    page.on('request', (request) => this.track(request, 1));
    page.on('requestfinished', (request) => this.track(request, -1));
    page.on('requestfailed', (request) => this.track(request, -1));
  }

  private track(request: Request, delta: number): void {
    if (!isApi(request)) return;
    this.inFlight = Math.max(0, this.inFlight + delta);
    this.lastActivity = Date.now();
  }

  /**
   * Resolve once the page has made no API call for a moment — the screen has
   * loaded what it is going to load (a screen's reads fire after its route renders).
   */
  async settled(): Promise<void> {
    const deadline = Date.now() + SETTLE_MAX_MS;
    while (Date.now() < deadline) {
      if (this.inFlight === 0 && Date.now() - this.lastActivity >= QUIET_MS) return;
      await new Promise<void>((resolve) => setTimeout(resolve, SETTLE_POLL_MS));
    }
  }

  private onResponse(response: Response): void {
    const url = new URL(response.url());
    if (!API_PATH.test(url.pathname) || response.status() < BAD_STATUS) return;
    const line = `${response.request().method()} ${url.pathname}`;
    const isAllowed = this.allowed.some(
      (a) =>
        (a.status === undefined || a.status === response.status()) &&
        (!a.path || a.path.test(line)),
    );
    if (isAllowed) return;
    const entry = `${response.status()} ${line}`;
    const index = this.failures.push(entry) - 1;
    // The error code and message say why (the envelope's `code` / `message`).
    void response
      .json()
      .then((body: { code?: string; message?: string }) => {
        const why = [body.code, body.message].filter(Boolean).join(': ');
        if (why && this.failures[index] === entry) this.failures[index] = `${entry} — ${why}`;
      })
      .catch(() => undefined);
  }

  /** Start a step: forget what came before and expect exactly `allowed` failures. */
  begin(allowed: readonly AllowedFailure[] = []): void {
    this.failures.length = 0;
    this.pageErrors.length = 0;
    this.allowed = allowed;
  }

  /** What went wrong since `begin`, as readable lines. */
  problems(): string[] {
    return [
      ...this.failures.map((f) => `[${this.label}] API ${f}`),
      ...this.pageErrors.map((e) => `[${this.label}] page error: ${e}`),
    ];
  }
}
