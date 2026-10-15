import { Card } from '@/shared/ui/Card';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import type { SettingsSectionProps } from '@/features/ops-settings/presentation/components/opsSettingsForm';

const UNAVAILABLE = 'Not available yet';
const UNAVAILABLE_HINT = 'Not available yet — the platform API does not store this setting.';
const INPUT_HEIGHT = 48;

interface SettingsBillingCardProps extends SettingsSectionProps {
  /** The backend has the payout four-eyes setting (B4); older ones do not. */
  readonly hasFourEyes: boolean;
}

/**
 * Pricing, subscriptions and payouts: the convenience-fee GST (the only
 * source pricing reads, BE-18), trial and grace days for new subscriptions
 * (D-30), and the payout four-eyes rule (decision 3).
 */
export function SettingsBillingCard({ f, err, onChange, hasFourEyes }: SettingsBillingCardProps) {
  return (
    <Card>
      <SectionTitle className="mb-4">Pricing, Subscriptions &amp; Payouts</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <OpsField
          label="Convenience-fee GST (%)"
          required
          error={err.convenienceFeeGst}
          hint="Charged on the convenience fee of every online booking. This is the one setting pricing reads — tax rates no longer apply to the convenience fee."
        >
          <TextInput
            value={f.convenienceFeeGst}
            name="convenienceFeeGst"
            inputMode="decimal"
            onChange={(v) => onChange('convenienceFeeGst', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="Default trial (days)"
          required
          error={err.trialDays}
          hint="Trial length for a new subscription when the plan sets none (0–365)."
        >
          <TextInput
            value={f.trialDays}
            name="trialDays"
            inputMode="numeric"
            onChange={(v) => onChange('trialDays', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="Grace period (days)"
          required
          error={err.graceDays}
          hint="Days after an unpaid invoice falls due before the hospital turns read-only (0–90)."
        >
          <TextInput
            value={f.graceDays}
            name="graceDays"
            inputMode="numeric"
            onChange={(v) => onChange('graceDays', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="Platform Commission (%)"
          hint="Set per hospital: open it under Hospitals, then Billing & Settlements › Commercial Terms. There is no platform-wide default."
        >
          <TextInput
            value=""
            name="commission"
            placeholder={UNAVAILABLE}
            disabled
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField label="Payout Schedule" hint={UNAVAILABLE_HINT}>
          <Select value="" placeholder={UNAVAILABLE} disabled height={INPUT_HEIGHT} />
        </OpsField>
      </div>
      {hasFourEyes && (
        <div className="border-border-soft mt-4 flex items-start gap-3 border-t pt-4">
          <Toggle
            value={f.payoutFourEyes}
            onChange={(v) => onChange('payoutFourEyes', v)}
            label="Payout runs need a second approver"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-body text-text-strong font-medium">
              Payout runs need a second approver
            </span>
            <span className="text-caption text-text-muted">
              When on, the person who created a payout run cannot approve or release it.
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
