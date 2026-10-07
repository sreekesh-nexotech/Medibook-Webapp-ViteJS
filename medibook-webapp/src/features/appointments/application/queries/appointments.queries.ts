import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  AppointmentListParams,
  AppointmentRange,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { countAppointments } from '@/features/appointments/application/usecases/appointments.countAppointments';
import { fetchAppointment } from '@/features/appointments/application/usecases/appointments.fetchAppointment';
import { fetchAppointmentEvents } from '@/features/appointments/application/usecases/appointments.fetchAppointmentEvents';
import { fetchAppointments } from '@/features/appointments/application/usecases/appointments.fetchAppointments';
import { fetchAppointmentsPage } from '@/features/appointments/application/usecases/appointments.fetchAppointmentsPage';
import { fetchReceipt } from '@/features/appointments/application/usecases/appointments.fetchReceipt';
import { fetchTokenSlip } from '@/features/appointments/application/usecases/appointments.fetchTokenSlip';
import {
  TAB_COUNT_FILTERS,
  type CountedTab,
} from '@/features/appointments/domain/appointments.listFilters';

/** The desk list moves all day (check-ins, payments); keep it fresh. */
const LIST_STALE_TIME_MS = 15_000;

/** A receipt never changes once issued. */
const RECEIPT_STALE_TIME_MS = 10 * 60_000;

interface DayListOptions {
  /** Re-read on this interval as a safety net for missed live pushes. */
  readonly refetchIntervalMs?: number;
}

/** Every appointment in a hospital-local date window (all pages). */
export function useAppointmentsQuery(range: AppointmentRange, options: DayListOptions = {}) {
  return useQuery({
    queryKey: appointmentsKeys.list(range),
    queryFn: async () => unwrap(await fetchAppointments(range)),
    placeholderData: keepPreviousData,
    staleTime: LIST_STALE_TIME_MS,
    refetchInterval: options.refetchIntervalMs,
  });
}

/**
 * One page of the desk list, filtered, sorted and paged by the server. The
 * previous page stays on screen while the next loads (`isPlaceholderData`
 * says so — the table dims instead of jumping).
 */
export function useAppointmentsPageQuery(
  params: AppointmentListParams,
  options: DayListOptions = {},
) {
  return useQuery({
    queryKey: appointmentsKeys.page(params),
    queryFn: async () => unwrap(await fetchAppointmentsPage(params)),
    placeholderData: keepPreviousData,
    staleTime: LIST_STALE_TIME_MS,
    refetchInterval: options.refetchIntervalMs,
  });
}

/**
 * The tab counts of the desk list for the current window and filters: one
 * light `page_size=1` request per tab, reading each page's `total`.
 */
export function useAppointmentTabCountsQuery(params: AppointmentListParams) {
  return useQuery({
    queryKey: appointmentsKeys.counts(params),
    queryFn: async () => {
      const entries = await Promise.all(
        (Object.keys(TAB_COUNT_FILTERS) as CountedTab[]).map(
          async (tab) =>
            [
              tab,
              unwrap(await countAppointments({ ...params, ...TAB_COUNT_FILTERS[tab] })),
            ] as const,
        ),
      );
      return Object.fromEntries(entries) as Readonly<Record<CountedTab, number>>;
    },
    placeholderData: keepPreviousData,
    staleTime: LIST_STALE_TIME_MS,
  });
}

/** One appointment. `null` stays idle. */
export function useAppointmentQuery(id: string | null) {
  return useQuery({
    queryKey: appointmentsKeys.detail(id ?? ''),
    queryFn: async () => unwrap(await fetchAppointment(id ?? '')),
    enabled: id !== null,
  });
}

/** The appointment's history, oldest first. `null` stays idle. */
export function useAppointmentEventsQuery(id: string | null) {
  return useQuery({
    queryKey: appointmentsKeys.events(id ?? ''),
    queryFn: async () => unwrap(await fetchAppointmentEvents(id ?? '')),
    enabled: id !== null,
  });
}

/** The receipt of a paid appointment. `null` stays idle. */
export function useReceiptQuery(id: string | null) {
  return useQuery({
    queryKey: appointmentsKeys.receipt(id ?? ''),
    queryFn: async () => unwrap(await fetchReceipt(id ?? '')),
    enabled: id !== null,
    staleTime: RECEIPT_STALE_TIME_MS,
  });
}

/** What the token slip prints. `null` stays idle. */
export function useTokenSlipQuery(id: string | null) {
  return useQuery({
    queryKey: appointmentsKeys.tokenSlip(id ?? ''),
    queryFn: async () => unwrap(await fetchTokenSlip(id ?? '')),
    enabled: id !== null,
  });
}
