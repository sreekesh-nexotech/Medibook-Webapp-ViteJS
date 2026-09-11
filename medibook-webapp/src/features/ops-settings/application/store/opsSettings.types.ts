/**
 * Platform-settings view-model types (interim entities for the static-seed
 * phase). Shape transcribed from the design prototype's `OpsDB.settings`
 * (Ops.jsx).
 */

/** Payout run cadence (the Payout Schedule select's options). */
export type PayoutSchedule = 'Weekly' | 'Fortnightly' | 'Monthly';

/**
 * Admin session timeout (the Session Timeout select's options).
 *
 * **Contract (audit 3.7.5):** the shared `useIdleTimeout` in `OpsShell` reads
 * `settings.sessTimeout` and takes the idle minutes from it with
 * `Number.parseInt(value, 10)`. Every member must therefore start with the
 * number of minutes — `"45 min"` is fine, `"1 hour"` would silently become
 * one minute. Keep `SESSION_TIMEOUT_OPTIONS` (fixtures) as the single list
 * the UI offers.
 */
export type SessionTimeout = '15 min' | '30 min' | '60 min';

/** Platform-wide preferences and defaults. */
export interface OpsSettings {
  readonly orgName: string;
  readonly orgEmail: string;
  readonly orgPhone: string;
  readonly payoutSched: PayoutSchedule;
  /** Platform commission percentage as entered in the text field (0–100). */
  readonly commission: string;
  readonly gst: string;
  readonly notifSettle: boolean;
  readonly notifCompliance: boolean;
  readonly notifDigest: boolean;
  readonly twoFAReq: boolean;
  readonly sessTimeout: SessionTimeout;
}
