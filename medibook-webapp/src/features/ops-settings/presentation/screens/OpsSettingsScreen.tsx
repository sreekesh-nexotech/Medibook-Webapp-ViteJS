import { useState } from 'react';

import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { email as vEmail } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { UnsavedBar } from '@/shared/ui/UnsavedBar';

import {
  PAYOUT_SCHEDULE_OPTIONS,
  SESSION_TIMEOUT_OPTIONS,
} from '@/features/ops-settings/application/store/opsSettings.fixtures';
import { useOpsSettingsStore } from '@/features/ops-settings/application/store/opsSettings.store';
import type {
  OpsSettings,
  PayoutSchedule,
  SessionTimeout,
} from '@/features/ops-settings/application/store/opsSettings.types';

/** Boolean-valued notification keys of the settings record. */
type NotifKey = 'notifSettle' | 'notifCompliance' | 'notifDigest';

/** Per-field inline validation messages. */
type FieldErrors = Partial<Record<keyof OpsSettings, string | null>>;

const NOTIF_TOGGLES: readonly { key: NotifKey; title: string; desc: string }[] = [
  {
    key: 'notifSettle',
    title: 'Settlement alerts',
    desc: 'Notify when a payout fails or is on hold.',
  },
  {
    key: 'notifCompliance',
    title: 'Compliance alerts',
    desc: 'Notify on critical audit events in real time.',
  },
  { key: 'notifDigest', title: 'Weekly digest', desc: 'Platform summary every Monday at 09:00.' },
];

/** GSTINs are exactly 15 characters. */
const GSTIN_LENGTH = 15;

const COMMISSION_MIN = 0;
const COMMISSION_MAX = 100;

const vCommission = (v: string): string | null => {
  const n = Number(v);
  return v !== '' && !Number.isNaN(n) && n >= COMMISSION_MIN && n <= COMMISSION_MAX
    ? null
    : `Enter a value between ${COMMISSION_MIN} and ${COMMISSION_MAX}.`;
};

const vGst = (v: string): string | null =>
  String(v || '').replace(/\s/g, '').length === GSTIN_LENGTH
    ? null
    : `GST number must be ${GSTIN_LENGTH} characters.`;

/** Platform settings — Organisation, Payouts & Billing, Notifications, Security (Ops.jsx OpsSettings). */
export function OpsSettingsScreen() {
  const settings = useOpsSettingsStore((s) => s.settings);
  const apiKey = useOpsSettingsStore((s) => s.apiKey);
  const save = useOpsSettingsStore((s) => s.save);
  const rotateApiKey = useOpsSettingsStore((s) => s.rotateApiKey);
  const [f, setF] = useState<OpsSettings>({ ...settings });
  const [err, setErr] = useState<FieldErrors>({});
  const [busy, run] = useOpsAct();
  const [confirmRotate, setConfirmRotate] = useState(false);

  const keys = Object.keys(settings) as (keyof OpsSettings)[];
  const dirty = keys.some((k) => f[k] !== settings[k]);
  const saving = Boolean(busy.save);

  // Audit 3.7.1 — the bar that says "Unsaved changes" now also stops the
  // edits being thrown away by a navigation.
  const { blocked, discard, keepEditing } = useUnsavedChanges({ dirty: dirty && !saving });

  const upd = <K extends keyof OpsSettings>(k: K, v: OpsSettings[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErr((p) => ({ ...p, [k]: null }));
  };

  const onSave = () => {
    const e: FieldErrors = {
      orgEmail: vEmail(f.orgEmail) ?? null,
      commission: vCommission(f.commission),
      gst: vGst(f.gst),
    };
    setErr(e);
    if (e.orgEmail || e.commission || e.gst) return;
    run('save', 'Settings saved.', () => save(f));
  };

  const onDiscard = () => {
    setF({ ...settings });
    setErr({});
  };

  const idleMinutes = Number.parseInt(f.sessTimeout, 10);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionTitle className="mb-4">Organisation</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <OpsField label="Platform Name">
            <TextInput
              value={f.orgName}
              name="orgName"
              onChange={(v) => upd('orgName', v)}
              height={48}
            />
          </OpsField>
          <OpsField label="Support Email" error={err.orgEmail}>
            <TextInput
              value={f.orgEmail}
              name="orgEmail"
              type="email"
              inputMode="email"
              onChange={(v) => upd('orgEmail', v)}
              height={48}
            />
          </OpsField>
          <OpsField label="Helpline Number">
            <TextInput
              value={f.orgPhone}
              name="orgPhone"
              inputMode="tel"
              onChange={(v) => upd('orgPhone', v)}
              height={48}
            />
          </OpsField>
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-4">Payouts &amp; Billing</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <OpsField
            label="Payout Schedule"
            hint="Sets how often payout runs are grouped on Hospital Settlements."
          >
            <Select
              value={f.payoutSched}
              options={PAYOUT_SCHEDULE_OPTIONS}
              onChange={(v) => upd('payoutSched', v as PayoutSchedule)}
              height={48}
            />
          </OpsField>
          <OpsField
            label="Platform Commission (%)"
            error={err.commission}
            hint="Applied to every settlement statement's gross."
          >
            <TextInput
              value={f.commission}
              name="commission"
              inputMode="decimal"
              onChange={(v) => upd('commission', v)}
              height={48}
            />
          </OpsField>
          <OpsField label="GST Number" error={err.gst} hint="Shown on every invoice and receipt.">
            <TextInput value={f.gst} name="gst" onChange={(v) => upd('gst', v)} height={48} />
          </OpsField>
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-4.5">Notifications</SectionTitle>
        <div className="flex flex-col gap-4.5">
          {NOTIF_TOGGLES.map(({ key, title, desc }) => (
            <div key={key} className="flex items-start gap-3">
              <Toggle value={f[key]} onChange={(v) => upd(key, v)} label={title} />
              <div className="flex flex-col gap-0.5">
                <span className="text-body text-text-strong font-medium">{title}</span>
                <span className="text-caption text-text-muted">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-4.5">Security</SectionTitle>
        <div className="flex flex-col gap-4.5">
          <div className="flex items-start gap-3">
            <Toggle
              value={f.twoFAReq}
              onChange={(v) => upd('twoFAReq', v)}
              label="Require 2FA for all admins"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-body text-text-strong font-medium">
                Require 2FA for all admins
              </span>
              <span className="text-caption text-text-muted">
                Admins without 2FA are prompted at next sign-in.
              </span>
            </div>
          </div>
          <div className="w-72">
            <OpsField
              label="Session Timeout"
              hint={`You will be signed out after ${idleMinutes} minutes of inactivity, with a warning a minute before.`}
            >
              <Select
                value={f.sessTimeout}
                options={SESSION_TIMEOUT_OPTIONS}
                onChange={(v) => upd('sessTimeout', v as SessionTimeout)}
                height={48}
              />
            </OpsField>
          </div>
          <div className="border-border-soft flex flex-wrap items-center gap-3 border-t pt-4">
            <span className="text-body text-text-strong font-medium">API Key</span>
            <span className="text-body text-text-muted tabular-nums">{apiKey}</span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="secondary"
              icon="refresh-cw"
              onClick={() => setConfirmRotate(true)}
            >
              Rotate Key
            </Button>
          </div>
        </div>
      </Card>

      <UnsavedBar dirty={dirty} busy={saving} onSave={onSave} onDiscard={onDiscard} />

      <ConfirmModal
        open={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        title="Rotate the API key?"
        body="The current key stops working immediately and every integration using it — payment gateway, SMS and the patient app's backend — fails until the new key is deployed. The old key cannot be restored."
        confirmLabel="Rotate Key"
        danger
        onConfirm={() => {
          setConfirmRotate(false);
          run('rotate', 'API key rotated. Update your gateway config.', rotateApiKey);
        }}
      />

      <ConfirmModal
        open={blocked}
        onClose={keepEditing}
        title="Discard unsaved settings?"
        body="These platform settings have edits that are not saved yet. Leaving now loses them."
        confirmLabel="Discard changes"
        danger
        onConfirm={discard}
      />
    </div>
  );
}
