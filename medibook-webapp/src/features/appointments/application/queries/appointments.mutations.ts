import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { newIdempotencyKey } from '@/core/api/headers';
import { unwrap } from '@/core/error/failure';

import type {
  DeskAppointment,
  PaymentLineInput,
  RefundOutcome,
  WalkInInput,
} from '@/features/appointments/domain/entities/appointments.entities';
import { appointmentsKeys } from '@/features/appointments/application/queries/appointments.keys';
import { approveAppointment } from '@/features/appointments/application/usecases/appointments.approveAppointment';
import { bookWalkIn } from '@/features/appointments/application/usecases/appointments.bookWalkIn';
import { cancelAppointment } from '@/features/appointments/application/usecases/appointments.cancelAppointment';
import { checkInAppointment } from '@/features/appointments/application/usecases/appointments.checkInAppointment';
import { collectPayment } from '@/features/appointments/application/usecases/appointments.collectPayment';
import { fetchReceiptPdfUrl } from '@/features/appointments/application/usecases/appointments.fetchReceiptPdfUrl';
import { fetchTokenSlipPdf } from '@/features/appointments/application/usecases/appointments.fetchTokenSlipPdf';
import { markNoShow } from '@/features/appointments/application/usecases/appointments.markNoShow';
import { refundAppointment } from '@/features/appointments/application/usecases/appointments.refundAppointment';
import { rejectAppointment } from '@/features/appointments/application/usecases/appointments.rejectAppointment';
import { updateRemark } from '@/features/appointments/application/usecases/appointments.updateRemark';
import { dashboardKeys } from '@/features/dashboard/application/queries/dashboard.keys';
import { patientsKeys } from '@/features/patients/application/queries/patients.keys';
import { paymentsKeys } from '@/features/payments/application/queries/payments.keys';
import { slotsKeys } from '@/features/slots/application/queries/slots.keys';
import { tokenQueueKeys } from '@/features/token-queue/application/queries/tokenQueue.keys';

/**
 * Every desk view a booking-side change can move (UAT-17): the appointment
 * lists and counts, the live queue, the dashboards, Payments with the cash
 * drawer's expected cash, the slot grid and the patient's visit history.
 */
export function invalidateDeskViews(queryClient: QueryClient, appointmentId?: string): void {
  void queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
  if (appointmentId) {
    void queryClient.invalidateQueries({ queryKey: appointmentsKeys.detail(appointmentId) });
    void queryClient.invalidateQueries({ queryKey: appointmentsKeys.events(appointmentId) });
  }
  void queryClient.invalidateQueries({ queryKey: tokenQueueKeys.all });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  void queryClient.invalidateQueries({ queryKey: paymentsKeys.all });
  void queryClient.invalidateQueries({ queryKey: slotsKeys.all });
  void queryClient.invalidateQueries({ queryKey: patientsKeys.all });
}

/** An action that returns the updated appointment: cache it, then refresh the rest. */
function useAppointmentAction<V extends { readonly id: string }>(
  run: (variables: V) => Promise<DeskAppointment>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (appt) => {
      queryClient.setQueryData(appointmentsKeys.detail(appt.id), appt);
      invalidateDeskViews(queryClient, appt.id);
    },
  });
}

/** A cancel or reject: cache the booking as it now stands, then refresh the rest. */
function useRefundingAction<V extends { readonly id: string }>(
  run: (variables: V) => Promise<RefundOutcome>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (outcome) => {
      queryClient.setQueryData(
        appointmentsKeys.detail(outcome.appointment.id),
        outcome.appointment,
      );
      invalidateDeskViews(queryClient, outcome.appointment.id);
    },
  });
}

interface IdOnly {
  readonly id: string;
}

/**
 * Money and booking writes carry the key the screen minted once for this
 * user action and reuses on retry (UAT-16). A caller that does not pass one
 * gets a key per `mutate` call — one per click, never per HTTP attempt.
 */
interface Keyed {
  readonly idempotencyKey?: string;
}

interface WithReason extends IdOnly, Keyed {
  readonly reason: string;
}

export function useApproveMutation() {
  return useAppointmentAction(async ({ id }: IdOnly) => unwrap(await approveAppointment(id)));
}

export function useRejectMutation() {
  return useRefundingAction(async ({ id, reason, idempotencyKey }: WithReason) =>
    unwrap(await rejectAppointment(id, reason, idempotencyKey ?? newIdempotencyKey())),
  );
}

export function useCheckInMutation() {
  return useAppointmentAction(async ({ id, idempotencyKey }: IdOnly & Keyed) =>
    unwrap(await checkInAppointment(id, idempotencyKey ?? newIdempotencyKey())),
  );
}

export function useNoShowMutation() {
  return useAppointmentAction(async ({ id }: IdOnly) => unwrap(await markNoShow(id)));
}

export function useCancelMutation() {
  return useRefundingAction(async ({ id, reason, idempotencyKey }: WithReason) =>
    unwrap(await cancelAppointment(id, reason, idempotencyKey ?? newIdempotencyKey())),
  );
}

interface RemarkInput extends IdOnly {
  readonly remark: string;
  readonly version: number;
}

/**
 * Save the desk remark under `If-Match`. On a version conflict the detail is
 * re-read so the next try carries the current version (03 F10).
 */
export function useRemarkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, remark, version }: RemarkInput) =>
      unwrap(await updateRemark(id, remark, version)),
    onSuccess: (appt) => {
      queryClient.setQueryData(appointmentsKeys.detail(appt.id), appt);
      void queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: appointmentsKeys.events(appt.id) });
    },
    onError: (_error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: appointmentsKeys.detail(id) });
    },
  });
}

interface WalkInVariables {
  readonly input: WalkInInput;
  readonly idempotencyKey: string;
}

/** Book a walk-in visit; every booked appointment and its slot change. */
export function useBookWalkInMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, idempotencyKey }: WalkInVariables) =>
      unwrap(await bookWalkIn(input, idempotencyKey)),
    onSuccess: () => invalidateDeskViews(queryClient),
    // A refused slot (taken, ended, session closed) must leave the picker.
    onError: () => void queryClient.invalidateQueries({ queryKey: slotsKeys.all }),
  });
}

interface PaymentInput extends IdOnly, Keyed {
  readonly lines: readonly PaymentLineInput[];
}

/** Collect a walk-in's fee; the issued receipt is cached for the receipt modal. */
export function useCollectPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lines, idempotencyKey }: PaymentInput) =>
      unwrap(await collectPayment(id, lines, idempotencyKey ?? newIdempotencyKey())),
    onSuccess: (receipt, { id }) => {
      queryClient.setQueryData(appointmentsKeys.receipt(id), receipt);
      invalidateDeskViews(queryClient, id);
    },
  });
}

export function useRefundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason, idempotencyKey }: WithReason) =>
      unwrap(await refundAppointment(id, reason, idempotencyKey ?? newIdempotencyKey())),
    onSuccess: (_refunds, { id }) => invalidateDeskViews(queryClient, id),
  });
}

/** Mint a short-lived receipt PDF link (never cached — it expires). */
export function useReceiptPdfMutation() {
  return useMutation({
    mutationFn: async (id: string) => unwrap(await fetchReceiptPdfUrl(id)),
  });
}

/** Fetch the backend-rendered token slip PDF. */
export function useTokenSlipPdfMutation() {
  return useMutation({
    mutationFn: async (id: string) => unwrap(await fetchTokenSlipPdf(id)),
  });
}
