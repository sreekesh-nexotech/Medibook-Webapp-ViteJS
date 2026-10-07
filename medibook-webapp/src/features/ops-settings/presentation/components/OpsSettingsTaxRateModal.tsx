import { useState } from 'react';

import { FormModal } from '@/shared/ui/FormModal';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useCreateOpsTaxRateMutation } from '@/features/ops-settings/application/queries/useCreateOpsTaxRateMutation';
import { useUpdateOpsTaxRateMutation } from '@/features/ops-settings/application/queries/useUpdateOpsTaxRateMutation';
import type {
  TaxAppliesTo,
  TaxRate,
  TaxRateValues,
} from '@/features/ops-settings/domain/entities/opsSettings.entity';
import {
  APPLIES_TO_LABEL,
  appliesToOptionsFor,
  bpToPercentInput,
  percentInputToBp,
  taxRateInUseMessage,
} from '@/features/ops-settings/presentation/components/opsSettingsFormat';

/** The modal's text-and-toggle form. */
interface TaxRateForm {
  readonly code: string;
  readonly name: string;
  readonly rate: string;
  readonly appliesTo: TaxAppliesTo;
  readonly isInclusive: boolean;
  readonly isActive: boolean;
}

type TaxRateErrors = Partial<Record<'code' | 'name' | 'rate' | 'appliesTo', string | null>>;

/** Server field → form field. */
const SERVER_FIELD: Partial<Record<keyof TaxRateValues, keyof TaxRateErrors>> = {
  code: 'code',
  name: 'name',
  rateBp: 'rate',
  appliesTo: 'appliesTo',
};

const RATE_MAX_BP = 10_000;
const MODAL_WIDTH = 560;

const EMPTY_FORM: TaxRateForm = {
  code: '',
  name: '',
  rate: '',
  appliesTo: 'service',
  isInclusive: false,
  isActive: true,
};

function appliesToFromLabel(label: string, current: TaxAppliesTo): TaxAppliesTo {
  return appliesToOptionsFor(current).find((v) => APPLIES_TO_LABEL[v] === label) ?? current;
}

function toForm(rate: TaxRate | null): TaxRateForm {
  if (!rate) return EMPTY_FORM;
  return {
    code: rate.code,
    name: rate.name,
    rate: bpToPercentInput(rate.rateBp),
    appliesTo: rate.appliesTo,
    isInclusive: rate.isInclusive,
    isActive: rate.isActive,
  };
}

interface OpsSettingsTaxRateModalProps {
  /** The rate being edited, or `null` to add one. */
  rate: TaxRate | null;
  onClose: () => void;
}

/** Add or edit a platform default tax rate. Mount it only while open. */
export function OpsSettingsTaxRateModal({ rate, onClose }: OpsSettingsTaxRateModalProps) {
  const [f, setF] = useState<TaxRateForm>(() => toForm(rate));
  const [err, setErr] = useState<TaxRateErrors>({});
  const create = useCreateOpsTaxRateMutation();
  const update = useUpdateOpsTaxRateMutation();
  const busy = create.isPending || update.isPending;

  const upd = <K extends keyof TaxRateForm>(k: K, v: TaxRateForm[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErr((p) => ({ ...p, [k]: null }));
  };

  const handleError = (failure: unknown) => {
    if (!isFailure(failure)) {
      toast('Could not save the tax rate.', 'error');
      return;
    }
    const fromServer: TaxRateErrors = {};
    for (const [field, messages] of Object.entries(failure.fieldErrors)) {
      const formKey = SERVER_FIELD[field as keyof TaxRateValues];
      if (formKey) fromServer[formKey] = messages[0] ?? null;
    }
    setErr((p) => ({ ...p, ...fromServer }));
    toast(taxRateInUseMessage(failure.code, failure.meta) ?? failure.message, 'error');
  };

  const handleSubmit = () => {
    const rateBp = percentInputToBp(f.rate);
    const e: TaxRateErrors = {
      code: f.code.trim() === '' ? 'Enter a code.' : null,
      name: f.name.trim() === '' ? 'Enter a name.' : null,
      rate:
        rateBp === null || rateBp < 0 || rateBp > RATE_MAX_BP
          ? 'Enter a rate between 0 and 100.'
          : null,
    };
    setErr(e);
    if (e.code || e.name || e.rate || rateBp === null) return;

    const values: TaxRateValues = {
      code: f.code.trim(),
      name: f.name.trim(),
      rateBp,
      appliesTo: f.appliesTo,
      isInclusive: f.isInclusive,
      isActive: f.isActive,
    };
    if (rate) {
      update.mutate(
        { id: rate.id, values, version: rate.version },
        {
          onSuccess: () => {
            toast('Tax rate updated.', 'success');
            onClose();
          },
          onError: handleError,
        },
      );
    } else {
      create.mutate(values, {
        onSuccess: () => {
          toast('Tax rate added.', 'success');
          onClose();
        },
        onError: handleError,
      });
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={rate ? 'Edit Tax Rate' : 'Add Tax Rate'}
      width={MODAL_WIDTH}
      onSubmit={handleSubmit}
      submitLabel={rate ? 'Save Changes' : 'Add Tax Rate'}
      busy={busy}
    >
      <div className="grid grid-cols-2 gap-4">
        <OpsField
          label="Code"
          required
          error={err.code}
          hint={rate ? 'Fixed once the rate exists — services refer to it.' : undefined}
        >
          <TextInput
            value={f.code}
            name="code"
            onChange={(v) => upd('code', v)}
            readOnly={rate !== null}
            disabled={rate !== null}
            height={48}
          />
        </OpsField>
        <OpsField label="Name" required error={err.name}>
          <TextInput value={f.name} name="name" onChange={(v) => upd('name', v)} height={48} />
        </OpsField>
        <OpsField label="Rate (%)" required error={err.rate}>
          <TextInput
            value={f.rate}
            name="rate"
            inputMode="decimal"
            onChange={(v) => upd('rate', v)}
            height={48}
          />
        </OpsField>
        <OpsField
          label="Applies To"
          error={err.appliesTo}
          hint={
            f.appliesTo === 'convenience_fee'
              ? 'Pricing no longer reads this: the convenience-fee GST is set in Platform Settings. Pick what this rate should apply to.'
              : 'The convenience-fee GST is set in Platform Settings, not here.'
          }
        >
          <Select
            value={APPLIES_TO_LABEL[f.appliesTo]}
            options={appliesToOptionsFor(f.appliesTo).map((v) => APPLIES_TO_LABEL[v])}
            onChange={(v) => upd('appliesTo', appliesToFromLabel(v, f.appliesTo))}
            height={48}
          />
        </OpsField>
      </div>
      <div className="mt-4.5 flex flex-col gap-4.5">
        <div className="flex items-start gap-3">
          <Toggle
            value={f.isInclusive}
            onChange={(v) => upd('isInclusive', v)}
            label="Price includes tax"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-body text-text-strong font-medium">Price includes tax</span>
            <span className="text-caption text-text-muted">
              Off: tax is added on top of the listed price.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Toggle value={f.isActive} onChange={(v) => upd('isActive', v)} label="Active" />
          <div className="flex flex-col gap-0.5">
            <span className="text-body text-text-strong font-medium">Active</span>
            <span className="text-caption text-text-muted">
              Inactive rates stay on record but are not applied.
            </span>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
