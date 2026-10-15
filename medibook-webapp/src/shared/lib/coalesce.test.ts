import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCoalescer } from '@/shared/lib/coalesce';

const WINDOW_MS = 3_000;

describe('createCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs a lone call at once', () => {
    const task = vi.fn();
    createCoalescer(task, WINDOW_MS).run();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('collapses a burst into one more run when the window ends', () => {
    const task = vi.fn();
    const coalescer = createCoalescer(task, WINDOW_MS);
    for (let i = 0; i < 50; i += 1) coalescer.run();
    expect(task).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(WINDOW_MS);
    expect(task).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(WINDOW_MS * 3);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('runs a sustained stream once per window', () => {
    const task = vi.fn();
    const coalescer = createCoalescer(task, WINDOW_MS);
    const STEP_MS = 100;
    for (let elapsed = 0; elapsed < WINDOW_MS * 10; elapsed += STEP_MS) {
      coalescer.run();
      vi.advanceTimersByTime(STEP_MS);
    }
    expect(task.mock.calls.length).toBeLessThanOrEqual(11);
    expect(task.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it('runs at once again after a quiet window', () => {
    const task = vi.fn();
    const coalescer = createCoalescer(task, WINDOW_MS);
    coalescer.run();
    vi.advanceTimersByTime(WINDOW_MS);
    coalescer.run();
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('drops a pending run on cancel', () => {
    const task = vi.fn();
    const coalescer = createCoalescer(task, WINDOW_MS);
    coalescer.run();
    coalescer.run();
    coalescer.cancel();
    vi.advanceTimersByTime(WINDOW_MS * 2);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
