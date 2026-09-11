import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import type { OpsHospital } from '@/features/ops-hospitals/application/store/hospitals.types';
import { useHospitalsStore } from '@/features/ops-hospitals/application/store/hospitals.store';
import {
  addDaysIso,
  daysBetweenIso,
  isoFromLongDate,
  longDateFromIso,
  opsTodayIso,
} from '@/features/ops-hospitals/application/store/opsDates';

import {
  PLATFORM_GRACE_DAYS,
  graceDaysFor,
} from '@/features/ops-billing/application/store/billing.derive';
import { useBillingStore } from '@/features/ops-billing/application/store/billing.store';
import type { Invoice } from '@/features/ops-billing/application/store/billing.types';

interface GraceForm {
  /** Off = fall back to the hospital / platform window. */
  override: boolean;
  days: string;
  /** Apply the same window to every future invoice for this hospital. */
  applyToHospital: boolean;
}

const VALIDATORS: FormValidators<GraceForm> = {
  days: (value, values) => {
    if (!values.override) return undefined;
    const text = value.trim();
    if (text === '') return 'Enter a number of days, or use the default.';
    if (!/^\d+$/.test(text)) return 'Grace days must be a whole number of 0 or more.';
    return Number(text) > 90
      ? 'A grace window longer than 90 days needs finance sign-off.'
      : undefined;
  },
};

interface GracePeriodModalProps {
  open: boolean;
  invoice: Invoice;
  hospital: OpsHospital | null;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * Configure the payment grace window (audit SA-03: "no grace period"). The
 * window can be set on this invoice alone or on the hospital, so both levels
 * the audit asks for are reachable from one place; `0` is a real setting — no
 * grace at all — and is kept distinct from "not configured".
 */
export function GracePeriodModal({
  open,
  invoice,
  hospital,
  onClose,
  onDone,
}: GracePeriodModalProps) {
  const setInvoiceGrace = useBillingStore((s) => s.setInvoiceGrace);
  const setHospitalGrace = useHospitalsStore((s) => s.setGraceDays);
  const [busy, run] = useOpsAct();
  const effective = graceDaysFor(invoice, hospital);

  const form = useForm<GraceForm>({
    initial: {
      override: invoice.graceDays !== undefined,
      days: String(effective),
      applyToHospital: false,
    },
    validate: VALIDATORS,
    onSubmit: (values) => {
      const days = values.override ? Number(values.days.trim()) : undefined;
      run('grace', `Grace window updated for ${invoice.no}.`, () => {
        setInvoiceGrace(invoice.id, days);
        if (values.applyToHospital && hospital) setHospitalGrace(hospital.id, days);
        onDone?.();
      });
    },
  });

  const { values } = form;
  const dueIso = isoFromLongDate(invoice.due);
  const previewDays = values.override ? Number(values.days.trim() || '0') : PLATFORM_GRACE_DAYS;
  const endsIso = dueIso && Number.isFinite(previewDays) ? addDaysIso(dueIso, previewDays) : null;
  const left = endsIso ? daysBetweenIso(opsTodayIso(), endsIso) : null;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={`Grace window for ${invoice.no}`}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel="Save Grace Window"
      busy={busy.grace}
    >
      <div className="flex flex-col gap-4.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-body text-text-body">
            Override the default of {PLATFORM_GRACE_DAYS} days
          </span>
          <Toggle
            value={values.override}
            onChange={(v) => form.setField('override', v)}
            label="Override the default grace window"
          />
        </div>
        <OpsField
          label="Grace Days After Due Date"
          required={values.override}
          error={form.errorFor('days')}
          hint={
            values.override
              ? '0 means the invoice is actionable the day after it falls due.'
              : `Using the ${hospital?.graceDays !== undefined ? "hospital's" : 'platform'} setting of ${effective} days.`
          }
        >
          <TextInput
            value={values.override ? values.days : String(effective)}
            onChange={(v) => form.setField('days', v)}
            onBlur={() => form.blurField('days')}
            inputMode="numeric"
            disabled={!values.override}
            height={48}
          />
        </OpsField>
        {hospital && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-body text-text-body">
              Also apply to every future invoice for {hospital.name}
            </span>
            <Toggle
              value={values.applyToHospital}
              onChange={(v) => form.setField('applyToHospital', v)}
              label={`Apply this grace window to all invoices for ${hospital.name}`}
            />
          </div>
        )}
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" />
          {endsIso ? (
            <span>
              Due {invoice.due} · grace ends {longDateFromIso(endsIso)}
              {left !== null &&
                (left >= 0 ? ` (in ${left} day${left === 1 ? '' : 's'})` : ` (${-left} days ago)`)}
              . Suspension for non-payment is only offered after that.
            </span>
          ) : (
            <span>This invoice has no readable due date, so no window can be counted.</span>
          )}
        </div>
      </div>
    </FormModal>
  );
}
