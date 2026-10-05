/** Query keys for the platform settings screen. */
export const opsSettingsKeys = {
  all: ['ops-settings'] as const,
  settings: () => [...opsSettingsKeys.all, 'settings'] as const,
  featureFlags: () => [...opsSettingsKeys.all, 'feature-flags'] as const,
  taxRates: () => [...opsSettingsKeys.all, 'tax-rates'] as const,
};

/** Platform config changes rarely and only from this screen. */
export const OPS_SETTINGS_STALE_TIME_MS = 60_000;
