/**
 * Staff idle limit in minutes when the configured one cannot be read. It is
 * the backend's own default: hospital and platform sessions end after
 * `platform_settings.session_timeout_min` (15) idle minutes (Q65,
 * `SESSION_IDLE_TTL`). The hospital surface cannot read that setting, and
 * not every platform role may.
 */
export const DEFAULT_IDLE_MINUTES = 15;
