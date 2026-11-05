import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  REMATERIALISE_REFRESH_MS,
  refreshAfterScheduleChange,
} from '@/features/slots/application/queries/scheduleRefresh';
import { slotsKeys } from '@/features/slots/application/queries/slots.keys';

interface InvalidateSpy {
  readonly mock: { readonly calls: readonly (readonly unknown[])[] };
}

function slotInvalidations(spy: InvalidateSpy): number {
  const slots = JSON.stringify(slotsKeys.all);
  return spy.mock.calls.filter(
    ([filters]) =>
      JSON.stringify((filters as { queryKey?: unknown } | undefined)?.queryKey) === slots,
  ).length;
}

describe('slot grid after a saved schedule change (UAT T04)', () => {
  let queryClient: QueryClient;
  let spy: InvalidateSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
    spy = vi.spyOn(queryClient, 'invalidateQueries') as unknown as InvalidateSpy;
  });
  afterEach(() => vi.useRealTimers());

  it('refetches the grid straight away, without anyone pressing Regenerate', () => {
    // The backend now builds slots synchronously: nothing queued, nothing cancelled.
    refreshAfterScheduleChange(queryClient, {
      cancelledBookings: 0,
      rematerialisationQueued: false,
    });
    expect(slotInvalidations(spy)).toBe(1);
    vi.advanceTimersByTime(REMATERIALISE_REFRESH_MS * 2);
    expect(slotInvalidations(spy)).toBe(1);
  });

  it('still reads the grid again later when the server says a rebuild is queued', () => {
    refreshAfterScheduleChange(queryClient, {
      cancelledBookings: 0,
      rematerialisationQueued: true,
    });
    expect(slotInvalidations(spy)).toBe(1);
    vi.advanceTimersByTime(REMATERIALISE_REFRESH_MS);
    expect(slotInvalidations(spy)).toBe(2);
  });

  it('refreshes the desk screens only when bookings were cancelled', () => {
    refreshAfterScheduleChange(queryClient, {
      cancelledBookings: 0,
      rematerialisationQueued: false,
    });
    const afterQuietChange = spy.mock.calls.length;
    expect(afterQuietChange).toBe(1);
    refreshAfterScheduleChange(queryClient, {
      cancelledBookings: 2,
      rematerialisationQueued: false,
    });
    expect(spy.mock.calls.length - afterQuietChange).toBeGreaterThan(1);
  });
});
