import { useNavigate } from 'react-router-dom';

import { cn } from '@/shared/lib/cn';
import { money } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { CanOps } from '@/shared/ui/CanOps';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import { opsPath } from '@/app/router/paths';

import { usePlanSubscriberCountQuery } from '@/features/ops-plans/application/queries/usePlanSubscriberCountQuery';
import {
  PLAN_LIMIT_META,
  formatLimit,
  yearlyDiscountPct,
} from '@/features/ops-plans/application/store/plans.limits';
import {
  CATALOG_LIMIT_KEYS,
  type CatalogPlan,
} from '@/features/ops-plans/domain/entities/plans.catalog';

interface PlanCardProps {
  plan: CatalogPlan;
  onEdit: (plan: CatalogPlan) => void;
  /** Delete was pressed; `subscribers` is `null` while the count is unknown. */
  onDelete: (plan: CatalogPlan, subscribers: number | null) => void;
  onArchive: (plan: CatalogPlan, subscribers: number | null) => void;
}

/** "3 hospitals on this plan", or what to say while the count is loading or failed. */
function subscriberLine(count: number | undefined, isLoading: boolean): string {
  if (isLoading) return 'Counting hospitals on this plan…';
  if (count === undefined) return 'Hospital count unavailable';
  if (count === 0) return 'No hospitals on this plan yet';
  return `${count} hospital${count === 1 ? '' : 's'} on this plan`;
}

/**
 * One plan tier in the catalog grid: price, yearly option, the three
 * ceilings the backend stores, the extra feature line, and its actions. Owns
 * its subscriber-count query so each card loads its count independently.
 */
export function PlanCard({ plan, onEdit, onDelete, onArchive }: PlanCardProps) {
  const navigate = useNavigate();
  const subscribers = usePlanSubscriberCountQuery(plan.id);
  const count = subscribers.data;
  const knownCount = count ?? null;
  const discount =
    plan.priceYearly === null ? null : yearlyDiscountPct(plan.priceMonthly, plan.priceYearly);

  return (
    <div
      className={cn(
        'shadow-card border-border flex flex-col gap-3.5 rounded-xl border bg-white p-5',
        !plan.isActive && 'opacity-75',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <SectionTitle size={16}>{plan.name}</SectionTitle>
        {!plan.isPublic && (
          <span className="text-tiny text-text-muted bg-grey-300 flex-none rounded-full px-2.5 py-1 font-semibold tracking-[0.04em] uppercase">
            Hospital-specific
          </span>
        )}
        {!plan.isActive && (
          <span className="text-tiny text-text-muted bg-grey-300 flex-none rounded-full px-2.5 py-1 font-semibold tracking-[0.04em] uppercase">
            Archived
          </span>
        )}
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-stat text-text-navy tabular-nums">{money(plan.priceMonthly)}</span>
          <span className="text-body text-text-muted">/ month</span>
        </div>
        <div className="text-caption text-text-muted mt-1">
          {plan.priceYearly === null ? (
            'Monthly billing only'
          ) : (
            <>
              or <span className="tabular-nums">{money(plan.priceYearly)}</span> / year
              {discount !== null && discount > 0 && (
                <span className="text-g-600 font-medium"> · save {discount}%</span>
              )}
            </>
          )}
        </div>
      </div>
      <span className="text-caption text-text-muted">
        {subscriberLine(count, subscribers.isLoading)}
      </span>
      <div className="bg-border-soft h-px" />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {CATALOG_LIMIT_KEYS.map((key) => (
          <div key={key} className="min-w-0">
            <dt className="text-caption text-text-muted truncate">{PLAN_LIMIT_META[key].label}</dt>
            <dd className="text-body text-text-strong truncate font-medium tabular-nums">
              {formatLimit(plan.limits[key], key === 'storageGb' ? 'GB' : undefined)}
            </dd>
          </div>
        ))}
      </dl>
      {plan.description && (
        <>
          <div className="bg-border-soft h-px" />
          <div className="flex items-center gap-2">
            <Icon name="circle-check" size={16} className="text-g-600 flex-none" />
            <span className="text-body text-text-body">{plan.description}</span>
          </div>
        </>
      )}
      <div className="mt-auto flex items-center gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => navigate(`${opsPath('hospitals')}?plan=${encodeURIComponent(plan.name)}`)}
        >
          View Hospitals
        </Button>
        {/* SEC-05: editing and archiving need plans.edit; deleting needs plans.del. */}
        <CanOps perm="plans.edit">
          <IconBtn
            name="pencil"
            label="Edit plan"
            box={40}
            size={16}
            title={`Edit ${plan.name}`}
            onClick={() => onEdit(plan)}
          />
        </CanOps>
        {plan.isActive && (
          <CanOps perm="plans.edit">
            <IconBtn
              name="circle-slash"
              label="Archive plan"
              box={40}
              size={16}
              title="Archive plan — close it to new subscriptions"
              onClick={() => onArchive(plan, knownCount)}
            />
          </CanOps>
        )}
        <CanOps perm="plans.del">
          <IconBtn
            name="trash-2"
            label="Delete plan"
            box={40}
            size={16}
            color="var(--color-d-500)"
            title={
              knownCount !== null && knownCount > 0 ? 'Hospitals are on this plan' : 'Delete plan'
            }
            onClick={() => onDelete(plan, knownCount)}
          />
        </CanOps>
      </div>
    </div>
  );
}
