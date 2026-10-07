/**
 * The live token queue. The backend's queue unit is a **doctor session** —
 * one doctor, one date, one named session (D-15) — so every command targets
 * a session. Plain readonly types.
 */

export type SessionStatus = 'scheduled' | 'open' | 'paused' | 'closed' | 'cancelled';

/** What the doctor is doing right now. `waiting` = a token was called, the patient is on the way. */
export type QueueState = 'available' | 'waiting' | 'consulting' | 'on_break';

/**
 * Where a token sits in the server's queue (B5 `queue[].kind`): at the desk,
 * with the doctor, waiting for Call Next, or called earlier and skipped.
 */
export type QueueRowKind = 'current' | 'in_consultation' | 'up_next' | 'called';

/** One token of the server's own queue list, in its order (B5 snapshot `queue`). */
export interface QueueRow {
  readonly appointmentId: string;
  readonly tokenNo: number;
  readonly tokenLabel: string | null;
  readonly status: string;
  readonly kind: QueueRowKind;
  /** 1..n in Call Next order (up-next rows only). */
  readonly position: number | null;
  readonly estimatedWaitMinutes: number | null;
  readonly calledAt: string | null;
  readonly consultationStartedAt: string | null;
  readonly skipCount: number;
  /** The hospital's skip limit is reached — the desk may offer a no-show (never automatic). */
  readonly offerNoShow: boolean;
  /** Hospital REST and the hospital socket only. */
  readonly patientName: string | null;
  readonly mrn: string | null;
}

export interface QueueSession {
  readonly id: string;
  readonly doctorId: string;
  /** The doctor's department, when the backend sends it (BE-20); else join through the roster. */
  readonly departmentId: string | null;
  readonly departmentName: string | null;
  /** Hospital-local `yyyy-mm-dd`. */
  readonly date: string;
  readonly sessionCode: string;
  readonly label: string;
  readonly status: SessionStatus;
  readonly queueState: QueueState;
  /**
   * How far the queue has got — the backend's progress pointer, **never
   * cleared**. It is the desk's token only while `currentAppointmentId` is
   * set (UAT-01).
   */
  readonly currentTokenNo: number | null;
  /** The appointment at the desk (called or with the doctor); `null` when the desk is free. */
  readonly currentAppointmentId: string | null;
  /** The hospital's own label of the token at the desk (BE-20), when the backend sends it. */
  readonly currentTokenLabel: string | null;
  /** When the current consultation started (BE-20), when the backend sends it. */
  readonly consultationStartedAt: string | null;
  /** Effective expected consultation minutes (TOK-01), when the backend sends them. */
  readonly expectedMinutes: number | null;
  /** Skips after which a no-show is offered (Q27), when sent. */
  readonly noShowCallAttempts: number | null;
  /** Tokens Call Next can still call (B5: enable Call Next iff > 0), when sent. */
  readonly upNextCount: number | null;
  /**
   * The server's own queue — current, in consultation, up next in call
   * order, then called/skipped — or `null` from a backend that does not
   * send it (the screen then derives it from the day's bookings).
   */
  readonly queue: readonly QueueRow[] | null;
  readonly lastCalledTokenNo: number | null;
  readonly lastCalledAt: string | null;
  readonly servedCount: number;
  /** Scheduled or checked-in, not yet completed. */
  readonly waitingCount: number;
  readonly completedCount: number;
  readonly noShowCount: number;
  readonly version: number;
}

/** Commands on the whole session. */
export type SessionCommand = 'open' | 'call-next' | 'pause' | 'resume' | 'close';

/** Commands on one token of the session. */
export type TokenCommand = 'serve' | 'complete' | 'no-show' | 'call' | 'recall';

/** A skip answers how often this token was skipped and whether to offer a no-show (Q27). */
export interface SkipOutcome {
  readonly session: QueueSession;
  readonly attempts: number;
  /** The hospital's attempt limit is reached — offer a no-show (never automatic, Q87). */
  readonly offerNoShow: boolean;
}

/** What happened to a token (`token_calls.event`). */
export type TokenCallEvent = 'called' | 'recalled' | 'skipped' | 'served' | 'no_show' | 'cancelled';

/** One row of a session's append-only call history (`GET /hospital/sessions/{id}/calls`). */
export interface TokenCall {
  readonly id: string;
  readonly appointmentId: string;
  readonly tokenNo: number;
  /** The token's label, when the backend sends it; else read it from the appointment. */
  readonly tokenLabel: string | null;
  readonly event: TokenCallEvent;
  readonly attemptNo: number;
  readonly actorName: string | null;
  readonly counterCode: string | null;
  readonly occurredAt: string;
}
