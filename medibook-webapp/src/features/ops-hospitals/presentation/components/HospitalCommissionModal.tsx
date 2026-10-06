import { isFailure } from '@/core/error/failure';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { fmtDate, parseHundredths, todayISO } from '@/shared/lib/format';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { PlatformHospitalDetail } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { useSetHospitalCommissionMutation } from '@/features/ops-hospitals/application/queries/useSetHospitalCommissionMutation';
import {
  bpCopy,
  hundredthsInput,
} from '@/features/ops-hospitals/presentation/components/hospitals.view';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BP = 10_000;
const NOTE_MAX = 500;
const FIELD_HEIGHT = 48;
const SAVE_FAILED = 'The commission could not be saved. Please try again.';

interface CommissionForm {
  percent: string;
  effectiveFrom: string;
  note: string;
}

const VALIDATORS: FormValidators<CommissionForm> = {
  percent: (v) => {
    const bp = parseHundredths(v);
    return bp !== null && bp <= MAX_BP
      ? undefined
      : 'Enter a percentage from 0 to 100, with up to two decimals.';
  },
  effectiveFrom: (v) => {
    if (!ISO_DATE.test(v)) return 'Pick the day the new rate starts.';
    return v >= todayISO() ? undefined : 'The new rate cannot start in the past.';
  },
  note: (v) =>
    v.trim().length <= NOTE_MAX ? undefined : `Keep the note under ${NOTE_MAX} characters.`,
};

interface HospitalCommissionModalProps {
  h: PlatformHospitalDetail;
  onClose: () => void;
}

/**
 * Record a new platform commission rate (`set-commission`, Q9). Rates are
 * kept as an append-only history: a rate starting today applies at once, a
 * later date takes over on that day. Commission is charged on the
 * consultation fee of each online booking at the rate in force when it is
 * paid, so earlier bookings are not recalculated.
 */
export function HospitalCommissionModal({ h, onClose }: HospitalCommissionModalProps) {
  const setCommission = useSetHospitalCommissionMutation();

  const form = useForm<CommissionForm>({
    initial: { percent: hundredthsInput(h.commissionBp), effectiveFrom: todayISO(), note: '' },
    validate: VALIDATORS,
    onSubmit: async (values) => {
      const bp = parseHundredths(values.percent);
      if (bp === null) return;
      try {
        await setCommission.mutateAsync({
          id: h.id,
          change: {
            commissionBp: bp,
            effectiveFrom: values.effectiveFrom,
            note: values.note.trim() || null,
          },
        });
        toast(
          values.effectiveFrom === todayISO()
            ? `Commission for ${h.name} is now ${bpCopy(bp)}.`
            : `Commission for ${h.name} changes to ${bpCopy(bp)} on ${fmtDate(values.effectiveFrom)}.`,
          'success',
        );
        onClose();
      } catch (error) {
        toast(isFailure(error) ? error.message : SAVE_FAILED, 'error');
      }
    },
  });

  const { values } = form;

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Commission for ${h.name}`}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel="Save Commission"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OpsField
            label="Commission (%)"
            required
            error={form.errorFor('percent')}
            hint={`Currently ${bpCopy(h.commissionBp)}.`}
          >
            <TextInput
              value={values.percent}
              onChange={(v) => form.setField('percent', v)}
              onBlur={() => form.blurField('percent')}
              inputMode="decimal"
              placeholder="e.g. 4.5"
              height={FIELD_HEIGHT}
            />
          </OpsField>
          <OpsField label="Starts On" required error={form.errorFor('effectiveFrom')}>
            <TextInput
              value={values.effectiveFrom}
              onChange={(v) => form.setField('effectiveFrom', v)}
              onBlur={() => form.blurField('effectiveFrom')}
              type="date"
              min={todayISO()}
              height={FIELD_HEIGHT}
            />
          </OpsField>
        </div>
        <OpsField label="Note" error={form.errorFor('note')} hint="Kept with the rate history.">
          <TextInput
            value={values.note}
            onChange={(v) => form.setField('note', v)}
            onBlur={() => form.blurField('note')}
            placeholder="e.g. Renegotiated for the 2027 contract"
            maxLength={NOTE_MAX}
            height={FIELD_HEIGHT}
          />
        </OpsField>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" />
          <span>
            Charged on the consultation fee of each online booking, at the rate in force on the day
            it is paid. Bookings already paid are not recalculated.
          </span>
        </div>
      </div>
    </FormModal>
  );
}
