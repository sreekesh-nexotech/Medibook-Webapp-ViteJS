import { isFailure } from '@/core/error/failure';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';
import { Toggle } from '@/shared/ui/Toggle';

import type {
  ServiceTaxRate,
  TaxAppliesTo,
  TaxRateInput,
} from '@/features/settings/domain/entities/services.entities';
import { priceService } from '@/features/settings/domain/services.pricing';
import {
  appliesToChoices,
  appliesToLabel,
  catalogueCodeError,
  taxesConsultations,
} from '@/features/settings/presentation/components/services.labels';
import {
  TAX_RATE_IN_USE,
  taxRateInUseOf,
} from '@/features/settings/presentation/components/taxRateInUse';

/** The amount the live preview prices, so the mode's effect is visible. */
const PREVIEW_AMOUNT = 1000;

/** Highest rate a hospital tax may carry — a typo above this is a mistake. */
const MAX_TAX_PERCENT = 100;

const TAX_MODES = ['Exclusive', 'Inclusive'] as const;
type TaxMode = (typeof TAX_MODES)[number];

interface TaxForm {
  name: string;
  code: string;
  percent: string;
  mode: TaxMode;
  appliesTo: TaxAppliesTo;
  active: boolean;
}

const VALIDATORS: FormValidators<TaxForm> = {
  name: (v) => required(v, 'Tax name'),
  code: (v) => catalogueCodeError(v),
  percent: (v) => {
    const raw = v.trim();
    if (raw === '') return 'Rate is required.';
    const n = Number(raw);
    if (!Number.isFinite(n)) return 'Rate must be a number.';
    if (n <= 0) return 'Rate must be greater than zero.';
    return n > MAX_TAX_PERCENT ? `Rate cannot exceed ${MAX_TAX_PERCENT}%.` : undefined;
  },
};

/** Server field → form field (UAT-48). */
const SERVER_FIELDS = {
  name: 'name',
  code: 'code',
  rate_bp: 'percent',
  is_inclusive: 'mode',
  applies_to: 'appliesTo',
  is_active: 'active',
} as const;

interface TaxModalProps {
  open: boolean;
  /** The rate being edited, or null to add one. */
  tax: ServiceTaxRate | null;
  onClose: () => void;
  /** Persist; rejects with the server's failure so its field errors land on the form. */
  onSave: (input: TaxRateInput) => Promise<void>;
}

/**
 * Add / edit a tax rate (audit HA-04). Receipts print tax as its own line, so
 * `Exclusive` is the default and the preview shows exactly what the mode does
 * to a ₹ 1,000 service — rounded the way the backend rounds a tax line.
 *
 * A new rate is for services: consultations are GST-exempt by default (O-04,
 * decision 7), so a rate that taxes them is only kept visible, with a warning,
 * when it already does. Switching a rate off, or narrowing it away from
 * services, is refused while services bill with it (409 `TAX_RATE_IN_USE`).
 */
export function TaxModal({ open, tax, onClose, onSave }: TaxModalProps) {
  const form = useForm<TaxForm>({
    initial: {
      name: tax?.name ?? '',
      code: '',
      percent: String(tax?.percent ?? 18),
      mode: tax?.isInclusive ? 'Inclusive' : 'Exclusive',
      appliesTo: tax?.appliesTo ?? 'service',
      active: tax?.isActive ?? true,
    },
    validate: VALIDATORS,
    onSubmit: async (v) => {
      try {
        await onSave({
          code: v.code.trim(),
          name: v.name.trim(),
          percent: Number(v.percent),
          isInclusive: v.mode === 'Inclusive',
          appliesTo: v.appliesTo,
          isActive: v.active,
        });
        onClose();
      } catch (error) {
        const inUse = isFailure(error) && error.code === TAX_RATE_IN_USE;
        const headline = form.applyServerErrors(
          error,
          { fields: SERVER_FIELDS, labels: { code: 'Code' } },
          'The tax rate could not be saved.',
        );
        toast(inUse ? (taxRateInUseOf(error)?.message ?? headline) : headline, 'error');
      }
    },
  });

  const percent = Number(form.values.percent);
  const isInclusive = form.values.mode === 'Inclusive';
  const choices = appliesToChoices(tax?.appliesTo ?? null);
  const preview = priceService(PREVIEW_AMOUNT, {
    id: 'preview',
    code: 'preview',
    name: form.values.name || 'Tax',
    percent: Number.isFinite(percent) ? percent : 0,
    isInclusive,
    appliesTo: form.values.appliesTo,
    isActive: true,
    isPlatformDefault: false,
    servicesCount: null,
    version: 0,
  });
  const usedBy = tax?.servicesCount ?? 0;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={tax ? 'Edit Tax Rate' : 'Add Tax Rate'}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel={tax ? 'Save Tax Rate' : 'Add Tax Rate'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4">
        <FormErrorSummary messages={form.serverSummary} />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Tax Name" required error={form.errorFor('name')} className="col-span-2">
            <TextInput
              value={form.values.name}
              onChange={(v) => form.setField('name', v)}
              onBlur={() => form.blurField('name')}
              placeholder="e.g. GST"
              height={48}
              autoFocus
            />
          </Field>
          <Field
            label="Short code"
            error={form.errorFor('code')}
            hint={tax ? `Now ${tax.code}. Leave empty to keep it.` : 'Optional.'}
          >
            <TextInput
              value={form.values.code}
              onChange={(v) => form.setField('code', v.replace(/\s/g, ''))}
              onBlur={() => form.blurField('code')}
              placeholder={tax?.code ?? 'GST_18'}
              maxLength={40}
              height={48}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rate (%)" required error={form.errorFor('percent')}>
            <TextInput
              value={form.values.percent}
              onChange={(v) => form.setField('percent', v.replace(/[^0-9.]/g, ''))}
              onBlur={() => form.blurField('percent')}
              inputMode="decimal"
              height={48}
            />
          </Field>
          <Field
            label="Applied"
            error={form.errorFor('mode')}
            hint={
              isInclusive
                ? 'Already inside the price — the receipt breaks it back out.'
                : 'Added on top of the price — the receipt shows it as its own line.'
            }
          >
            <Select
              value={form.values.mode}
              options={TAX_MODES}
              onChange={(v) => form.setField('mode', v === 'Inclusive' ? 'Inclusive' : 'Exclusive')}
              height={48}
            />
          </Field>
        </div>
        <Field
          label="Applies to"
          error={form.errorFor('appliesTo')}
          hint={
            choices.length === 1
              ? 'Pick it on each service it applies to. Consultations are GST-exempt (O-04).'
              : 'Services use the rate picked on each service.'
          }
        >
          <Select
            value={appliesToLabel(form.values.appliesTo)}
            options={choices.map(appliesToLabel)}
            onChange={(label) =>
              form.setField(
                'appliesTo',
                choices.find((c) => appliesToLabel(c) === label) ?? 'service',
              )
            }
            height={48}
            disabled={choices.length === 1}
          />
        </Field>
        {taxesConsultations(form.values.appliesTo) && (
          <p className="text-body bg-y-100 text-y-700 flex items-start gap-2 rounded-md px-3 py-2.5">
            <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
            This rate also taxes every consultation fee, which is GST-exempt by default (O-04).
            Choose Services to stop charging it on consultations.
          </p>
        )}

        <div className="border-border-soft bg-bg-subtle rounded-md border px-3.5 py-3">
          <div className="text-caption text-text-muted mb-2">
            On a {money(PREVIEW_AMOUNT)} service this rate produces:
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-body text-text-body flex justify-between">
              <span>Service</span>
              <span className="tabular-nums">{money(preview.base)}</span>
            </div>
            <div className="text-body text-text-body flex justify-between">
              <span>
                {form.values.name || 'Tax'} {Number.isFinite(percent) ? percent : 0}% (
                {form.values.mode.toLowerCase()})
              </span>
              <span className="tabular-nums">{money(preview.tax)}</span>
            </div>
            <div className="border-border-soft text-body text-text-strong flex justify-between border-t pt-1.5 font-semibold">
              <span>Patient pays</span>
              <span className="tabular-nums">{money(preview.total)}</span>
            </div>
          </div>
        </div>

        <div className="border-border-soft flex items-center gap-3 rounded-md border px-3.5 py-3">
          <Toggle
            value={form.values.active}
            onChange={(v) => form.setField('active', v)}
            label="Apply this tax to receipts"
          />
          <div className="flex flex-col">
            <span className="text-body text-text-strong font-medium">Apply to receipts</span>
            <span className="text-caption text-text-muted">
              {usedBy > 0
                ? `${usedBy} service${usedBy === 1 ? ' bills' : 's bill'} with this rate — pick another rate on ${usedBy === 1 ? 'it' : 'them'} before switching it off.`
                : 'Switched off, the rate is kept but no receipt charges it.'}
            </span>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
