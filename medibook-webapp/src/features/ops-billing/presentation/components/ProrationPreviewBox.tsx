import { isFailure } from '@/core/error/failure';

import { Spinner } from '@/shared/ui/Spinner';

import type { ProrationPreview } from '@/features/ops-billing/domain/entities/billing.entities';
import { rupees } from '@/features/ops-billing/presentation/components/billingView';

interface ProrationPreviewBoxProps {
  preview: ProrationPreview | null | undefined;
  isLoading: boolean;
  error: unknown;
}

/**
 * The proration a plan change would issue, before anyone commits to it
 * (BE-28, UAT-57): an invoice for an upgrade, a credit note for a downgrade
 * (M-25), or nothing. `preview === null` means the server has no preview.
 */
export function ProrationPreviewBox({ preview, isLoading, error }: ProrationPreviewBoxProps) {
  if (isLoading) {
    return (
      <div className="bg-bg-subtle border-border text-text-muted flex items-center gap-2 rounded-md border px-4 py-3">
        <Spinner size={16} label="Working out the proration" />
        <span className="text-caption">Working out the proration…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-caption text-danger bg-d-100 rounded-md px-4 py-3">
        {isFailure(error) ? error.message : 'The proration could not be worked out.'}
      </div>
    );
  }
  if (preview === null || preview === undefined) {
    return (
      <div className="bg-bg-subtle border-border text-caption text-text-muted rounded-md border px-4 py-3">
        A proration invoice (or credit note, for a cheaper plan) is issued when you confirm.
      </div>
    );
  }
  if (preview.kind === 'none' || preview.lines.length === 0) {
    return (
      <div className="bg-bg-subtle border-border text-caption text-text-muted rounded-md border px-4 py-3">
        Nothing is charged or credited for this change.
      </div>
    );
  }
  const isCredit = preview.kind === 'credit_note';
  return (
    <div className="bg-bg-subtle border-border flex flex-col gap-2 rounded-md border px-4 py-3 text-left">
      <div className="text-body text-text-strong font-medium">
        {isCredit
          ? `A credit note for ${rupees(preview.creditNoteTotalPaise)} is issued and settles the hospital's invoices.`
          : `A proration invoice for ${rupees(preview.invoiceTotalPaise)} is issued now.`}
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {preview.lines.map((line, i) => (
          <li key={`${line.lineType}-${i}`} className="text-caption flex justify-between gap-3">
            <span className="text-text-muted">{line.description}</span>
            <span className="text-text-strong tabular-nums">{rupees(line.totalPaise)}</span>
          </li>
        ))}
      </ul>
      {preview.newPeriodStart && preview.newPeriodEnd && (
        <div className="text-caption text-text-muted">
          New period {preview.newPeriodStart} – {preview.newPeriodEnd}. Amounts include GST.
        </div>
      )}
    </div>
  );
}
