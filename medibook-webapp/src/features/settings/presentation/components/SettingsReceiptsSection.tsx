import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import { Select } from '@/shared/ui/Select';
import { Toggle } from '@/shared/ui/Toggle';

import type { ReceiptPaper } from '@/features/settings/domain/entities/settings.entities';
import {
  DESK_PAYMENT_METHODS,
  RECEIPT_PAPER_OPTIONS,
  type RulesForm,
} from '@/features/settings/application/store/settings.form';

import { PrintTemplatesPanel } from './PrintTemplatesPanel';
import { RuleCard } from './RuleCard';
import { RuleRow } from './RuleRow';
import type { SectionDraft } from './settingsEditor.types';

const PAPER_LABEL: Readonly<Record<ReceiptPaper, string>> = {
  A5: 'A5 sheet',
  '80mm': '80 mm thermal roll',
  A4: 'A4 sheet',
};

function paperOf(label: string): ReceiptPaper {
  return RECEIPT_PAPER_OPTIONS.find((p) => PAPER_LABEL[p] === label) ?? 'A5';
}

interface SettingsReceiptsSectionProps {
  draft: SectionDraft<RulesForm>;
  mayEdit: boolean;
}

/**
 * Settings › Receipts & Printing — the receipt paper and whether the
 * receipt names the staff member, the desk's accepted payment methods (once
 * the backend offers the setting, APPT-03) and the print templates.
 */
export function SettingsReceiptsSection({ draft, mayEdit }: SettingsReceiptsSectionProps) {
  const { value, set, errors } = draft;
  const methods = value.deskPaymentMethods;
  const toggleMethod = (method: string): void => {
    if (methods === null) return;
    set(
      'deskPaymentMethods',
      methods.includes(method) ? methods.filter((m) => m !== method) : [...methods, method],
    );
  };
  return (
    <>
      <RuleCard title="Receipts" hint="Desk receipts and token slips">
        <RuleRow label="Paper" hint="The size receipts are laid out for when printed.">
          <div className="w-52">
            <Select
              value={PAPER_LABEL[value.receiptPaper]}
              options={RECEIPT_PAPER_OPTIONS.map((p) => PAPER_LABEL[p])}
              onChange={(v) => set('receiptPaper', paperOf(v))}
              height={40}
              aria-label="Receipt paper"
              disabled={!mayEdit}
            />
          </div>
        </RuleRow>
        <RuleRow
          label="Print the staff name"
          hint="Receipts name the staff member and counter that took the payment."
          last={methods === null}
        >
          <Toggle
            value={value.receiptShowStaff}
            onChange={(v) => set('receiptShowStaff', v)}
            label="Print the staff name on receipts"
            disabled={!mayEdit}
          />
        </RuleRow>
        {methods !== null && (
          <div className="py-3.5">
            <div className="text-body text-text-body">Accepted at the desk</div>
            <div className="text-caption text-text-muted mb-2.5">
              The payment methods the front desk can record. Online payments are not affected.
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Accepted desk payment methods"
            >
              {DESK_PAYMENT_METHODS.map((m) => {
                const on = methods.includes(m.value);
                return (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={on}
                    disabled={!mayEdit}
                    onClick={() => toggleMethod(m.value)}
                    className={cn(
                      'text-body inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5',
                      on
                        ? 'border-blue bg-blue-soft-bg text-blue'
                        : 'border-border text-text-body bg-white',
                      mayEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                    )}
                  >
                    {on && <Icon name="check" size={14} />}
                    {m.label}
                  </button>
                );
              })}
            </div>
            {errors.deskPaymentMethods && (
              <span className="text-caption text-d-700 mt-2 flex items-center gap-1.5">
                <Icon name="triangle-alert" size={13} /> {errors.deskPaymentMethods}
              </span>
            )}
          </div>
        )}
      </RuleCard>
      <PrintTemplatesPanel />
    </>
  );
}
