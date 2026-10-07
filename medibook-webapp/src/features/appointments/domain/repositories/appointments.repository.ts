import type { Result } from '@/core/error/failure';

import type {
  AppointmentEvent,
  AppointmentListParams,
  AppointmentPage,
  AppointmentRange,
  DeskAppointment,
  DeskReceipt,
  DeskRefund,
  FeeQuote,
  PaymentLineInput,
  QuoteInput,
  RefundOutcome,
  TokenSlipData,
  WalkInInput,
  WalkInResult,
} from '@/features/appointments/domain/entities/appointments.entities';

/**
 * Desk appointments: the day list, walk-ins and every desk action on one
 * booking. Money and booking writes take the `idempotencyKey` minted once
 * per user action (D-21, UAT-16).
 */
export interface AppointmentsRepository {
  /** Every appointment of a window, in full (token queue, Payments). */
  list(range: AppointmentRange): Promise<Result<readonly DeskAppointment[]>>;
  /** One server-filtered, server-sorted page of the desk list. */
  listPage(params: AppointmentListParams): Promise<Result<AppointmentPage>>;
  /** How many appointments match a filter. */
  count(params: AppointmentListParams): Promise<Result<number>>;
  get(id: string): Promise<Result<DeskAppointment>>;
  events(id: string): Promise<Result<readonly AppointmentEvent[]>>;
  /**
   * The real fee of a walk-in before booking (APPT-05) — follow-up pricing,
   * service, tax. `null` when the backend has no quote endpoint yet.
   */
  quote(input: QuoteInput): Promise<Result<FeeQuote | null>>;
  /** Book one or more walk-in consultations (each on an open slot). */
  createWalkIn(input: WalkInInput, idempotencyKey: string): Promise<Result<WalkInResult>>;
  updateRemark(id: string, remark: string, version: number): Promise<Result<DeskAppointment>>;
  approve(id: string): Promise<Result<DeskAppointment>>;
  /** Hospital rejection of a booking awaiting approval — refunds what was paid, in full. */
  reject(id: string, reason: string, idempotencyKey: string): Promise<Result<RefundOutcome>>;
  checkIn(id: string, idempotencyKey: string): Promise<Result<DeskAppointment>>;
  noShow(id: string): Promise<Result<DeskAppointment>>;
  /** Hospital cancellation — refunds what was paid, in full, to the original methods. */
  cancel(id: string, reason: string, idempotencyKey: string): Promise<Result<RefundOutcome>>;
  /** Collect a walk-in's fee (split lines); returns the issued receipt. */
  collectPayment(
    id: string,
    lines: readonly PaymentLineInput[],
    idempotencyKey: string,
  ): Promise<Result<DeskReceipt>>;
  /** Full refund, one per payment line to its original method. */
  refund(
    id: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<Result<readonly DeskRefund[]>>;
  receipt(id: string): Promise<Result<DeskReceipt>>;
  /** A short-lived URL for the receipt PDF. */
  receiptPdfUrl(id: string): Promise<Result<string>>;
  tokenSlip(id: string): Promise<Result<TokenSlipData>>;
  /** The token slip PDF the backend renders (a 501 when it cannot render PDFs). */
  tokenSlipPdf(id: string): Promise<Result<Blob>>;
}
