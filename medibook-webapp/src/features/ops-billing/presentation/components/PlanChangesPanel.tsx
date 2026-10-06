import { useMemo, useState } from 'react';

import { Badge } from '@/shared/ui/Badge';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { FormModal } from '@/shared/ui/FormModal';
import { CanOps } from '@/shared/ui/CanOps';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { OpsField } from '@/shared/ui/OpsField';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useApprovePlanChangeMutation } from '@/features/ops-billing/application/queries/useApprovePlanChangeMutation';
import { usePlanChangesQuery } from '@/features/ops-billing/application/queries/usePlanChangesQuery';
import { useRejectPlanChangeMutation } from '@/features/ops-billing/application/queries/useRejectPlanChangeMutation';
import type { PlanChangeRequest } from '@/features/ops-billing/domain/entities/billing.entities';
import { BillingHospitalName } from '@/features/ops-billing/presentation/components/BillingHospitalName';
import {
  PLAN_CHANGE_BADGES,
  failureText,
  fmtDateTime,
  fromLabel,
} from '@/features/ops-billing/presentation/components/billingView';
import { usePlansQuery } from '@/features/ops-plans/application/queries/usePlansQuery';

const PAGE_SIZE = 6;
const ALL_STATUSES = 'Status: All';
/** `PlanChangeRejectSerializer.note` max length. */
const NOTE_MAX_LENGTH = 2000;
const DECIDE_FAILED = 'The request could not be updated. Please try again.';

const COLUMNS = ['Hospital', 'Change', 'Requested', 'Note', 'Status', 'Action'] as const;

const PERIOD_LABELS = { monthly: 'monthly', yearly: 'yearly' } as const;

/**
 * Hospitals' plan-change requests (raised from their Plan & Billing tab).
 * Approving applies the change at once with proration; rejecting keeps the
 * current plan and may carry a note back to the hospital.
 */
export function PlanChangesPanel() {
  const [statusF, setStatusF] = useState(PLAN_CHANGE_BADGES.requested.label);
  const [page, setPage] = useState(0);
  const [approving, setApproving] = useState<PlanChangeRequest | null>(null);
  const [rejecting, setRejecting] = useState<PlanChangeRequest | null>(null);
  const [note, setNote] = useState('');

  const status = fromLabel(PLAN_CHANGE_BADGES, statusF);
  const query = usePlanChangesQuery({
    page: page + 1,
    pageSize: PAGE_SIZE,
    statuses: status ? [status] : [],
  });
  const plans = usePlansQuery();
  const planName = useMemo(() => {
    const names = new Map((plans.data ?? []).map((p) => [p.id, p.name]));
    return (id: string) => names.get(id) ?? 'Unknown plan';
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
    approve.mutate(approving.id, {
      onSuccess: () => {
        toast(`Plan changed to ${planName(approving.toPlanId)}.`, 'success');
        setApproving(null);
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
                <BillingHospitalName hospitalId={r.hospitalId} />
              </td>
              <td className={tdClass}>
                {planName(r.fromPlanId)} → {planName(r.toPlanId)}
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
                  <span className="text-caption text-text-muted">
                    {r.reviewedAt ? `Reviewed ${fmtDateTime(r.reviewedAt)}` : '—'}
                  </span>
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
        body="The new plan applies today. Any difference for the rest of the current period is billed or credited on a proration invoice."
        summary={
          approving
            ? [
                { k: 'From', v: planName(approving.fromPlanId) },
                { k: 'To', v: planName(approving.toPlanId) },
                { k: 'Billing', v: PERIOD_LABELS[approving.toBillingPeriod] },
              ]
            : undefined
        }
        confirmLabel={approve.isPending ? 'Approving…' : 'Approve Change'}
        busy={approve.isPending}
        onConfirm={handleApprove}
      />
      <FormModal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
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
