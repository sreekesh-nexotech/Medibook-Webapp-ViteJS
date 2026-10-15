import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import {
  SHORT_OTP_LENGTH,
  SHORT_OTP_MAX_ATTEMPTS,
  SHORT_OTP_MAX_TTL_SECONDS,
  type SettingsSectionProps,
} from '@/features/ops-settings/presentation/components/opsSettingsForm';

const UNAVAILABLE_HINT = 'Not available yet — the platform API does not store this setting.';
const INPUT_HEIGHT = 48;

interface SettingsSecurityCardProps extends SettingsSectionProps {
  readonly timeoutOptions: readonly string[];
}

/**
 * Sign-in and data: staff idle timeout, OTP and lockout limits (D-23 — a
 * 4-digit code keeps validity ≤ 180 s and ≤ 3 attempts), the upload cap and
 * the account-deletion cooling-off (D-24).
 */
export function SettingsSecurityCard({
  f,
  err,
  onChange,
  timeoutOptions,
}: SettingsSecurityCardProps) {
  const idleMinutes = Number.parseInt(f.sessTimeout, 10);
  const shortCode = Number(f.otpLength) <= SHORT_OTP_LENGTH;
  return (
    <Card>
      <SectionTitle className="mb-4.5">Sign-in, Security &amp; Data</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <OpsField
          label="Session Timeout"
          error={err.sessTimeout}
          hint={`Staff are signed out after ${idleMinutes} minutes of inactivity, with a warning a minute before.`}
        >
          <Select
            value={f.sessTimeout}
            options={timeoutOptions}
            onChange={(v) => onChange('sessTimeout', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="Failed sign-ins before lockout"
          required
          error={err.loginMaxAttempts}
          hint="Per account (1–20)."
        >
          <TextInput
            value={f.loginMaxAttempts}
            name="loginMaxAttempts"
            inputMode="numeric"
            onChange={(v) => onChange('loginMaxAttempts', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="Lockout (minutes)"
          required
          error={err.lockoutMinutes}
          hint="How long a locked account waits. At least 1 minute."
        >
          <TextInput
            value={f.lockoutMinutes}
            name="lockoutMinutes"
            inputMode="decimal"
            onChange={(v) => onChange('lockoutMinutes', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="OTP length (digits)"
          required
          error={err.otpLength}
          hint="4–8. The patient app reads it from app-config."
        >
          <TextInput
            value={f.otpLength}
            name="otpLength"
            inputMode="numeric"
            onChange={(v) => onChange('otpLength', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="OTP validity (seconds)"
          required
          error={err.otpTtlSeconds}
          hint={
            shortCode
              ? `At most ${SHORT_OTP_MAX_TTL_SECONDS} s while the code is ${SHORT_OTP_LENGTH} digits (D-23).`
              : '30–900 seconds.'
          }
        >
          <TextInput
            value={f.otpTtlSeconds}
            name="otpTtlSeconds"
            inputMode="numeric"
            onChange={(v) => onChange('otpTtlSeconds', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="OTP attempts per code"
          required
          error={err.otpMaxAttempts}
          hint={
            shortCode
              ? `At most ${SHORT_OTP_MAX_ATTEMPTS} while the code is ${SHORT_OTP_LENGTH} digits (D-23).`
              : '1–10.'
          }
        >
          <TextInput
            value={f.otpMaxAttempts}
            name="otpMaxAttempts"
            inputMode="numeric"
            onChange={(v) => onChange('otpMaxAttempts', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="Upload size limit (MB)"
          required
          error={err.uploadMaxMb}
          hint="Largest file a patient or staff member can upload."
        >
          <TextInput
            value={f.uploadMaxMb}
            name="uploadMaxMb"
            inputMode="decimal"
            onChange={(v) => onChange('uploadMaxMb', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="Account-deletion cooling-off (days)"
          required
          error={err.dsrCoolingOffDays}
          hint="Days a patient's deletion request waits; signing in cancels it (0–365)."
        >
          <TextInput
            value={f.dsrCoolingOffDays}
            name="dsrCoolingOffDays"
            inputMode="numeric"
            onChange={(v) => onChange('dsrCoolingOffDays', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
      </div>
      <div className="border-border-soft mt-4 flex flex-col gap-4.5 border-t pt-4">
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-body text-text-strong font-medium">API Key</span>
          <span className="text-body text-text-muted">{UNAVAILABLE_HINT}</span>
          <div className="flex-1" />
          <Button size="sm" variant="secondary" icon="refresh-cw" disabled>
            Rotate Key
          </Button>
        </div>
      </div>
    </Card>
  );
}
