/**
 * Every browser-storage key the app writes, defined once (standards §5:
 * "storage keys via constants — never magic strings").
 */

/** Per-surface refresh token (sessionStorage — survives a reload, not a closed tab). */
export const STORAGE_KEY_REFRESH_TOKEN = {
  hospital: 'medibook.auth.hospital.refresh',
  platform: 'medibook.auth.platform.refresh',
} as const;
