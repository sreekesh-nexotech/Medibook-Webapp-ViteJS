import { Card } from '@/shared/ui/Card';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TextInput } from '@/shared/ui/TextInput';

import type { SettingsSectionProps } from '@/features/ops-settings/presentation/components/opsSettingsForm';

const UNAVAILABLE = 'Not available yet';
const UNAVAILABLE_HINT = 'Not available yet — the platform API does not store this setting.';
const INPUT_HEIGHT = 48;

/** Organisation: legal name, contact, GSTIN and the address printed on platform statements. */
export function SettingsOrganisationCard({ f, err, onChange }: SettingsSectionProps) {
  return (
    <Card>
      <SectionTitle className="mb-4">Organisation</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <OpsField
          label="Platform Name"
          required
          error={err.legalName}
          hint="The legal name printed on platform statements and invoices."
        >
          <TextInput
            value={f.legalName}
            name="legalName"
            onChange={(v) => onChange('legalName', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="Helpline Number"
          error={err.phone}
          hint="Also shown in the patient app. International format, e.g. +918022044000."
        >
          <TextInput
            value={f.phone}
            name="orgPhone"
            inputMode="tel"
            autoComplete="tel"
            onChange={(v) => onChange('phone', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField label="Support Email" hint={UNAVAILABLE_HINT}>
          <TextInput
            value=""
            name="orgEmail"
            type="email"
            placeholder={UNAVAILABLE}
            disabled
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField label="GST Number" required error={err.gstin} hint="Printed on every statement.">
          <TextInput
            value={f.gstin}
            name="gst"
            onChange={(v) => onChange('gstin', v)}
            maxLength={15}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField label="Address line 1" required error={err.addressLine1}>
          <TextInput
            value={f.addressLine1}
            name="addressLine1"
            onChange={(v) => onChange('addressLine1', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField label="Address line 2" error={err.addressLine2}>
          <TextInput
            value={f.addressLine2}
            name="addressLine2"
            onChange={(v) => onChange('addressLine2', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField label="Address line 3" error={err.addressLine3}>
          <TextInput
            value={f.addressLine3}
            name="addressLine3"
            onChange={(v) => onChange('addressLine3', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField label="City" required error={err.city}>
          <TextInput
            value={f.city}
            name="city"
            onChange={(v) => onChange('city', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField label="State" required error={err.state}>
          <TextInput
            value={f.state}
            name="state"
            onChange={(v) => onChange('state', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField label="PIN code" required error={err.pincode}>
          <TextInput
            value={f.pincode}
            name="pincode"
            inputMode="numeric"
            maxLength={6}
            onChange={(v) => onChange('pincode', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
      </div>
    </Card>
  );
}
