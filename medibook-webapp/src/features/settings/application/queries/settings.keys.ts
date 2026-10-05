/** Query keys for Hospital Settings (H2) — standards §4, no inline key arrays. */
export const settingsKeys = {
  all: ['settings'] as const,
  profile: () => [...settingsKeys.all, 'profile'] as const,
  rules: () => [...settingsKeys.all, 'rules'] as const,
  hours: () => [...settingsKeys.all, 'hours'] as const,
  tokenPolicy: () => [...settingsKeys.all, 'token-policy'] as const,
  bankAccounts: () => [...settingsKeys.all, 'bank-accounts'] as const,
  imageUrl: (fileId: string) => [...settingsKeys.all, 'image-url', fileId] as const,
};

/** Settings change rarely and only from this screen; a minute keeps tabs in step. */
export const SETTINGS_STALE_TIME_MS = 60_000;
