/**
 * The live token queue. The backend's queue unit is a **doctor session** —
 * one doctor, one date, one named session (D-15) — so every command targets
 * a session. Plain readonly types.
 */

export type SessionStatus = 'scheduled' | 'open' | 'paused' | 'closed' | 'cancelled';

/** What the doctor is doing right now. `waiting` = a token was called, the patient is on the way. */
export type QueueState = 'available' | 'waiting' | 'consulting' | 'on_break';

export interface QueueSession {
  readonly id: string;
  readonly doctorId: string;
  /** Hospital-local `yyyy-mm-dd`. */
  readonly date: string;
  readonly sessionCode: string;
  readonly label: string;
  readonly status: SessionStatus;
  readonly queueState: QueueState;
  /** The token on the desk now (called or in consultation), if any. */
  readonly currentTokenNo: number | null;
  readonly currentAppointmentId: string | null;
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
