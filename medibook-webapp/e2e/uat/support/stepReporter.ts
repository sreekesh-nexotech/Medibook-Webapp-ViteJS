import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Reporter, TestCase, TestResult, TestStep } from '@playwright/test/reporter';

import { UAT_ENV } from './env.ts';
import { STEP_ID, UAT_STEPS } from './stepList.ts';

/**
 * Writes `e2e/uat/results.json`: one `{id, title, status, error}` per UAT step
 * of report §4, in report order. A step the run never reached is listed as
 * `not run`, so the file always accounts for every step. With
 * `UAT_RESULTS_MERGE=1` the steps run now replace their entries in the
 * existing file and the rest are kept (for re-running one section).
 */

export type StepStatus = 'passed' | 'failed' | 'not run';

export interface StepResult {
  readonly id: string;
  readonly title: string;
  readonly status: StepStatus;
  readonly error: string | null;
}

/** ANSI colour codes in Playwright error messages (ESC + `[…m`). */
const ESCAPE = String.fromCharCode(27);
const ANSI = new RegExp(`${ESCAPE}\\[[0-9;]*m`, 'g');
const MAX_ERROR_CHARS = 2_000;

function clean(message: string | undefined): string | null {
  if (!message) return null;
  const text = message.replace(ANSI, '').trim();
  return text.length > MAX_ERROR_CHARS ? `${text.slice(0, MAX_ERROR_CHARS)}…` : text;
}

function readExisting(file: string): StepResult[] {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as StepResult[];
  } catch {
    // No earlier results: start from the canonical list.
    return [];
  }
}

export default class StepReporter implements Reporter {
  private readonly results = new Map<string, StepResult>();
  private testsRun = 0;

  onTestBegin(): void {
    this.testsRun += 1;
  }

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return;
    const match = STEP_ID.exec(step.title);
    if (!match?.[1]) return;
    const id = match[1];
    this.results.set(id, {
      id,
      title: step.title.slice(id.length).trim(),
      status: step.error ? 'failed' : 'passed',
      error: clean(step.error?.message),
    });
  }

  onEnd(): void {
    // `--list` and runs that never reached a test leave the results alone.
    if (this.testsRun === 0) return;
    const file = UAT_ENV.resultsFile;
    const merge = process.env.UAT_RESULTS_MERGE === '1';
    const earlier = merge ? readExisting(file) : [];
    const rows: StepResult[] = UAT_STEPS.map(([id, title]) => {
      const now = this.results.get(id);
      if (now) return now;
      const before = earlier.find((r) => r.id === id);
      return before ?? { id, title, status: 'not run', error: null };
    });
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`);
    const count = (s: StepStatus) => rows.filter((r) => r.status === s).length;
    process.stdout.write(
      `UAT steps: ${count('passed')} passed, ${count('failed')} failed, ${count('not run')} not run → ${path.relative(process.cwd(), file)}\n`,
    );
  }

  printsToStdio(): boolean {
    return false;
  }
}
