import { create } from 'zustand';

import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';

import { OPS_DEFAULT_API_KEY, OPS_DEFAULT_SETTINGS } from './opsSettings.fixtures';
import type { OpsSettings } from './opsSettings.types';

/**
 * Platform settings store (design `OpsDB.settings` + the Ops.jsx OpsSettings
 * save flow). Saving replaces the whole record and writes the design's audit
 * line; the "Settings saved." toast comes from the screen's `useOpsAct` run.
 *
 * `sessTimeout` inside `settings` is what the shared `useIdleTimeout` reads in
 * `OpsShell` — see `opsSettings.types.ts` for the `"<n> min"` contract.
 *
 * The API key is deliberately **outside** `settings`: it is not an edited
 * field, so keeping it separate means rotating it can never be undone by a
 * form that was opened before the rotation.
 */

/** Compliance-log module name for platform-settings actions. */
const SETTINGS_LOG_MODULE = 'Settings';

/** Hex characters a minted key segment is drawn from. */
const KEY_ALPHABET = '0123456789abcdef';
const KEY_PREFIX_LEN = 4;
const KEY_SUFFIX_LEN = 4;

/** A fresh masked live key, in the same shape as the issued one. */
function mintApiKey(): string {
  const chars = (n: number): string =>
    Array.from(
      { length: n },
      () => KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)],
    ).join('');
  return `mb_live_${chars(KEY_PREFIX_LEN)}••••••••${chars(KEY_SUFFIX_LEN)}`;
}

interface OpsSettingsState {
  settings: OpsSettings;
  /** The live API key as shown in Security — masked, never a real secret. */
  apiKey: string;
}

interface OpsSettingsActions {
  /** Persist the edited settings (+ "Settings updated" audit line). */
  save: (next: OpsSettings) => void;
  /** Replace the live API key with a newly minted one (+ audit line). */
  rotateApiKey: () => void;
}

export const useOpsSettingsStore = create<OpsSettingsState & OpsSettingsActions>()((set, get) => ({
  settings: OPS_DEFAULT_SETTINGS,
  apiKey: OPS_DEFAULT_API_KEY,

  save: (next) => {
    const before = get().settings;
    set({ settings: { ...next } });
    const changed = (Object.keys(next) as (keyof OpsSettings)[]).filter(
      (k) => next[k] !== before[k],
    );
    useLogsStore.getState().addLog({
      action:
        changed.length > 0
          ? `Settings updated — ${changed.join(', ')}`
          : 'Settings updated — platform preferences',
      module: SETTINGS_LOG_MODULE,
      sev: 'Info',
    });
  },

  rotateApiKey: () => {
    set({ apiKey: mintApiKey() });
    useLogsStore.getState().addLog({
      action: 'API key rotated — platform integrations',
      module: SETTINGS_LOG_MODULE,
      sev: 'Critical',
    });
  },
}));
