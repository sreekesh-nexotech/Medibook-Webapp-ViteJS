import { fmtDate } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Select } from '@/shared/ui/Select';
import { Toggle } from '@/shared/ui/Toggle';

import type {
  HospitalProfile,
  HospitalRuleSettings,
} from '@/features/settings/domain/entities/settings.entities';
import {
  HOLD_TIMEOUT_OPTIONS,
  type RulesForm,
} from '@/features/settings/application/store/settings.form';
import { durationCopy } from '@/features/settings/application/store/settings.rules';

import { RuleCard } from './RuleCard';
import { RuleNumberField } from './RuleNumberField';
import { RuleRow } from './RuleRow';
import { digitsText, percentText } from './ruleInputs';
import type { SectionDraft } from './settingsEditor.types';

interface SettingsBookingSectionProps {
  draft: SectionDraft<RulesForm>;
  rules: HospitalRuleSettings;
  profile: HospitalProfile;
  mayEdit: boolean;
}

/**
 * Settings › Booking & Cancellation — the booking window, online approval,
 * the payment hold, the cancellation cut-off and both refund tiers (Q10),
 * follow-up pricing and patient-record rules. Every hint states what the
 * saved value does; the cancellation example is the server's own (07·F7).
 */
export function SettingsBookingSection({
  draft,
  rules,
  profile,
  mayEdit,
}: SettingsBookingSectionProps) {
  const { value, set, errors } = draft;
  const holdMinutes = Number(value.holdTimeoutMinutes) || 0;
  const followUpDays = Number(value.followUpWindowDays) || 0;
  const windowEnd = rules.derived.bookingWindowEndDate;
  const windowChanged = value.bookingWindowDays !== String(rules.bookingWindowDays);

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-caption text-grey-900">
          Hospital-wide rules. Each rule shows what it does with its saved value; changes apply once
          you press Save Settings.
        </span>
        <InfoDot text="A doctor's own fee, slot length and consultation time (Doctors & Departments) take precedence over hospital defaults." />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RuleCard title="Booking" hint="Online and desk bookings">
          <RuleRow
            label="Booking window"
            hint={
              windowChanged
                ? `Bookings will open ${value.bookingWindowDays || '…'} days ahead once saved; slots are generated for the new window.`
                : windowEnd
                  ? `Patients can book up to ${fmtDate(windowEnd)}. Slots are generated that far ahead.`
                  : 'How far ahead patients can book.'
            }
          >
            <RuleNumberField
              id="rule-booking-window"
              value={value.bookingWindowDays}
              unit="days"
              label="Booking window in days"
              error={errors.bookingWindowDays}
              disabled={!mayEdit}
              onChange={(v) => set('bookingWindowDays', digitsText(v))}
            />
          </RuleRow>
          <RuleRow
            label="Online booking"
            hint={
              profile.onlineBookingEnabled
                ? 'On — patients can book from the Medibook app. Managed by Medibook.'
                : 'Off — app booking is switched off; desk bookings only. Managed by Medibook.'
            }
          >
            <Toggle
              value={profile.onlineBookingEnabled}
              onChange={() => undefined}
              label="Online booking (managed by Medibook)"
              disabled
            />
          </RuleRow>
          <RuleRow
            label="Approve online bookings"
            hint={
              value.onlineRequiresApproval
                ? 'Paid online bookings wait for the desk to approve or reject them (rejected ones are refunded).'
                : 'Paid online bookings are confirmed at once.'
            }
          >
            <Toggle
              value={value.onlineRequiresApproval}
              onChange={(v) => set('onlineRequiresApproval', v)}
              label="Online bookings need hospital approval"
              disabled={!mayEdit}
            />
          </RuleRow>
          <RuleRow
            label="Payment hold"
            hint={`An online booking that is not paid within ${durationCopy(holdMinutes)} is released and the slot reopens.`}
            last
          >
            <div className="w-32">
              <Select
                value={value.holdTimeoutMinutes}
                options={
                  HOLD_TIMEOUT_OPTIONS.includes(value.holdTimeoutMinutes)
                    ? HOLD_TIMEOUT_OPTIONS
                    : [...HOLD_TIMEOUT_OPTIONS, value.holdTimeoutMinutes]
                }
                onChange={(v) => set('holdTimeoutMinutes', v)}
                height={40}
                aria-label="Payment hold in minutes"
                disabled={!mayEdit}
              />
            </div>
          </RuleRow>
        </RuleCard>

        <RuleCard title="Cancellation & Refunds" hint="When a patient cancels (Q10, Q84)">
          <RuleRow
            label="Cancellation cut-off"
            hint="Hours before the appointment that separate the two refund tiers below."
          >
            <RuleNumberField
              id="rule-cutoff"
              value={value.cancellationCutoffHours}
              unit="hours"
              label="Cancellation cut-off in hours"
              error={errors.cancellationCutoffHours}
              disabled={!mayEdit}
              onChange={(v) => set('cancellationCutoffHours', digitsText(v))}
            />
          </RuleRow>
          <RuleRow label="Refund before the cut-off" hint="Of the amount paid, per payment line.">
            <RuleNumberField
              id="rule-refund-before"
              value={value.refundBeforePct}
              unit="%"
              label="Refund before the cut-off in percent"
              error={errors.refundBeforePct}
              disabled={!mayEdit}
              onChange={(v) => set('refundBeforePct', percentText(v))}
            />
          </RuleRow>
          <RuleRow label="Refund after the cut-off" hint="0% means no refund after the cut-off.">
            <RuleNumberField
              id="rule-refund-after"
              value={value.refundAfterPct}
              unit="%"
              label="Refund after the cut-off in percent"
              error={errors.refundAfterPct}
              disabled={!mayEdit}
              onChange={(v) => set('refundAfterPct', percentText(v))}
            />
          </RuleRow>
          <RuleRow
            label="Refund the convenience fee too"
            hint="A cancellation by the hospital always refunds 100% including the fee (Q11)."
          >
            <Toggle
              value={value.refundIncludesConvenienceFee}
              onChange={(v) => set('refundIncludesConvenienceFee', v)}
              label="Refunds include the convenience fee"
              disabled={!mayEdit}
            />
          </RuleRow>
          <div className="text-caption text-text-body bg-bg-tint mt-3 rounded-md px-3 py-2.5">
            {rules.derived.cancellationExample ??
              'Save to see what a cancellation refunds under these rules.'}
            <span className="text-text-muted"> (saved rules)</span>
          </div>
        </RuleCard>

        <RuleCard title="Follow-ups" hint="Repeat visits to the same doctor">
          <RuleRow
            label="Follow-up window"
            hint={
              followUpDays > 0
                ? `A visit to the same doctor within ${followUpDays} ${followUpDays === 1 ? 'day' : 'days'} is charged that doctor's follow-up fee (the consultation fee when none is set).`
                : 'Every visit is charged the full consultation fee.'
            }
            last
          >
            <RuleNumberField
              id="rule-follow-up"
              value={value.followUpWindowDays}
              unit="days"
              label="Follow-up window in days"
              error={errors.followUpWindowDays}
              disabled={!mayEdit}
              onChange={(v) => set('followUpWindowDays', digitsText(v))}
            />
          </RuleRow>
        </RuleCard>

        <RuleCard title="Patient Records" hint="Front-desk edits and notes">
          <RuleRow
            label="Approve patient edits"
            hint={
              value.patientEditRequiresApproval
                ? 'Desk edits and deletions of a patient record wait for an admin to approve them (Patients › Approvals).'
                : 'Desk edits of a patient record apply at once.'
            }
          >
            <Toggle
              value={value.patientEditRequiresApproval}
              onChange={(v) => set('patientEditRequiresApproval', v)}
              label="Patient edits need admin approval"
              disabled={!mayEdit}
            />
          </RuleRow>
          <RuleRow
            label="Patient notes"
            hint="Lets patients add a note for the doctor when they book (Q91)."
            last
          >
            <Toggle
              value={value.patientNotesEnabled}
              onChange={(v) => set('patientNotesEnabled', v)}
              label="Allow patient notes on bookings"
              disabled={!mayEdit}
            />
          </RuleRow>
        </RuleCard>
      </div>
      <Card pad={14} className="text-caption text-text-muted flex items-start gap-2">
        <Icon name="info" size={15} className="text-blue mt-0.5 flex-none" />
        Each slot holds one patient and slots run back to back (no buffer) — fixed by the server.
        Slot length is set per doctor.
      </Card>
    </>
  );
}
