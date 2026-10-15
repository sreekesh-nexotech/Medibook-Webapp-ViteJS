import { writeFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { stepTitle } from './stepList.ts';
import type { AllowedFailure, ApiWatch } from './watch.ts';

/**
 * One `test.step('<ID> <title>')` per UAT script step (report §4). A failed
 * step is recorded (soft) and the section carries on, so one run shows every
 * step's result; a later step that needs what a failed one should have made
 * says it is blocked instead of failing for a misleading reason.
 */

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const firstStackLine = error.stack?.split('\n').find((l) => l.includes('/e2e/uat/'));
    return firstStackLine ? `${error.message}\n${firstStackLine.trim()}` : error.message;
  }
  return String(error);
}

const uatExpect = expect.extend({
  toCompleteStep(received: unknown) {
    return {
      pass: false,
      name: 'toCompleteStep',
      message: () => describeError(received),
    };
  },
});

/** A value an earlier step should have produced. */
export function needs<T>(value: T | null | undefined, step: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Blocked: ${step} did not complete, so this step has nothing to work on.`);
  }
  return value;
}

export interface StepOptions {
  /** Pages whose API answers and page errors this step is accountable for. */
  readonly watch?: readonly ApiWatch[];
  /** Failures the step provokes on purpose. */
  readonly allow?: readonly AllowedFailure[];
  /** Pages to screenshot when the step fails (a function: the pages the step itself opens). */
  readonly pages?: readonly Page[] | (() => readonly Page[]);
}

const passed = new Set<string>();

/** Did step `id` pass in this run? */
export function stepPassed(id: string): boolean {
  return passed.has(id);
}

/** `UAT_STOP_ON_FAIL=1`: after the first failed step, the rest of the section is not run. */
const STOP_ON_FAIL = process.env.UAT_STOP_ON_FAIL === '1';
/** `UAT_UNTIL=<ID>`: run the section up to and including that step only. */
const UNTIL = process.env.UAT_UNTIL ?? null;

let stopped = false;

/** Keep what the pages showed when a step failed: a full-page screenshot and the accessibility tree. */
async function keepEvidence(id: string, pages: readonly Page[]): Promise<void> {
  for (const [i, page] of pages.entries()) {
    if (page.isClosed()) continue;
    const name = `${id}-page-${i + 1}`;
    const shot = test.info().outputPath(`${name}.png`);
    if (
      await page.screenshot({ fullPage: true, path: shot }).then(
        () => true,
        () => false,
      )
    ) {
      await test.info().attach(`${name}.png`, { path: shot, contentType: 'image/png' });
    }
    const tree = await page
      .locator('body')
      .ariaSnapshot()
      .catch(() => null);
    if (tree) {
      const file = test.info().outputPath(`${name}.aria.yml`);
      writeFileSync(file, `# ${page.url()}\n${tree}\n`);
    }
  }
}

const DIALOG_ESCAPES = 3;

/**
 * After a failure, close what the failed step left open (a drawer, a modal),
 * so the next step starts from the screen and fails — or passes — on its own.
 */
async function dismissDialogs(pages: readonly Page[]): Promise<void> {
  for (const page of pages) {
    for (let i = 0; i < DIALOG_ESCAPES && !page.isClosed(); i += 1) {
      const open = await page
        .getByRole('dialog')
        .count()
        .catch(() => 0);
      if (open === 0) break;
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }
}

/**
 * Run UAT step `id`. Failures are soft: the step is marked failed with the
 * reason and the section continues. Returns whether it passed.
 */
export async function uatStep(
  id: string,
  options: StepOptions,
  body: () => Promise<void>,
): Promise<boolean> {
  if (stopped) return false;
  let ok = true;
  await test.step(stepTitle(id), async () => {
    for (const w of options.watch ?? []) w.begin(options.allow);
    try {
      await body();
      const problems = (options.watch ?? []).flatMap((w) => w.problems());
      if (problems.length > 0) {
        throw new Error(`Unexpected errors while doing this step:\n${problems.join('\n')}`);
      }
    } catch (error) {
      ok = false;
      const pages = typeof options.pages === 'function' ? options.pages() : (options.pages ?? []);
      await keepEvidence(id, pages);
      await dismissDialogs(pages);
      // What the app's API said while the step ran is usually the reason.
      const seen = (options.watch ?? []).flatMap((w) => w.problems());
      const message = describeError(error);
      const full =
        seen.length > 0 && !message.startsWith('Unexpected errors')
          ? `${message}\nWhile this step ran:\n${seen.join('\n')}`
          : message;
      uatExpect.soft(full).toCompleteStep();
    }
  });
  if (ok) passed.add(id);
  if ((!ok && STOP_ON_FAIL) || id === UNTIL) stopped = true;
  return ok;
}
