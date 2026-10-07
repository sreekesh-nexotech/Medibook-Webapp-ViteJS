/**
 * Every browser-storage key the app writes, defined once (standards §5:
 * "storage keys via constants — never magic strings").
 */

/**
 * Per-surface refresh token: in sessionStorage by default (survives a reload,
 * not a closed tab), in localStorage when the user ticked "Remember me".
 */
export const STORAGE_KEY_REFRESH_TOKEN = {
  hospital: 'medibook.auth.hospital.refresh',
  platform: 'medibook.auth.platform.refresh',
} as const;

/**
 * Per-surface time (epoch ms) of the user's last keyboard, mouse or touch
 * input in any tab of this browser, so the idle sign-out waits until every
 * tab is idle (UAT-04). A timestamp only — no personal data.
 */
export const STORAGE_KEY_LAST_ACTIVITY = {
  hospital: 'medibook.activity.hospital',
  platform: 'medibook.activity.platform',
} as const;

/**
 * Bell items the user marked read, per signed-in user (`<prefix><scope>`).
 * The fallback while the backend keeps no notification read state (DASH-03):
 * it survives reloads and is shared by this browser's tabs (UAT-68).
 */
export const STORAGE_KEY_BELL_SEEN_PREFIX = 'medibook.bell.seen.';
