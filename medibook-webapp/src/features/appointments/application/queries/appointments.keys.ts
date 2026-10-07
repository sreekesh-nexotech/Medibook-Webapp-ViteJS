import type {
  AppointmentListParams,
  AppointmentRange,
  QuoteInput,
} from '@/features/appointments/domain/entities/appointments.entities';

/** Query keys for desk appointments (standards §4). */
export const appointmentsKeys = {
  all: ['appointments'] as const,
  /** Everything list-shaped: day lists, list pages and tab counts. */
  lists: () => [...appointmentsKeys.all, 'list'] as const,
  list: (range: AppointmentRange) => [...appointmentsKeys.lists(), 'day', range] as const,
  page: (params: AppointmentListParams) => [...appointmentsKeys.lists(), 'page', params] as const,
  counts: (params: AppointmentListParams) =>
    [...appointmentsKeys.lists(), 'counts', params] as const,
  detail: (id: string) => [...appointmentsKeys.all, 'detail', id] as const,
  events: (id: string) => [...appointmentsKeys.all, 'events', id] as const,
  receipt: (id: string) => [...appointmentsKeys.all, 'receipt', id] as const,
  tokenSlip: (id: string) => [...appointmentsKeys.all, 'token-slip', id] as const,
  quote: (input: QuoteInput) => [...appointmentsKeys.all, 'quote', input] as const,
};
