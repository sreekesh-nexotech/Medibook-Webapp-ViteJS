import { isFailure } from '@/core/error/failure';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { parseHundredths } from '@/shared/lib/format';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  ConvenienceFeeKind,
  PlatformHospitalDetail,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { useSetHospitalConvenienceFeeMutation } from '@/features/ops-hospitals/application/queries/useSetHospitalConvenienceFeeMutation';
import {
  convenienceFeeCopy,
  hundredthsInput,
} from '@/features/ops-hospitals/presentation/components/hospitals.view';

/** A percentage fee is 0–10000 basis points (backend `set_convenience_fee`). */
const MAX_PERCENT_BP = 10_000;
const FIELD_HEIGHT = 48;
const SAVE_FAILED = 'The convenience fee could not be saved. Please try again.';

const FEE_KINDS: readonly ConvenienceFeeKind[] = ['flat', 'percent'];
const FEE_KIND_LABEL: Readonly<Record<ConvenienceFeeKind, string>> = {
  flat: 'Flat amount (₹)',
  percent: 'Percent of fee (%)',
};

interface FeeForm {
  kind: ConvenienceFeeKind;
  value: string;
}

const VALIDATORS: FormValidators<FeeForm> = {
  value: (v, all) => {
    const hundredths = parseHundredths(v);
    if (all.kind === 'percent') {
      return hundredths !== null && hundredths <= MAX_PERCENT_BP
        ? undefined
        : 'Enter a percentage from 0 to 100, with up to two decimals.';
    }
    return hundredths !== null ? undefined : 'Enter an amount of ₹0 or more, e.g. 20 or 15.50.';
  },
};

interface HospitalConvenienceFeeModalProps {
  h: PlatformHospitalDetail;
  onClose: () => void;
}

/**
 * Change the convenience fee patients pay on each online booking
 * (`set-convenience-fee`, Q4): a flat amount in paise or a percentage of the
 * consultation fee in basis points. Each appointment keeps the fee it was
 * booked with, so the change applies to new bookings only.
 */
export function HospitalConvenienceFeeModal({ h, onClose }: HospitalConvenienceFeeModalProps) {
  const setFee = useSetHospitalConvenienceFeeMutation();

  const form = useForm<FeeForm>({
    initial: { kind: h.convenienceFeeKind, value: hundredthsInput(h.convenienceFeeValue) },
    validate: VALIDATORS,
    onSubmit: async (values) => {
      const value = parseHundredths(values.value);
      if (value === null) return;
      try {
        await setFee.mutateAsync({ id: h.id, change: { kind: values.kind, value } });
        toast(
          `Convenience fee for ${h.name} is now ${convenienceFeeCopy(values.kind, value)}.`,
          'success',
        );
        onClose();
      } catch (error) {
        toast(isFailure(error) ? error.message : SAVE_FAILED, 'error', error);
      }
    },
  });

  const { values } = form;

  return (
    <FormModal
      dirty={form.isDirty}
      open
      onClose={onClose}
      title={`Convenience fee for ${h.name}`}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel="Save Fee"
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OpsField label="Charged As">
            <Select
              value={FEE_KIND_LABEL[values.kind]}
              options={FEE_KINDS.map((k) => FEE_KIND_LABEL[k])}
              onChange={(label) =>
                form.setField('kind', FEE_KINDS.find((k) => FEE_KIND_LABEL[k] === label) ?? 'flat')
              }
              height={FIELD_HEIGHT}
            />
          </OpsField>
          <OpsField
            label={values.kind === 'percent' ? 'Percent (%)' : 'Amount (₹)'}
            required
            error={form.errorFor('value')}
            hint={`Currently ${convenienceFeeCopy(h.convenienceFeeKind, h.convenienceFeeValue)}.`}
          >
            <TextInput
              value={values.value}
              onChange={(v) => form.setField('value', v)}
              onBlur={() => form.blurField('value')}
              inputMode="decimal"
              placeholder={values.kind === 'percent' ? 'e.g. 2' : 'e.g. 20'}
              height={FIELD_HEIGHT}
            />
          </OpsField>
        </div>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" />
          <span>
            Added to what the patient pays for each online booking. Appointments already booked keep
            the fee they were booked with.
          </span>
        </div>
      </div>
    </FormModal>
  );
}
