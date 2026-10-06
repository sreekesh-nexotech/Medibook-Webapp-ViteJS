import type { QueryClient } from '@tanstack/react-query';

import { todayISO } from '@/shared/lib/format';

import type { AppointmentRange } from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';

/** Queue pushes arriving within this window share one refresh. */
const COALESCE_MS = 2_000;

const pending = new WeakMap<QueryClient, ReturnType<typeof setTimeout>>();

function isRange(value: unknown): value is AppointmentRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<AppointmentRange>).dateFrom === 'string' &&
    typeof (value as Partial<AppointmentRange>).dateTo === 'string'
  );
}

/** Whether a desk window includes today on the hospital's calendar. */
export function includesToday(range: AppointmentRange): boolean {
  const today = todayISO();
  return range.dateFrom <= today && today <= range.dateTo;
}

/**
 * Re-read only the appointment lists that include today, at most once per
 * burst of queue pushes. Every token call pushes to every open terminal, and
 * refetching every page of every cached window for each push grows with
 * terminals × pages × calls (RUN-09).
 */
export function refreshTodayAppointmentLists(queryClient: QueryClient): void {
  if (pending.has(queryClient)) return;
  pending.set(
    queryClient,
    setTimeout(() => {
      pending.delete(queryClient);
      void queryClient.invalidateQueries({
        queryKey: appointmentsKeys.lists(),
        predicate: (query) => {
          const range = query.queryKey[query.queryKey.length - 1];
          return isRange(range) && includesToday(range);
        },
      });
    }, COALESCE_MS),
  );
}
