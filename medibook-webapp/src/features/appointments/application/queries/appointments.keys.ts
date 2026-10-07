import type { AppointmentRange } from '@/features/appointments/domain/entities/appointments.entities';

/** Query keys for desk appointments (standards §4). */
export const appointmentsKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentsKeys.all, 'list'] as const,
  list: (range: AppointmentRange) => [...appointmentsKeys.lists(), range] as const,
  count: (range: AppointmentRange, source: string | null) =>
    [...appointmentsKeys.lists(), 'count', range, source] as const,
  detail: (id: string) => [...appointmentsKeys.all, 'detail', id] as const,
  events: (id: string) => [...appointmentsKeys.all, 'events', id] as const,
  receipt: (id: string) => [...appointmentsKeys.all, 'receipt', id] as const,
  tokenSlip: (id: string) => [...appointmentsKeys.all, 'token-slip', id] as const,
};
