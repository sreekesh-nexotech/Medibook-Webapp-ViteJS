import { useState } from 'react';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Button } from '@/shared/ui/Button';
import { CanOps } from '@/shared/ui/CanOps';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { PlanChangesPanel } from '@/features/ops-billing/presentation/components/PlanChangesPanel';
import { useArchivePlanMutation } from '@/features/ops-plans/application/queries/useArchivePlanMutation';
import { useDeletePlanMutation } from '@/features/ops-plans/application/queries/useDeletePlanMutation';
import { usePlansQuery } from '@/features/ops-plans/application/queries/usePlansQuery';
import { useUnarchivePlanMutation } from '@/features/ops-plans/application/queries/useUnarchivePlanMutation';
import type { CatalogPlan } from '@/features/ops-plans/domain/entities/plans.catalog';
import { PlanCard } from '@/features/ops-plans/presentation/components/PlanCard';
import { PlanModal } from '@/features/ops-plans/presentation/components/PlanModal';
import { PlanSubscribersDrawer } from '@/features/ops-plans/presentation/components/PlanSubscribersDrawer';

/** A plan picked for archiving, with its subscriber count when known. */
interface ArchiveTarget {
  readonly plan: CatalogPlan;
  readonly subscribers: number | null;
}

/** The user-safe sentence for a failed mutation. */
const failureMessage = (error: unknown, fallback: string): string =>
  isFailure(error) ? error.message : fallback;

/**
 * Subscription Plans (design `Ops.jsx` `OpsPlans`): the header strip + Create
 * Plan, the plan-card grid and the Recent Plan Changes queue with Approve /
 * Decline.
 *
 * The catalog is live (`/platform/plans`): each card carries both billing
 * periods, GST and trial, and the three ceilings the backend stores (users,
 * doctors, storage), plus Archive for plans that have had subscribers and so
 * cannot be deleted, and Restore for archived ones (UAT-57). "View Hospitals"
 * lists the live subscribers (11·R9). Plan-change requests use the billing
 * module's panel, readable with `billing.view` (decision 13; 11·F23).
 */
export function OpsPlansScreen() {
  const { can } = useOpsPermission();
  const plansQuery = usePlansQuery();
  const plans = plansQuery.data;
  const deleteMutation = useDeletePlanMutation();
  const archiveMutation = useArchivePlanMutation();
  const unarchiveMutation = useUnarchivePlanMutation();

  const [modal, setModal] = useState<CatalogPlan | 'new' | null>(null);
  const [delPlan, setDelPlan] = useState<CatalogPlan | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);
  const [restorePlan, setRestorePlan] = useState<CatalogPlan | null>(null);
  const [subscribersOf, setSubscribersOf] = useState<CatalogPlan | null>(null);

  /** Guard on the live count; the server refuses any plan that ever had subscribers. */
  const handleDeleteClick = (plan: CatalogPlan, subscribers: number | null) => {
    if (subscribers !== null && subscribers > 0) {
      toast(
        `${subscribers} hospital${subscribers === 1 ? ' is' : 's are'} on this plan — archive it or move them to another plan first.`,
        'error',
      );
      return;
    }
    setDelPlan(plan);
  };

  const confirmDelete = () => {
    if (!delPlan) return;
    deleteMutation.mutate(delPlan.id, {
      onSuccess: () => toast('Plan deleted.'),
      onError: (error) => toast(failureMessage(error, 'Could not delete the plan.'), 'error'),
      onSettled: () => setDelPlan(null),
    });
  };

  const confirmArchive = () => {
    if (!archiveTarget) return;
    const { name } = archiveTarget.plan;
    archiveMutation.mutate(archiveTarget.plan.id, {
      onSuccess: () => toast(`Plan "${name}" archived.`),
      onError: (error) => toast(failureMessage(error, 'Could not archive the plan.'), 'error'),
      onSettled: () => setArchiveTarget(null),
    });
  };

  const confirmRestore = () => {
    if (!restorePlan) return;
    const { name } = restorePlan;
    unarchiveMutation.mutate(
      { planId: restorePlan.id, version: restorePlan.version },
      {
        onSuccess: () => toast(`Plan "${name}" is open to new subscriptions again.`),
        onError: (error) => toast(failureMessage(error, 'Could not restore the plan.'), 'error'),
        onSettled: () => setRestorePlan(null),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Card pad={14} className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-body text-text-muted">
          {plans ? `${plans.length} plan tiers` : 'Plan tiers'} · standard plans are public;
          hospital-specific plans are negotiated per tenant
        </span>
        <CanOps perm="plans.add">
          <Button icon="plus" onClick={() => setModal('new')}>
            Create Plan
          </Button>
        </CanOps>
      </Card>

      {plansQuery.isLoading ? (
        <SkeletonCards count={3} lines={6} />
      ) : plansQuery.isError || !plans ? (
        <Card>
          <ErrorState
            inline
            title="Plan tiers didn't load."
            message={
              isFailure(plansQuery.error)
                ? plansQuery.error.message
                : 'Retrying usually fixes it — no plan was changed.'
            }
            onRetry={() => void plansQuery.refetch()}
          />
        </Card>
      ) : plans.length === 0 ? (
        <Card>
          <EmptyState
            icon="layers"
            title="No plan tiers in the catalog."
            message="Hospitals cannot be billed until at least one plan exists."
            {...(can('plans.add')
              ? {
                  actionLabel: 'Create the first plan',
                  actionIcon: 'plus' as const,
                  actionVariant: 'button' as const,
                  onAction: () => setModal('new'),
                }
              : {})}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              onEdit={setModal}
              onDelete={handleDeleteClick}
              onArchive={(plan, subscribers) => setArchiveTarget({ plan, subscribers })}
              onUnarchive={setRestorePlan}
              onSubscribers={setSubscribersOf}
            />
          ))}
        </div>
      )}

      <CanOps perm="billing.view">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Plan Change Requests</SectionTitle>
          </div>
          <PlanChangesPanel />
        </Card>
      </CanOps>

      {subscribersOf && (
        <PlanSubscribersDrawer plan={subscribersOf} onClose={() => setSubscribersOf(null)} />
      )}

      {modal && (
        <PlanModal
          key={modal === 'new' ? 'plan-new' : `plan-${modal.id}`}
          open
          plan={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onDone={() => setModal(null)}
        />
      )}
      <OpsConfirm
        open={!!delPlan}
        onClose={() => setDelPlan(null)}
        icon="trash-2"
        tone="danger"
        title="Delete this plan?"
        body={
          delPlan
            ? `"${delPlan.name}" is removed from the catalog. No hospitals are on it, so nothing else changes.`
            : ''
        }
        confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete Plan'}
        confirmVariant="danger"
        busy={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
      <OpsConfirm
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        icon="circle-slash"
        title="Archive this plan?"
        body={
          archiveTarget
            ? `"${archiveTarget.plan.name}" closes to new subscriptions and plan changes.${
                archiveTarget.subscribers
                  ? ` The ${archiveTarget.subscribers} hospital${archiveTarget.subscribers === 1 ? '' : 's'} already on it keep it.`
                  : ' Hospitals already on it keep it.'
              }`
            : ''
        }
        confirmLabel={archiveMutation.isPending ? 'Archiving…' : 'Archive Plan'}
        busy={archiveMutation.isPending}
        onConfirm={confirmArchive}
      />
      <OpsConfirm
        open={!!restorePlan}
        onClose={() => setRestorePlan(null)}
        icon="rotate-ccw"
        tone="success"
        title="Restore this plan?"
        body={
          restorePlan
            ? `"${restorePlan.name}" opens to new subscriptions and plan changes again, at its current price and limits.`
            : ''
        }
        confirmLabel={unarchiveMutation.isPending ? 'Restoring…' : 'Restore Plan'}
        busy={unarchiveMutation.isPending}
        onConfirm={confirmRestore}
      />
    </div>
  );
}
