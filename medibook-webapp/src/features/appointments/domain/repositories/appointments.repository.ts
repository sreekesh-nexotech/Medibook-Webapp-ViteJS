import type { Result } from '@/core/error/failure';

import type {
  AppointmentEvent,
  AppointmentList,
  AppointmentRange,
  ApptSource,
  DeskAppointment,
  DeskReceipt,
  PaymentLineInput,
  TokenSlipData,
  WalkInInput,
  WalkInResult,
} from '@/features/appointments/domain/entities/appointments.entities';

/**
 * Desk appointments: the day list, walk-ins and every desk action on one booking.
 * `replayKey` is the caller's idempotency key for that user intent (DATA-04).
 */
export interface AppointmentsRepository {
  list(range: AppointmentRange): Promise<Result<AppointmentList>>;
  /** How many appointments `range` holds, of one `source` or all. */
  count(range: AppointmentRange, source: ApptSource | null): Promise<Result<number>>;
  get(id: string): Promise<Result<DeskAppointment>>;
  events(id: string): Promise<Result<readonly AppointmentEvent[]>>;
  /** Book one or more walk-in consultations (each on an open slot). */
  createWalkIn(input: WalkInInput, replayKey: string): Promise<Result<WalkInResult>>;
  updateRemark(id: string, remark: string, version: number): Promise<Result<DeskAppointment>>;
  approve(id: string): Promise<Result<DeskAppointment>>;
  /** Hospital rejection of a booking awaiting approval — refunds in full. */
  reject(id: string, reason: string, replayKey: string): Promise<Result<DeskAppointment>>;
  checkIn(id: string, replayKey: string): Promise<Result<DeskAppointment>>;
  noShow(id: string): Promise<Result<DeskAppointment>>;
  /** Hospital cancellation — refunds in full to the original methods. */
  cancel(id: string, reason: string, replayKey: string): Promise<Result<DeskAppointment>>;
  /** Collect a walk-in's fee (split lines); returns the issued receipt. */
  collectPayment(
    id: string,
    lines: readonly PaymentLineInput[],
    replayKey: string,
  ): Promise<Result<DeskReceipt>>;
  /** Full refund, one per payment line to its original method. */
  refund(id: string, reason: string, replayKey: string): Promise<Result<null>>;
  receipt(id: string): Promise<Result<DeskReceipt>>;
  /** A short-lived URL for the receipt PDF. */
  receiptPdfUrl(id: string): Promise<Result<string>>;
  tokenSlip(id: string): Promise<Result<TokenSlipData>>;
}
