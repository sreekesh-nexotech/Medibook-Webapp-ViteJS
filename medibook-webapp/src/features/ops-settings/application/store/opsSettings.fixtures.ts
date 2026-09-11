/**
 * Seed data for platform settings — transcribed verbatim from the design
 * prototype's `OpsDB.settings` (Ops.jsx).
 */
import type {
  OpsSettings,
  PayoutSchedule,
  SessionTimeout,
} from '@/features/ops-settings/application/store/opsSettings.types';

export const OPS_DEFAULT_SETTINGS: OpsSettings = {
  orgName: 'Medibook',
  orgEmail: 'support@medibook.in',
  orgPhone: '1800 220 440',
  payoutSched: 'Weekly',
  commission: '10',
  gst: '27AABCM9407L1ZK',
  notifSettle: true,
  notifCompliance: true,
  notifDigest: false,
  twoFAReq: true,
  sessTimeout: '30 min',
};

/** The Payout Schedule select's options. */
export const PAYOUT_SCHEDULE_OPTIONS: readonly PayoutSchedule[] = [
  'Weekly',
  'Fortnightly',
  'Monthly',
];

/**
 * The Session Timeout select's options — the only list the UI offers, so the
 * `"<n> min"` contract `useIdleTimeout` depends on lives in one place.
 */
export const SESSION_TIMEOUT_OPTIONS: readonly SessionTimeout[] = ['15 min', '30 min', '60 min'];

/** The live API key as first issued (rotating it mints a new one). */
export const OPS_DEFAULT_API_KEY = 'mb_live_9f42••••••••7d1c';
