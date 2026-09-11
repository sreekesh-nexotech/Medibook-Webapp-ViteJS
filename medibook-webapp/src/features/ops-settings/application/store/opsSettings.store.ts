import { create } from 'zustand';

import {
  OPS_ACTING_USER_EMAIL,
  useComplianceStore,
} from '@/features/ops-compliance/application/store/compliance.store';
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

/** Where a settings change is filed in the compliance change log. */
const SETTINGS_AREA = 'Platform Settings';

/** Human label per settings key, for the audit trail and the change log. */
const SETTING_LABEL: Readonly<Record<keyof OpsSettings, string>> = {
  orgName: 'Platform name',
  orgEmail: 'Support email',
  orgPhone: 'Helpline number',
  payoutSched: 'Payout schedule',
  commission: 'Platform commission',
  gst: 'GST number',
  notifSettle: 'Settlement alerts',
  notifCompliance: 'Compliance alerts',
  notifDigest: 'Weekly digest',
  twoFAReq: 'Require 2FA for all admins',
  sessTimeout: 'Session timeout',
};

/** A settings value as the change log should read it. */
function settingValue(key: keyof OpsSettings, value: OpsSettings[keyof OpsSettings]): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (key === 'commission') return `${value}%`;
  return String(value) || '—';
}

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
    // Audit 2.5 / SA-06: the compliance change log is fed by the screens that
    // actually change things, so every row carries a real before → after pair.
    const record = useComplianceStore.getState().recordChange;
    changed.forEach((k) =>
      record({
        actor: OPS_ACTING_USER_EMAIL,
        area: SETTINGS_AREA,
        setting: SETTING_LABEL[k],
        before: settingValue(k, before[k]),
        after: settingValue(k, next[k]),
        scope: 'Platform',
      }),
    );
    useLogsStore.getState().addLog({
      action:
        changed.length > 0
          ? `Settings updated — ${changed.map((k) => SETTING_LABEL[k]).join(', ')}`
          : 'Settings updated — platform preferences',
      module: SETTINGS_LOG_MODULE,
      sev: 'Info',
    });
  },

  rotateApiKey: () => {
    const before = get().apiKey;
    const after = mintApiKey();
    set({ apiKey: after });
    useComplianceStore.getState().recordChange({
      actor: OPS_ACTING_USER_EMAIL,
      area: SETTINGS_AREA,
      setting: 'Platform API key',
      before,
      after,
      scope: 'Platform',
    });
    useLogsStore.getState().addLog({
      action: 'API key rotated — platform integrations',
      module: SETTINGS_LOG_MODULE,
      sev: 'Critical',
    });
  },
}));
