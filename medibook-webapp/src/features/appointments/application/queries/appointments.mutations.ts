import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  DeskAppointment,
  PaymentLineInput,
  WalkInInput,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { approveAppointment } from '@/features/appointments/application/usecases/appointments.approveAppointment';
import { bookWalkIn } from '@/features/appointments/application/usecases/appointments.bookWalkIn';
import { cancelAppointment } from '@/features/appointments/application/usecases/appointments.cancelAppointment';
import { checkInAppointment } from '@/features/appointments/application/usecases/appointments.checkInAppointment';
import { collectPayment } from '@/features/appointments/application/usecases/appointments.collectPayment';
import { fetchReceiptPdfUrl } from '@/features/appointments/application/usecases/appointments.fetchReceiptPdfUrl';
import { markNoShow } from '@/features/appointments/application/usecases/appointments.markNoShow';
import { refundAppointment } from '@/features/appointments/application/usecases/appointments.refundAppointment';
import { rejectAppointment } from '@/features/appointments/application/usecases/appointments.rejectAppointment';
import { updateRemark } from '@/features/appointments/application/usecases/appointments.updateRemark';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { slotsKeys } from '@/features/slots/application/queries/slots.keys';

/**
 * After any desk action on one appointment: the lists, its detail and
 * history move; a booking or a cancellation also frees or takes a slot and
 * changes the patient's visit history.
 */
function invalidateAppointment(queryClient: QueryClient, id: string, touchesSlots = false): void {
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.detail(id) });
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.events(id) });
  if (touchesSlots) {
    void queryClient.invalidateQueries({ queryKey: slotsKeys.all });
    void queryClient.invalidateQueries({ queryKey: patientsKeys.all });
  }
}

/** An action that returns the updated appointment: cache it, then refresh the rest. */
function useAppointmentAction<V extends { readonly id: string }>(
  run: (variables: V) => Promise<DeskAppointment>,
  touchesSlots = false,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (appt) => {
      queryClient.setQueryData(appointmentsKeys.detail(appt.id), appt);
      invalidateAppointment(queryClient, appt.id, touchesSlots);
    },
  });
}

interface IdOnly {
  readonly id: string;
}

interface WithReason extends IdOnly {
  readonly reason: string;
}

export function useApproveMutation() {
  return useAppointmentAction(async ({ id }: IdOnly) => unwrap(await approveAppointment(id)));
}

export function useRejectMutation() {
  return useAppointmentAction(
    async ({ id, reason }: WithReason) => unwrap(await rejectAppointment(id, reason)),
    true,
  );
}

export function useCheckInMutation() {
  return useAppointmentAction(async ({ id }: IdOnly) => unwrap(await checkInAppointment(id)));
}

export function useNoShowMutation() {
  return useAppointmentAction(async ({ id }: IdOnly) => unwrap(await markNoShow(id)));
}

export function useCancelMutation() {
  return useAppointmentAction(
    async ({ id, reason }: WithReason) => unwrap(await cancelAppointment(id, reason)),
    true,
  );
}

interface RemarkInput extends IdOnly {
  readonly remark: string;
  readonly version: number;
}

export function useRemarkMutation() {
  return useAppointmentAction(async ({ id, remark, version }: RemarkInput) =>
    unwrap(await updateRemark(id, remark, version)),
  );
}

/** Book a walk-in visit; every booked appointment and its slot change. */
export function useBookWalkInMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WalkInInput) => unwrap(await bookWalkIn(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: slotsKeys.all });
      void queryClient.invalidateQueries({ queryKey: patientsKeys.all });
    },
  });
}

interface PaymentInput extends IdOnly {
  readonly lines: readonly PaymentLineInput[];
}

/** Collect a walk-in's fee; the issued receipt is cached for the receipt modal. */
export function useCollectPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lines }: PaymentInput) => unwrap(await collectPayment(id, lines)),
    onSuccess: (receipt, { id }) => {
      queryClient.setQueryData(appointmentsKeys.receipt(id), receipt);
      invalidateAppointment(queryClient, id);
    },
  });
}

export function useRefundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: WithReason) => unwrap(await refundAppointment(id, reason)),
    onSuccess: (_data, { id }) => invalidateAppointment(queryClient, id),
  });
}

/** Mint a short-lived receipt PDF link (never cached — it expires). */
export function useReceiptPdfMutation() {
  return useMutation({
    mutationFn: async (id: string) => unwrap(await fetchReceiptPdfUrl(id)),
  });
}
