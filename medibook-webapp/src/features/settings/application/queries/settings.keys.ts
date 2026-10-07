/** Query keys for Hospital Settings (H2) — standards §4, no inline key arrays. */
export const settingsKeys = {
  all: ['settings'] as const,
  profile: () => [...settingsKeys.all, 'profile'] as const,
  rules: () => [...settingsKeys.all, 'rules'] as const,
  hours: () => [...settingsKeys.all, 'hours'] as const,
  tokenPolicy: () => [...settingsKeys.all, 'token-policy'] as const,
  bankAccounts: () => [...settingsKeys.all, 'bank-accounts'] as const,
  imageUrl: (fileId: string) => [...settingsKeys.all, 'image-url', fileId] as const,
  numbering: () => [...settingsKeys.all, 'numbering'] as const,
  numberingPreview: (kind: string, version: number) =>
    [...settingsKeys.numbering(), 'preview', kind, version] as const,
  counters: () => [...settingsKeys.all, 'counters'] as const,
  printTemplates: () => [...settingsKeys.all, 'print-templates'] as const,
  printPreview: (id: string, version: number) =>
    [...settingsKeys.printTemplates(), 'preview', id, version] as const,
  displayDevices: () => [...settingsKeys.all, 'display-devices'] as const,
};

/** Settings change rarely and only from this screen; a minute keeps tabs in step. */
export const SETTINGS_STALE_TIME_MS = 60_000;
