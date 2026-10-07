import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { FormModal } from '@/shared/ui/FormModal';
import { CanOps } from '@/shared/ui/CanOps';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { Modal } from '@/shared/ui/Modal';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { OpsField } from '@/shared/ui/OpsField';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { opsInvoiceDetailPath } from '@/app/router/paths';

import { useApprovePlanChangeMutation } from '@/features/ops-billing/application/queries/useApprovePlanChangeMutation';
import { usePlanChangePreviewQuery } from '@/features/ops-billing/application/queries/usePlanChangePreviewQuery';
import { usePlanChangesQuery } from '@/features/ops-billing/application/queries/usePlanChangesQuery';
import { useRejectPlanChangeMutation } from '@/features/ops-billing/application/queries/useRejectPlanChangeMutation';
import type {
  PlanChangeOutcome,
  PlanChangeRequest,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { BillingHospitalName } from '@/features/ops-billing/presentation/components/BillingHospitalName';
import {
  PLAN_CHANGE_BADGES,
  failureText,
  fmtDateTime,
  fromLabel,
  rupees,
} from '@/features/ops-billing/presentation/components/billingView';
import { ProrationPreviewBox } from '@/features/ops-billing/presentation/components/ProrationPreviewBox';
import { usePlansQuery } from '@/features/ops-plans/application/queries/usePlansQuery';

const PAGE_SIZE = 6;
const ALL_STATUSES = 'Status: All';
/** `PlanChangeRejectSerializer.note` max length. */
const NOTE_MAX_LENGTH = 2000;
const DECIDE_FAILED = 'The request could not be updated. Please try again.';

const COLUMNS = ['Hospital', 'Change', 'Requested', 'Note', 'Status', 'Action'] as const;

const PERIOD_LABELS = { monthly: 'monthly', yearly: 'yearly' } as const;

/** The approved request and what it issued, for the result dialog. */
interface ApprovalResult {
  readonly toPlan: string;
  readonly outcome: PlanChangeOutcome;
}

/**
 * Hospitals' plan-change requests (raised from their Plan & Billing tab),
 * readable with `billing.view` (decision 13). Approving (`billing.edit`)
 * applies the change at once with proration: the dialog previews what will
 * be issued (BE-28) and the result names — and links — the proration invoice
 * or credit note (UAT-57). Rejecting keeps the current plan and may carry a
 * note back to the hospital.
 */
export function PlanChangesPanel() {
  const navigate = useNavigate();
  const [statusF, setStatusF] = useState(PLAN_CHANGE_BADGES.requested.label);
  const [page, setPage] = useState(0);
  const [approving, setApproving] = useState<PlanChangeRequest | null>(null);
  const [rejecting, setRejecting] = useState<PlanChangeRequest | null>(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<ApprovalResult | null>(null);
  const preview = usePlanChangePreviewQuery(approving?.id ?? null);

  const status = fromLabel(PLAN_CHANGE_BADGES, statusF);
  const query = usePlanChangesQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    statuses: status ? [status] : [],
  });
  const plans = usePlansQuery();
  const planName = useMemo(() => {
    const names = new Map((plans.data ?? []).map((p) => [p.id, p.name]));
    return (id: string, fromRow: string | null = null) =>
      fromRow ?? names.get(id) ?? 'Unknown plan';
  }, [plans.data]);
  const approve = useApprovePlanChangeMutation();
  const reject = useRejectPlanChangeMutation();

  const rows = query.data?.items ?? [];
  const tableState: TableStateSpec | undefined = query.isPending
    ? { kind: 'loading', rows: PAGE_SIZE }
    : query.isError
      ? {
          kind: 'error',
          message: failureText(query.error, DECIDE_FAILED),
          onRetry: () => void query.refetch(),
        }
      : rows.length === 0
        ? {
            kind: 'empty',
            icon: 'layers',
            title: status === 'requested' ? 'No plan changes waiting.' : 'No plan changes match.',
            message:
              status === 'requested'
                ? 'Requests hospitals raise from their Plan & Billing tab appear here for review.'
                : 'Try another status.',
          }
        : undefined;

  const handleApprove = (): void => {
    if (!approving) return;
    const toPlan = planName(approving.toPlanId, approving.toPlanName);
    approve.mutate(approving.id, {
      onSuccess: (approval) => {
        toast(`Plan changed to ${toPlan}.`, 'success');
        setApproving(null);
        setResult({ toPlan, outcome: approval.outcome });
      },
      onError: (error) => toast(failureText(error, DECIDE_FAILED), 'error'),
    });
  };

  const handleReject = (): void => {
    if (!rejecting) return;
    reject.mutate(
      { id: rejecting.id, note: note.trim() || null },
      {
        onSuccess: () => {
          toast('Plan change rejected.', 'success');
          setRejecting(null);
          setNote('');
        },
        onError: (error) => toast(failureText(error, DECIDE_FAILED), 'error'),
      },
    );
  };

  return (
    <>
      <div className="mb-4.5 flex flex-wrap items-center gap-3">
        <RefreshBtn
          onRefresh={async () => {
            await query.refetch();
          }}
          title="Refresh plan changes"
        />
        <FilterSelect
          value={status ? statusF : ALL_STATUSES}
          aria-label="Filter plan changes by status"
          options={[ALL_STATUSES, ...Object.values(PLAN_CHANGE_BADGES).map((b) => b.label)]}
          onChange={(v) => {
            setStatusF(v);
            setPage(0);
          }}
        />
      </div>
      <TableShell columns={COLUMNS} scrollLabel="Plan change requests" state={tableState}>
        {rows.map((r) => {
          const badge = PLAN_CHANGE_BADGES[r.status];
          return (
            <tr key={r.id}>
              <td className={tdClass}>
                {r.hospitalName ?? <BillingHospitalName hospitalId={r.hospitalId} />}
              </td>
              <td className={tdClass}>
                {planName(r.fromPlanId, r.fromPlanName)} → {planName(r.toPlanId, r.toPlanName)}
                <div className="text-caption text-text-muted">
                  Billed {PERIOD_LABELS[r.toBillingPeriod]}
                </div>
              </td>
              <td className={tdClass}>{fmtDateTime(r.requestedAt)}</td>
              <td className={tdClass}>{r.note || r.reviewNote || '—'}</td>
              <td className={tdClass}>
                <Badge status={badge.status}>{badge.label}</Badge>
              </td>
              <td className={tdClass}>
                {r.status === 'requested' ? (
                  <CanOps
                    perm="billing.edit"
                    fallback={<span className="text-caption text-text-muted">Awaiting review</span>}
                  >
                    <div className="flex gap-2">
                      <IconBtn
                        name="circle-check"
                        label="Approve plan change"
                        box={36}
                        size={16}
                        onClick={() => setApproving(r)}
                      />
                      <IconBtn
                        name="circle-x"
                        label="Reject plan change"
                        box={36}
                        size={16}
                        onClick={() => setRejecting(r)}
                      />
                    </div>
                  </CanOps>
                ) : (
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-caption text-text-muted">
                      {r.reviewedAt ? `Reviewed ${fmtDateTime(r.reviewedAt)}` : '—'}
                    </span>
                    {r.prorationInvoiceId && (
                      <button
                        type="button"
                        onClick={() => navigate(opsInvoiceDetailPath(r.prorationInvoiceId ?? ''))}
                        className="text-caption text-link cursor-pointer"
                      >
                        View proration invoice
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </TableShell>
      <Pager
        total={query.data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        onPage={setPage}
        noun="requests"
      />

      <OpsConfirm
        open={approving !== null}
        onClose={() => setApproving(null)}
        icon="circle-check"
        tone="success"
        title="Approve this plan change?"
        body="The new plan applies today."
        summary={
          approving
            ? [
                { k: 'Hospital', v: approving.hospitalName ?? '—' },
                { k: 'From', v: planName(approving.fromPlanId, approving.fromPlanName) },
                { k: 'To', v: planName(approving.toPlanId, approving.toPlanName) },
                { k: 'Billing', v: PERIOD_LABELS[approving.toBillingPeriod] },
              ]
            : undefined
        }
        confirmLabel={approve.isPending ? 'Approving…' : 'Approve Change'}
        busy={approve.isPending}
        disabled={preview.isFetching}
        onConfirm={handleApprove}
      >
        <div className="w-full">
          <ProrationPreviewBox
            preview={preview.data}
            isLoading={preview.isPending && approving !== null}
            error={preview.error}
          />
        </div>
      </OpsConfirm>
      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        title="Plan changed"
        width={480}
        footer={
          <>
            {result?.outcome.prorationInvoice && (
              <Button
                variant="secondary"
                icon="file-text"
                onClick={() => {
                  const id = result.outcome.prorationInvoice?.id ?? '';
                  setResult(null);
                  navigate(opsInvoiceDetailPath(id));
                }}
              >
                Open invoice
              </Button>
            )}
            <Button onClick={() => setResult(null)}>Done</Button>
          </>
        }
      >
        {result && (
          <div className="flex items-start gap-3">
            <Icon name="circle-check" size={20} className="text-g-600 mt-0.5 flex-none" />
            <p className="text-body text-text-body m-0">
              The hospital is now on {result.toPlan}.{' '}
              {result.outcome.prorationInvoice
                ? `Proration invoice ${result.outcome.prorationInvoice.number} for ${rupees(result.outcome.prorationInvoice.totalPaise)} was issued.`
                : result.outcome.creditNote
                  ? `Credit note ${result.outcome.creditNote.number} for ${rupees(result.outcome.creditNote.totalPaise)} was issued and settles its invoices.`
                  : 'Nothing was charged or credited.'}
            </p>
          </div>
        )}
      </Modal>
      <FormModal
        open={rejecting !== null}
        onClose={() => {
          // A cancelled rejection must not leave its note for the next one (11·F8).
          setRejecting(null);
          setNote('');
        }}
        title="Reject this plan change?"
        width={480}
        onSubmit={handleReject}
        submitLabel="Reject Request"
        submitVariant="danger"
        busy={reject.isPending}
      >
        <OpsField label="Note to the hospital" hint="Optional — why the change was not approved.">
          <TextInput
            value={note}
            onChange={setNote}
            maxLength={NOTE_MAX_LENGTH}
            placeholder="e.g. Contact us to discuss a custom plan"
            height={48}
          />
        </OpsField>
      </FormModal>
    </>
  );
}
