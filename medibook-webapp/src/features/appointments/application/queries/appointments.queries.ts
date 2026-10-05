import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AppointmentRange } from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { fetchAppointment } from '@/features/appointments/application/usecases/appointments.fetchAppointment';
import { fetchAppointmentEvents } from '@/features/appointments/application/usecases/appointments.fetchAppointmentEvents';
import { fetchAppointments } from '@/features/appointments/application/usecases/appointments.fetchAppointments';
import { fetchReceipt } from '@/features/appointments/application/usecases/appointments.fetchReceipt';
import { fetchTokenSlip } from '@/features/appointments/application/usecases/appointments.fetchTokenSlip';

/** The desk list moves all day (check-ins, payments); keep it fresh. */
const LIST_STALE_TIME_MS = 15_000;

/** A receipt never changes once issued. */
const RECEIPT_STALE_TIME_MS = 10 * 60_000;

/** Every appointment in a hospital-local date window (all pages). */
export function useAppointmentsQuery(range: AppointmentRange) {
  return useQuery({
    queryKey: appointmentsKeys.list(range),
    queryFn: async () => unwrap(await fetchAppointments(range)),
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
