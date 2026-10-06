import type { Result } from '@/core/error/failure';

import type {
  AppointmentEvent,
  AppointmentRange,
  DeskAppointment,
  DeskReceipt,
  PaymentLineInput,
  TokenSlipData,
  WalkInInput,
  WalkInResult,
} from '@/features/appointments/domain/entities/appointments.entities';

/** Desk appointments: the day list, walk-ins and every desk action on one booking. */
export interface AppointmentsRepository {
  list(range: AppointmentRange): Promise<Result<readonly DeskAppointment[]>>;
  get(id: string): Promise<Result<DeskAppointment>>;
  events(id: string): Promise<Result<readonly AppointmentEvent[]>>;
  /** Book one or more walk-in consultations (each on an open slot). */
  createWalkIn(input: WalkInInput): Promise<Result<WalkInResult>>;
  updateRemark(id: string, remark: string, version: number): Promise<Result<DeskAppointment>>;
  approve(id: string): Promise<Result<DeskAppointment>>;
  /** Hospital rejection of a booking awaiting approval — refunds in full. */
  reject(id: string, reason: string): Promise<Result<DeskAppointment>>;
  checkIn(id: string): Promise<Result<DeskAppointment>>;
  noShow(id: string): Promise<Result<DeskAppointment>>;
  /** Hospital cancellation — refunds in full to the original methods. */
  cancel(id: string, reason: string): Promise<Result<DeskAppointment>>;
  /** Collect a walk-in's fee (split lines); returns the issued receipt. */
  collectPayment(id: string, lines: readonly PaymentLineInput[]): Promise<Result<DeskReceipt>>;
  /** Collect every unpaid consultation of a visit together; returns the one receipt. */
  collectVisitPayment(
    visitId: string,
    lines: readonly PaymentLineInput[],
  ): Promise<Result<DeskReceipt>>;
  /** Full refund, one per payment line to its original method. */
  refund(id: string, reason: string): Promise<Result<null>>;
  receipt(id: string): Promise<Result<DeskReceipt>>;
  /** A short-lived URL for the receipt PDF. */
  receiptPdfUrl(id: string): Promise<Result<string>>;
  tokenSlip(id: string): Promise<Result<TokenSlipData>>;
  /** The token slip PDF the backend renders (a 501 when it cannot render PDFs). */
  tokenSlipPdf(id: string): Promise<Result<Blob>>;
}
