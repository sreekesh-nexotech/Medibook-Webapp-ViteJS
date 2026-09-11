import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { money } from '@/shared/lib/format';
import { required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { Toggle } from '@/shared/ui/Toggle';

import type { TaxDraft } from '@/features/settings/application/store/services.store';
import { priceWithTaxes } from '@/features/settings/application/store/services.logic';
import {
  TAX_MODES,
  type TaxMode,
  type TaxRate,
} from '@/features/settings/application/store/services.types';

/** The amount the live preview prices, so the mode's effect is visible. */
const PREVIEW_AMOUNT = 1000;

/** Highest rate a hospital tax may carry — a typo above this is a mistake. */
const MAX_TAX_PERCENT = 100;

interface TaxForm {
  name: string;
  percent: string;
  mode: TaxMode;
  active: boolean;
}

const VALIDATORS: FormValidators<TaxForm> = {
  name: (v) => required(v, 'Tax name'),
  percent: (v) => {
    const raw = v.trim();
    if (raw === '') return 'Rate is required.';
    const n = Number(raw);
    if (!Number.isFinite(n)) return 'Rate must be a number.';
    if (n <= 0) return 'Rate must be greater than zero.';
    return n > MAX_TAX_PERCENT ? `Rate cannot exceed ${MAX_TAX_PERCENT}%.` : undefined;
  },
};

interface TaxModalProps {
  open: boolean;
  /** The rate being edited, or null to add one. */
  tax: TaxRate | null;
  onClose: () => void;
  onSave: (draft: TaxDraft) => void;
}

/**
 * Add / edit a tax rate (audit HA-04). Receipts print tax as its own line, so
 * `Exclusive` is the default and the preview shows exactly what the mode does
 * to a ₹ 1,000 service.
 */
export function TaxModal({ open, tax, onClose, onSave }: TaxModalProps) {
  const form = useForm<TaxForm>({
    initial: {
      name: tax?.name ?? '',
      percent: String(tax?.percent ?? 18),
      mode: tax?.mode ?? 'Exclusive',
      active: tax?.active ?? true,
    },
    validate: VALIDATORS,
    onSubmit: (v) => {
      onSave({
        ...(tax ? { id: tax.id } : {}),
        name: v.name.trim(),
        percent: Number(v.percent),
        mode: v.mode,
        active: v.active,
      });
      onClose();
    },
  });

  const percent = Number(form.values.percent);
  const preview = priceWithTaxes(PREVIEW_AMOUNT, [
    {
      id: 'preview',
      name: form.values.name || 'Tax',
      percent: Number.isFinite(percent) ? percent : 0,
      mode: form.values.mode,
      active: true,
    },
  ]);

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
        <Field label="Tax Name" required error={form.errorFor('name')}>
          <TextInput
            value={form.values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            placeholder="e.g. GST"
            height={48}
            autoFocus
          />
        </Field>
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
            hint={
              form.values.mode === 'Exclusive'
                ? 'Added on top of the price — the receipt shows it as its own line.'
                : 'Already inside the price — the receipt breaks it back out.'
            }
          >
            <Select
              value={form.values.mode}
              options={TAX_MODES}
              onChange={(v) => form.setField('mode', v as TaxMode)}
              height={48}
            />
          </Field>
        </div>

        <div className="border-border-soft bg-bg-subtle rounded-md border px-3.5 py-3">
          <div className="text-caption text-text-muted mb-2">
            On a {money(PREVIEW_AMOUNT)} service this rate produces:
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-body text-text-body flex justify-between">
              <span>Service</span>
              <span className="tabular-nums">{money(preview.base)}</span>
            </div>
            {preview.taxes.map((line) => (
              <div key={line.name} className="text-body text-text-body flex justify-between">
                <span>
                  {line.name} {line.percent}% ({line.mode.toLowerCase()})
                </span>
                <span className="tabular-nums">{money(line.amount)}</span>
              </div>
            ))}
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
              Switched off, the rate is kept but no receipt carries it.
            </span>
          </div>
        </div>
      </div>
    </FormModal>
  );
}
