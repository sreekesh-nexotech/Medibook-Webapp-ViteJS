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
  /** Groups a doctor's sessions into one row on the board; `''` from an older backend. */
  readonly doctorId: string;
  readonly doctorName: string;
  readonly room: string | null;
  readonly counterCode: string | null;
  /** The token being seen now, e.g. "A003". */
  readonly currentToken: string | null;
  /** Its plain number (3), which the hall board shows (client feedback point 7). */
  readonly currentTokenNo: number | null;
  /** First name + last initial (or full name when the hospital allows it). */
  readonly currentPatient: string | null;
  readonly lastCalledToken: string | null;
  /** ISO time of the latest call — a change means a new "Now calling". */
  readonly lastCalledAt: string | null;
  readonly waitingCount: number;
}

/** Doctor status as the server reports it. */
export type DisplayDoctorStatus = 'active' | 'on_leave' | (string & {});

/** A doctor of the screen's selection with no session today — a greyed-out row (point 7). */
export interface DisplayDoctorOffToday {
  readonly id: string;
  readonly name: string;
  readonly room: string | null;
  readonly status: DisplayDoctorStatus;
}

/** Everything the board shows. */
export interface DisplayBoard {
  readonly hospitalName: string;
  /**
   * The hospital logo: a short-lived signed URL and the file it points at. The id stays the same
   * while the URL changes on every refresh, so the screen keeps the image it already has.
   */
  readonly logo: { readonly fileId: string; readonly url: string } | null;
  /** The one department this screen is tied to, or `null` when it shows every department. */
  readonly departmentName: string | null;
  /** Hospital-local date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly sessions: readonly DisplaySession[];
  /** Empty when everyone works today, on a counter screen, or from an older backend. */
  readonly doctorsOffToday: readonly DisplayDoctorOffToday[];
}
