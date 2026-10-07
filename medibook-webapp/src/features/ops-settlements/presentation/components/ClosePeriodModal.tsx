import { useState } from 'react';

import { addDaysISO, fmtDate, money, todayISO } from '@/shared/lib/format';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import { toast } from '@/shared/ui/toast/toast.store';

import { useClosePeriodsMutation } from '@/features/ops-settlements/application/queries/useClosePeriodsMutation';
import type {
  PeriodCloseOutcome,
  PeriodCloseRequest,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import {
  closeSkipLabel,
  failureText,
} from '@/features/ops-settlements/presentation/components/opsSettlements.viewModel';
import { SettlementDateInput } from '@/features/ops-settlements/presentation/components/SettlementDateInput';

const EVERY_HOSPITAL = 'Every hospital with activity';
const PREVIEW_COLUMNS = ['Hospital', 'Period', 'Net payable'] as const;

export interface HospitalChoice {
  readonly id: string;
  readonly name: string;
}

interface ClosePeriodModalProps {
  hospitals: readonly HospitalChoice[];
  /**
   * `false` on a backend without dry runs (BE-27): it closes on the first
   * request, so the dialog asks for a confirmation instead of a preview.
   */
  supportsPreview: boolean;
  onClose: () => void;
}

/** "3 periods" / "1 period". */
function periods(n: number): string {
  return `${n} period${n === 1 ? '' : 's'}`;
}

/**
 * Close settlement periods (UAT-37, 09·F1/R1) — `POST
 * /platform/settlements/periods/close`. A dry run comes first: it lists each
 * hospital that would close with the net it would freeze, and the hospitals
 * skipped for an overlap; only then does Close send `?dry_run=false`. The
 * period must end before today (hospital-local) and may not overlap an
 * existing one — the server's 400/409 says which.
 */
export function ClosePeriodModal({ hospitals, supportsPreview, onClose }: ClosePeriodModalProps) {
  const close = useClosePeriodsMutation();
  const yesterday = addDaysISO(todayISO(), -1);
  const [hospitalName, setHospitalName] = useState(EVERY_HOSPITAL);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(yesterday);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<PeriodCloseOutcome, { kind: 'preview' }> | null>(
    null,
  );

  const hospitalId = hospitals.find((h) => h.name === hospitalName)?.id ?? null;
  const request: PeriodCloseRequest = { hospitalId, periodStart: start, periodEnd: end };
  const nameOf = (id: string): string => hospitals.find((h) => h.id === id)?.name ?? 'A hospital';

  const invalid = (): string | null => {
    if (!start || !end) return 'Pick the first and last day of the period.';
    if (end < start) return 'The period cannot end before it starts.';
    if (end > yesterday) return 'A period can only be closed once it has ended (by yesterday).';
    return null;
  };

  const onChange = (apply: () => void): void => {
    apply();
    setPreview(null);
    setError(null);
  };

  const done = (outcome: PeriodCloseOutcome): void => {
    if (outcome.kind === 'preview') {
      setPreview(outcome);
      return;
    }
    const n = outcome.closed.length;
    const skipped = outcome.skipped.length;
    toast(
      n === 0
        ? `No period was closed${skipped > 0 ? ` — ${skipped} hospital${skipped === 1 ? ' was' : 's were'} skipped` : ''}.`
        : `${periods(n)} closed${skipped > 0 ? `, ${skipped} skipped` : ''} — ready for a payout run.`,
      n === 0 ? 'info' : 'success',
    );
    onClose();
  };

  const submit = (): void => {
    const problem = invalid();
    if (problem) {
      setError(problem);
      return;
    }
    // Without previews the first request closes, so it is the confirmed one.
    const confirm = preview !== null || !supportsPreview;
    close.mutate(
      { request, confirm },
      {
        onSuccess: done,
        onError: (failure) => setError(failureText(failure, 'The period could not be closed.')),
      },
    );
  };

  const willClose = preview?.wouldClose ?? [];
  const submitLabel = close.isPending
    ? preview || !supportsPreview
      ? 'Closing…'
      : 'Checking…'
    : preview
      ? willClose.length === 0
        ? 'Nothing to close'
        : `Close ${periods(willClose.length)}`
      : supportsPreview
        ? 'Preview'
        : 'Close Period';

  return (
    <FormModal
      open
      onClose={onClose}
      title="Close Settlement Period"
      width={640}
      onSubmit={submit}
      submitLabel={submitLabel}
      busy={close.isPending}
      disabled={close.isPending || (preview !== null && willClose.length === 0)}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <OpsField label="Hospital">
            <Select
              value={hospitalName}
              options={[EVERY_HOSPITAL, ...hospitals.map((h) => h.name)]}
              onChange={(v) => onChange(() => setHospitalName(v))}
              height={44}
            />
          </OpsField>
          <OpsField label="First day" required>
            <SettlementDateInput
              value={start}
              onChange={(v) => onChange(() => setStart(v))}
              title="First day of the period"
            />
          </OpsField>
          <OpsField label="Last day" required>
            <SettlementDateInput
              value={end}
              onChange={(v) => onChange(() => setEnd(v))}
              title="Last day of the period"
            />
          </OpsField>
        </div>
        <div className="text-caption text-text-muted bg-blue-soft-bg flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" />
          <span>
            Closing freezes each hospital&apos;s ledger for these dates into a statement that a
            payout run can pay.{' '}
            {hospitalId
              ? 'This hospital closes even with no bookings in the window.'
              : 'Every hospital with ledger activity in the window closes; one that already has an overlapping period is skipped.'}{' '}
            {supportsPreview
              ? 'Preview first — nothing is closed until you confirm.'
              : 'This server closes straight away; there is no preview.'}
          </span>
        </div>
        {preview && (
          <div className="flex flex-col gap-3">
            <TableShell
              columns={PREVIEW_COLUMNS}
              rightCols={['Net payable']}
              scrollLabel="Periods that would close"
              state={
                willClose.length === 0
                  ? {
                      kind: 'empty',
                      icon: 'landmark',
                      title: 'Nothing would close.',
                      message: 'No hospital had ledger activity in this window that is not closed.',
                    }
                  : undefined
              }
            >
              {willClose.map((r) => (
                <tr key={r.hospitalId}>
                  <td className={tdClass}>{r.hospitalName}</td>
                  <td className={tdClass}>
                    {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
                    {r.breakdown && (
                      <div className="text-caption text-text-muted">
                        {r.breakdown.bookingsCount} booking
                        {r.breakdown.bookingsCount === 1 ? '' : 's'}
                      </div>
                    )}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {money(r.netPayableRupees)}
                  </td>
                </tr>
              ))}
            </TableShell>
            {willClose.length > 0 && (
              <div className="text-body text-text-strong flex justify-between font-medium">
                <span>Total to freeze</span>
                <span className="tabular-nums">
                  {money(willClose.reduce((a, r) => a + r.netPayableRupees, 0))}
                </span>
              </div>
            )}
            {preview.skipped.length > 0 && (
              <div className="text-caption text-y-700 bg-y-100 flex items-start gap-2 rounded-sm px-3 py-2.5">
                <Icon name="triangle-alert" size={14} className="mt-px flex-none" />
                <span>
                  Skipped:{' '}
                  {preview.skipped
                    .map((s) => `${nameOf(s.hospitalId)} (${closeSkipLabel(s.reason)})`)
                    .join(', ')}
                  .
                </span>
              </div>
            )}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="text-caption text-d-700 bg-d-100 flex items-start gap-2 rounded-sm px-3 py-2.5"
          >
            <Icon name="triangle-alert" size={14} className="mt-px flex-none" /> {error}
          </div>
        )}
      </div>
    </FormModal>
  );
}
