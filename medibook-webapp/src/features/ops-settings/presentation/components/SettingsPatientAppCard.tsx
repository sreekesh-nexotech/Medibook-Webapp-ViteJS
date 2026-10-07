import { Card } from '@/shared/ui/Card';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import type { SettingsSectionProps } from '@/features/ops-settings/presentation/components/opsSettingsForm';

const INPUT_HEIGHT = 48;

const timeInputClass =
  'text-body text-text-body rounded-input border-border h-12 w-full border bg-white px-3';

interface SettingsPatientAppCardProps extends SettingsSectionProps {
  /** The backend has the anti-hoarding booking caps (B5, H-08). */
  readonly hasBookingCaps: boolean;
}

/**
 * Patient app: booking caps, reminders and quiet hours, review moderation,
 * and the minimum app versions the app-config forces an update below.
 */
export function SettingsPatientAppCard({
  f,
  err,
  onChange,
  hasBookingCaps,
}: SettingsPatientAppCardProps) {
  return (
    <Card>
      <SectionTitle className="mb-4">Patient App</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {hasBookingCaps && (
          <>
            <OpsField
              label="Unpaid bookings per account"
              required
              error={err.maxPendingBookings}
              hint="Checkouts one account may hold open at once (1–20)."
            >
              <TextInput
                value={f.maxPendingBookings}
                name="maxPendingBookings"
                inputMode="numeric"
                onChange={(v) => onChange('maxPendingBookings', v)}
                height={INPUT_HEIGHT}
              />
            </OpsField>
            <OpsField
              label="Bookings per person, doctor and day"
              required
              error={err.maxDailyBookings}
              hint="Upcoming bookings one person may hold with one doctor on one day (1–10)."
            >
              <TextInput
                value={f.maxDailyBookings}
                name="maxDailyBookings"
                inputMode="numeric"
                onChange={(v) => onChange('maxDailyBookings', v)}
                height={INPUT_HEIGHT}
              />
            </OpsField>
            <div className="hidden md:block"></div>
          </>
        )}
        <OpsField
          label="Appointment reminders"
          required
          error={err.reminderOffsets}
          hint="Before each appointment, e.g. 1w, 48h, 24h, 2h (m, h, d or w; up to 10)."
        >
          <TextInput
            value={f.reminderOffsets}
            name="reminderOffsets"
            onChange={(v) => onChange('reminderOffsets', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="Quiet hours start"
          required
          error={err.quietStart}
          hint="Hospital-local time; non-urgent pushes wait until quiet hours end."
        >
          {(field) => (
            <input
              type="time"
              id={field.id}
              aria-invalid={field.invalid || undefined}
              aria-describedby={field.describedById}
              value={f.quietStart}
              onChange={(e) => onChange('quietStart', e.target.value)}
              className={timeInputClass}
            />
          )}
        </OpsField>
        <OpsField label="Quiet hours end" required error={err.quietEnd}>
          {(field) => (
            <input
              type="time"
              id={field.id}
              aria-invalid={field.invalid || undefined}
              aria-describedby={field.describedById}
              value={f.quietEnd}
              onChange={(e) => onChange('quietEnd', e.target.value)}
              className={timeInputClass}
            />
          )}
        </OpsField>
        <OpsField
          label="Minimum Android app version"
          error={err.androidVersion}
          hint="Older apps are asked to update. Empty = no minimum."
        >
          <TextInput
            value={f.androidVersion}
            name="androidVersion"
            placeholder="e.g. 2.4.0"
            onChange={(v) => onChange('androidVersion', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
        <OpsField
          label="Minimum iOS app version"
          error={err.iosVersion}
          hint="Older apps are asked to update. Empty = no minimum."
        >
          <TextInput
            value={f.iosVersion}
            name="iosVersion"
            placeholder="e.g. 2.4.0"
            onChange={(v) => onChange('iosVersion', v)}
            height={INPUT_HEIGHT}
          />
        </OpsField>
      </div>
      <div className="border-border-soft mt-4 flex items-start gap-3 border-t pt-4">
        <Toggle
          value={f.reviewModeration}
          onChange={(v) => onChange('reviewModeration', v)}
          label="Moderate patient reviews before they are published"
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-body text-text-strong font-medium">
            Moderate patient reviews before they are published
          </span>
          <span className="text-caption text-text-muted">
            When on, a review waits in Reviews until someone approves it; ratings count approved
            reviews only. When off, new reviews publish straight away.
          </span>
        </div>
      </div>
    </Card>
  );
}
