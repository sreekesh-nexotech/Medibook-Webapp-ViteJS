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

/**
 * Run UAT step `id`. Failures are soft: the step is marked failed with the
 * reason and the section continues. Returns whether it passed.
 */
export async function uatStep(
  id: string,
  options: StepOptions,
  body: () => Promise<void>,
): Promise<boolean> {
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
      const shots = typeof options.pages === 'function' ? options.pages() : (options.pages ?? []);
      for (const [i, page] of shots.entries()) {
        if (page.isClosed()) continue;
        const shot = await page.screenshot({ fullPage: true }).catch(() => null);
        if (shot) {
          await test.info().attach(`${id}-page-${i + 1}.png`, {
            body: shot,
            contentType: 'image/png',
          });
        }
      }
      uatExpect.soft(error).toCompleteStep();
    }
  });
  if (ok) passed.add(id);
  return ok;
}
