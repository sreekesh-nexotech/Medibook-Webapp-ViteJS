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
