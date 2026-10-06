/**
 * Payments entities (module H9), as `/hospital/payments`, `/refunds` and
 * `/visits/{id}/receipts` serve them. Plain readonly types. A payment line is
 * money actually captured, failed or refunded (D-27) — an appointment still
 * waiting to be paid is not a line; it comes from the appointments feature.
 */

export type PaymentLineStatus = 'captured' | 'failed' | 'refunded';

/** `desk` = collected at the hospital; `online` = prepaid through Medibook. */
export type PaymentChannel = 'desk' | 'online';

export type PaymentMethod =
  'upi' | 'card' | 'netbanking' | 'wallet' | 'emi' | 'paylater' | 'cash' | 'pos' | 'other';

export interface PaymentPatient {
  readonly id: string;
  readonly mrn: string;
  readonly fullName: string;
}

/** One payment line. Exactly one of `appointmentId` / `visitId` is set. */
export interface PaymentLine {
  readonly id: string;
  readonly appointmentId: string | null;
  /** A desk visit paid as one group of consultations. */
  readonly visitId: string | null;
  readonly channel: PaymentChannel;
  readonly method: PaymentMethod;
  readonly amountRupees: number;
  readonly status: PaymentLineStatus;
  readonly capturedAt: string | null;
  readonly referenceNote: string | null;
  readonly collectedByName: string | null;
  readonly counterCode: string | null;
  readonly bookingRefs: readonly string[];
  readonly patient: PaymentPatient | null;
  readonly createdAt: string;
}

/** Server-side filters shared by the list and its export. */
export interface PaymentFilters {
  /** Hospital-local ISO dates, inclusive. */
  readonly dateFrom: string;
  readonly dateTo: string;
  /** Line statuses to include; empty for every status. */
  readonly statuses: readonly PaymentLineStatus[];
  readonly method: PaymentMethod | null;
  readonly doctorId: string | null;
  readonly departmentId: string | null;
  readonly q: string;
}

export interface PaymentPageQuery extends PaymentFilters {
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
}

/** One refund of a payment line. */
export interface PaymentRefund {
  readonly id: string;
  readonly amountRupees: number;
  readonly method: string;
  readonly status: 'requested' | 'processing' | 'processed' | 'failed';
  readonly reason: string;
  readonly processedAt: string | null;
}

/** One issued receipt of a desk visit (one per consultation). */
export interface VisitReceipt {
  readonly id: string;
  readonly receiptNo: string;
  readonly appointmentId: string | null;
  readonly totalRupees: number;
  readonly issuedAt: string;
}

/** Where a cash drawer stands (backend `CashSession.Status`). */
export type CashSessionStatus = 'open' | 'closed' | 'reconciled';

/**
 * One staff member's cash drawer for one business day (D-28). Cash payment
 * lines and cash refunds are only accepted while the collecting staff member
 * has an open session. Amounts stay in integer paise.
 */
export interface CashSession {
  readonly id: string;
  readonly staffId: string;
  readonly staffName: string;
  readonly counterCode: string | null;
  /** Hospital-local ISO date the drawer belongs to. */
  readonly businessDate: string;
  readonly openedAt: string;
  readonly openingFloatPaise: number;
  /** Float + cash taken − cash refunded, kept by the server. */
  readonly expectedCashPaise: number;
  /** What the staff member counted at close; `null` while open or when auto-closed. */
  readonly countedCashPaise: number | null;
  /** Counted − expected; `null` until counted. */
  readonly variancePaise: number | null;
  readonly closedAt: string | null;
  readonly closeNote: string | null;
  readonly status: CashSessionStatus;
  readonly reconciledAt: string | null;
}
