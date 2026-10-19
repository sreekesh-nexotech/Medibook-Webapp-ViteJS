/**
 * The waiting-room display (TV in the OPD hall). It signs in with a device key
 * an admin issues under Hospital Settings › Display Screens and shows today's
 * queue for every doctor session (or the doctors/counters chosen for it).
 */

/** What `POST /display/auth` grants: a short-lived token for this screen. */
export interface DisplayGrant {
  readonly accessToken: string;
  /** ISO time the token stops working. */
  readonly expiresAt: string;
  readonly deviceName: string;
}

/** Session status as the server reports it. */
export type DisplaySessionStatus = 'scheduled' | 'open' | 'paused' | 'closed' | (string & {});

/** One doctor session on the board. */
export interface DisplaySession {
  readonly id: string;
  readonly label: string;
  readonly status: DisplaySessionStatus;
  /** Free-form queue state (`available`, `consulting`, `on_break`, …). */
  readonly queueState: string;
  readonly doctorName: string;
  readonly room: string | null;
  readonly counterCode: string | null;
  /** The token being seen now, e.g. "A003". */
  readonly currentToken: string | null;
  /** First name + last initial (or full name when the hospital allows it). */
  readonly currentPatient: string | null;
  readonly lastCalledToken: string | null;
  /** ISO time of the latest call — a change means a new "Now calling". */
  readonly lastCalledAt: string | null;
  readonly waitingCount: number;
}

/** Everything the board shows. */
export interface DisplayBoard {
  readonly hospitalName: string;
  /** Hospital-local date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly sessions: readonly DisplaySession[];
}
