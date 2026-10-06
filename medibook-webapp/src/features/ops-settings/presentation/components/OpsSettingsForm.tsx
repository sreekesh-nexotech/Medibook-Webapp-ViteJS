import { useState } from 'react';

import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { Button } from '@/shared/ui/Button';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { UnsavedBar } from '@/shared/ui/UnsavedBar';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useSaveOpsSettingsMutation } from '@/features/ops-settings/application/queries/useSaveOpsSettingsMutation';
import type {
  PlatformSettings,
  PlatformSettingsValues,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';
import {
  SESSION_TIMEOUT_OPTIONS,
  timeoutLabel,
} from '@/features/ops-settings/presentation/components/opsSettingsFormat';

/** The fields of the settings record this form edits. */
interface SettingsForm {
  readonly legalName: string;
  readonly phone: string;
  readonly gstin: string;
  readonly sessTimeout: string;
}

type FormKey = keyof SettingsForm;

/** Per-field inline validation messages. */
type FormErrors = Partial<Record<FormKey, string | null>>;

/** Which form field shows a server-side error for each settings field. */
const SERVER_FIELD: Partial<Record<keyof PlatformSettingsValues, FormKey>> = {
  legalName: 'legalName',
  phoneE164: 'phone',
  gstin: 'gstin',
  sessionTimeoutMin: 'sessTimeout',
};

/** Shown on controls the platform API does not store yet. */
const UNAVAILABLE = 'Not available yet';
const UNAVAILABLE_HINT = 'Not available yet — the platform API does not store this setting.';

const NOTIF_TOGGLES: readonly { key: string; title: string; desc: string }[] = [
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

/** E.164: a plus, a non-zero country digit, then up to 14 more digits. */
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

const stripSpaces = (v: string): string => v.replace(/\s/g, '');

const vLegalName = (v: string): string | null =>
  v.trim() === '' ? 'Enter the platform name.' : null;

const vPhone = (v: string): string | null => {
  const s = stripSpaces(v);
  return s === '' || E164_PATTERN.test(s)
    ? null
    : 'Enter the number in international format, e.g. +918022044000.';
};

const vGst = (v: string): string | null =>
  stripSpaces(v).length === GSTIN_LENGTH ? null : `GST number must be ${GSTIN_LENGTH} characters.`;

function toForm(s: PlatformSettings): SettingsForm {
  return {
    legalName: s.legalName,
    phone: s.phoneE164 ?? '',
    gstin: s.gstin,
    sessTimeout: timeoutLabel(s.sessionTimeoutMin),
  };
}

/** The full record to `PUT`: the loaded one with this form's edits on top. */
function toValues(s: PlatformSettings, f: SettingsForm): PlatformSettingsValues {
  const phone = stripSpaces(f.phone);
  return {
    ...s,
    legalName: f.legalName.trim(),
    phoneE164: phone === '' ? null : phone,
    gstin: stripSpaces(f.gstin).toUpperCase(),
    sessionTimeoutMin: Number.parseInt(f.sessTimeout, 10),
  };
}

interface OpsSettingsFormProps {
  /** The record as last read; the form is re-seeded when its version changes. */
  settings: PlatformSettings;
}

/**
 * Platform settings — Organisation, Payouts & Billing, Notifications, Security
 * (Ops.jsx OpsSettings), saved through `PUT /platform/settings`. Controls with
 * no backend field are shown disabled rather than saved locally.
 */
export function OpsSettingsForm({ settings }: OpsSettingsFormProps) {
  const initial = toForm(settings);
  const [f, setF] = useState<SettingsForm>(initial);
  const [err, setErr] = useState<FormErrors>({});
  const save = useSaveOpsSettingsMutation();

  const keys = Object.keys(initial) as FormKey[];
  const dirty = keys.some((k) => f[k] !== initial[k]);
  const saving = save.isPending;

  // Audit 3.7.1 — the bar that says "Unsaved changes" now also stops the
  // edits being thrown away by a navigation.
  const { blocked, discard, keepEditing } = useUnsavedChanges({ dirty: dirty && !saving });

  const timeoutOptions = SESSION_TIMEOUT_OPTIONS.includes(initial.sessTimeout)
    ? SESSION_TIMEOUT_OPTIONS
    : [initial.sessTimeout, ...SESSION_TIMEOUT_OPTIONS];

  const upd = (k: FormKey, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErr((p) => ({ ...p, [k]: null }));
  };

  // SEC-05: roles that can read but not change platform settings get a read-only form.
  const canEdit = useOpsPermission().can('settings.edit');

  const onSave = () => {
    const e: FormErrors = {
      legalName: vLegalName(f.legalName),
      phone: vPhone(f.phone),
      gstin: vGst(f.gstin),
    };
    setErr(e);
    if (e.legalName || e.phone || e.gstin) return;
    save.mutate(
      { values: toValues(settings, f), version: settings.version },
      {
        onSuccess: () => toast('Settings saved.', 'success'),
        onError: (failure) => {
          if (!isFailure(failure)) {
            toast('Could not save the settings.', 'error');
            return;
          }
          const fromServer: FormErrors = {};
          for (const [field, messages] of Object.entries(failure.fieldErrors)) {
            const formKey = SERVER_FIELD[field as keyof PlatformSettingsValues];
            if (formKey) fromServer[formKey] = messages[0] ?? null;
          }
          setErr((p) => ({ ...p, ...fromServer }));
          toast(failure.message, 'error');
        },
      },
    );
  };

  const onDiscard = () => {
    setF(initial);
    setErr({});
  };

  const idleMinutes = Number.parseInt(f.sessTimeout, 10);

  return (
    <fieldset disabled={!canEdit} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
      {!canEdit && (
        <p className="text-caption text-text-muted bg-blue-soft-bg m-0 rounded-sm px-3 py-2.5">
          Your role can view these settings but not change them.
        </p>
      )}
      <Card>
        <SectionTitle className="mb-4">Organisation</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <OpsField
            label="Platform Name"
            error={err.legalName}
            hint="The legal name printed on platform invoices."
          >
            <TextInput
              value={f.legalName}
              name="legalName"
              onChange={(v) => upd('legalName', v)}
              height={48}
            />
          </OpsField>
          <OpsField label="Support Email" hint={UNAVAILABLE_HINT}>
            <TextInput
              value=""
              name="orgEmail"
              type="email"
              placeholder={UNAVAILABLE}
              disabled
              height={48}
            />
          </OpsField>
          <OpsField
            label="Helpline Number"
            error={err.phone}
            hint="International format, e.g. +918022044000."
          >
            <TextInput
              value={f.phone}
              name="orgPhone"
              inputMode="tel"
              autoComplete="tel"
              onChange={(v) => upd('phone', v)}
              height={48}
            />
          </OpsField>
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-4">Payouts &amp; Billing</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <OpsField label="Payout Schedule" hint={UNAVAILABLE_HINT}>
            <Select value="" placeholder={UNAVAILABLE} disabled height={48} />
          </OpsField>
          <OpsField
            label="Platform Commission (%)"
            hint="Set per hospital: open it under Hospitals, then Billing & Settlements › Commercial Terms. There is no platform-wide default."
          >
            <TextInput value="" name="commission" placeholder={UNAVAILABLE} disabled height={48} />
          </OpsField>
          <OpsField label="GST Number" error={err.gstin} hint="Shown on every invoice and receipt.">
            <TextInput value={f.gstin} name="gst" onChange={(v) => upd('gstin', v)} height={48} />
          </OpsField>
        </div>
      </Card>

      <Card>
        <SectionTitle className="mb-4.5">Notifications</SectionTitle>
        <div className="flex flex-col gap-4.5">
          {NOTIF_TOGGLES.map(({ key, title, desc }) => (
            <div key={key} className="flex items-start gap-3">
              <Toggle value={false} onChange={() => undefined} label={title} disabled />
              <div className="flex flex-col gap-0.5">
                <span className="text-body text-text-strong font-medium">{title}</span>
                <span className="text-caption text-text-muted">{desc}</span>
                <span className="text-caption text-text-faint">{UNAVAILABLE_HINT}</span>
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
              value={false}
              onChange={() => undefined}
              label="Require 2FA for all admins"
              disabled
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-body text-text-strong font-medium">
                Require 2FA for all admins
              </span>
              <span className="text-caption text-text-muted">
                Admins without 2FA are prompted at next sign-in.
              </span>
              <span className="text-caption text-text-faint">{UNAVAILABLE_HINT}</span>
            </div>
          </div>
          <div className="w-72">
            <OpsField
              label="Session Timeout"
              error={err.sessTimeout}
              hint={`You will be signed out after ${idleMinutes} minutes of inactivity, with a warning a minute before.`}
            >
              <Select
                value={f.sessTimeout}
                options={timeoutOptions}
                onChange={(v) => upd('sessTimeout', v)}
                height={48}
              />
            </OpsField>
          </div>
          <div className="border-border-soft flex flex-wrap items-center gap-3 border-t pt-4">
            <span className="text-body text-text-strong font-medium">API Key</span>
            <span className="text-body text-text-muted">{UNAVAILABLE_HINT}</span>
            <div className="flex-1" />
            <Button size="sm" variant="secondary" icon="refresh-cw" disabled>
              Rotate Key
            </Button>
          </div>
        </div>
      </Card>

      {canEdit && <UnsavedBar dirty={dirty} busy={saving} onSave={onSave} onDiscard={onDiscard} />}

      <ConfirmModal
        open={blocked}
        onClose={keepEditing}
        title="Discard unsaved settings?"
        body="These platform settings have edits that are not saved yet. Leaving now loses them."
        confirmLabel="Discard changes"
        danger
        onConfirm={discard}
      />
    </fieldset>
  );
}
