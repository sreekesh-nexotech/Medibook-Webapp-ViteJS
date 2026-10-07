import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { countAppointments } from '@/features/appointments/application/usecases/appointments.countAppointments';
import type {
  AppointmentRange,
  ApptSource,
} from '@/features/appointments/domain/entities/appointments.entities';

/** A live count is one small request, so it can follow the dashboards' minute. */
const COUNT_REFETCH_MS = 60_000;

/**
 * How many appointments `range` holds (of one `source`), read as one row's
 * page total — for a figure, without loading the list (PERF-04). Booking
 * changes refresh it with the lists (`appointmentsKeys.lists()`).
 */
export function useAppointmentCountQuery(range: AppointmentRange, source: ApptSource | null) {
  return useQuery({
    queryKey: appointmentsKeys.count(range, source),
    queryFn: async () => unwrap(await countAppointments(range, source)),
    refetchInterval: COUNT_REFETCH_MS,
  });
}
