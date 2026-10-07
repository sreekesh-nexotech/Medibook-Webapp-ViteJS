import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { Card } from '@/shared/ui/Card';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Toggle } from '@/shared/ui/Toggle';
import { UnsavedBar } from '@/shared/ui/UnsavedBar';
import { toast } from '@/shared/ui/toast/toast.store';

import { useSaveOpsSettingsMutation } from '@/features/ops-settings/application/queries/useSaveOpsSettingsMutation';
import type {
  PlatformSettings,
  PlatformSettingsValues,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';
import { SESSION_TIMEOUT_OPTIONS } from '@/features/ops-settings/presentation/components/opsSettingsFormat';
import {
  hasErrors,
  SERVER_FIELD,
  toSettingsForm,
  toSettingsValues,
  validateSettingsForm,
  type SettingsForm,
  type SettingsFormErrors,
  type SettingsFormKey,
} from '@/features/ops-settings/presentation/components/opsSettingsForm';
import { SettingsBillingCard } from '@/features/ops-settings/presentation/components/SettingsBillingCard';
import { SettingsOrganisationCard } from '@/features/ops-settings/presentation/components/SettingsOrganisationCard';
import { SettingsPatientAppCard } from '@/features/ops-settings/presentation/components/SettingsPatientAppCard';
import { SettingsSecurityCard } from '@/features/ops-settings/presentation/components/SettingsSecurityCard';

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

interface OpsSettingsFormProps {
  /** The record as last read; the form is re-seeded when its version changes. */
  settings: PlatformSettings;
}

/**
 * Platform settings (UAT-34, 13·Settings F1/F6) — every editable field of
 * `platform_settings`, saved through `PUT /platform/settings` with
 * `If-Match`. Settings a newer backend adds (payout four-eyes, booking caps)
 * show only when the server sends them. Controls with no backend field are
 * shown disabled rather than saved locally.
 */
export function OpsSettingsForm({ settings }: OpsSettingsFormProps) {
  const initial = toSettingsForm(settings);
  const [f, setF] = useState<SettingsForm>(initial);
  const [err, setErr] = useState<SettingsFormErrors>({});
  const save = useSaveOpsSettingsMutation();

  const keys = Object.keys(initial) as SettingsFormKey[];
  const dirty = keys.some((k) => f[k] !== initial[k]);
  const saving = save.isPending;

  // Audit 3.7.1 — the bar that says "Unsaved changes" also stops the edits
  // being thrown away by a navigation.
  const { blocked, discard, keepEditing } = useUnsavedChanges({ dirty: dirty && !saving });

  const timeoutOptions = SESSION_TIMEOUT_OPTIONS.includes(initial.sessTimeout)
    ? SESSION_TIMEOUT_OPTIONS
    : [initial.sessTimeout, ...SESSION_TIMEOUT_OPTIONS];

  const onChange = <K extends SettingsFormKey>(k: K, v: SettingsForm[K]): void => {
    setF((p) => ({ ...p, [k]: v }));
    setErr((p) => ({ ...p, [k]: null }));
  };

  // SEC-05: roles that can read but not change platform settings get a read-only form.
  const canEdit = useOpsPermission().can('settings.edit');

  const onSave = (): void => {
    const e = validateSettingsForm(f, settings);
    setErr(e);
    if (hasErrors(e)) {
      toast('Some settings need fixing. Check the highlighted fields.', 'error');
      return;
    }
    save.mutate(
      { values: toSettingsValues(settings, f, initial), version: settings.version },
      {
        onSuccess: () => toast('Settings saved.', 'success'),
        onError: (failure) => {
          if (!isFailure(failure)) {
            toast('Could not save the settings.', 'error');
            return;
          }
          const fromServer: SettingsFormErrors = {};
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

  const onDiscard = (): void => {
    setF(initial);
    setErr({});
  };

  const section = { f, err, onChange };

  return (
    <fieldset disabled={!canEdit} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
      {!canEdit && (
        <p className="text-caption text-text-muted bg-blue-soft-bg m-0 rounded-sm px-3 py-2.5">
          Your role can view these settings but not change them.
        </p>
      )}
      <SettingsOrganisationCard {...section} />
      <SettingsBillingCard {...section} hasFourEyes={settings.payoutFourEyes !== null} />
      <SettingsPatientAppCard
        {...section}
        hasBookingCaps={
          settings.maxPendingBookingsPerUser !== null &&
          settings.maxBookingsPerPersonDoctorDay !== null
        }
      />
      <SettingsSecurityCard {...section} timeoutOptions={timeoutOptions} />

      <Card>
        <SectionTitle className="mb-4.5">Ops Notifications</SectionTitle>
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
