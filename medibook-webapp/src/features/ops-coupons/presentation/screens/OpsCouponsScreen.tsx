import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';
import { cn } from '@/shared/lib/cn';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { toast } from '@/shared/ui/toast/toast.store';

import { useNow } from '@/shared/hooks/useNow';
import { useOpsPermission } from '@/shared/hooks/useOpsPermission';

import { opsPath } from '@/app/router/paths';

import { useDeleteCouponMutation } from '@/features/ops-coupons/application/queries/useDeleteCouponMutation';
import { useOpsCouponsQuery } from '@/features/ops-coupons/application/queries/useOpsCouponsQuery';
import { useSaveCouponMutation } from '@/features/ops-coupons/application/queries/useSaveCouponMutation';
import { useToggleCouponMutation } from '@/features/ops-coupons/application/queries/useToggleCouponMutation';
import {
  couponState,
  dayOf,
  discountLabel,
  lastDayOf,
} from '@/features/ops-coupons/domain/couponRules';
import type {
  PlatformCoupon,
  PlatformCouponInput,
} from '@/features/ops-coupons/domain/entities/coupons.entities';
import { CouponUsesModal } from '@/features/ops-coupons/presentation/components/CouponUsesModal';
import { OpsCouponModal } from '@/features/ops-coupons/presentation/components/OpsCouponModal';

const EMPTY: readonly PlatformCoupon[] = [];

function failureMessage(error: unknown, fallback: string): string {
  return isFailure(error) ? error.message : fallback;
}

/** "Used 12 of 500" / "Used 12". */
function usesLabel(c: PlatformCoupon): string {
  const per = c.perUserCap === null ? '' : ` · ${c.perUserCap} per patient`;
  return c.usageCap === null
    ? `Used ${c.usedCount}${per}`
    : `Used ${c.usedCount} of ${c.usageCap}${per}`;
}

type Editing = { coupon: PlatformCoupon | null } | null;

/**
 * Coupons / Offers (client feedback point 9): Medibook Operations' coupon codes. Medibook pays
 * their discount (the hospital is credited it, so it still receives its full fee); they work on
 * online bookings at every hospital; one coupon per booking. Patients hear of an offer from a
 * home-screen banner (Notifications) and type the code when booking in the app. Same rights as
 * banners: `settings.view` to see, `settings.add` / `edit` / `del` to change.
 */
export function OpsCouponsScreen() {
  const { can } = useOpsPermission();
  const navigate = useNavigate();
  const query = useOpsCouponsQuery();
  const coupons = query.data ?? EMPTY;
  const save = useSaveCouponMutation();
  const toggle = useToggleCouponMutation();
  const remove = useDeleteCouponMutation();
  const canAdd = can('settings.add');
  const canEdit = can('settings.edit');
  const canDelete = can('settings.del');
  const now = useNow(); // a coupon's state follows the clock (Scheduled → Active → Expired)

  const [editing, setEditing] = useState<Editing>(null);
  const [uses, setUses] = useState<PlatformCoupon | null>(null);
  const [deleting, setDeleting] = useState<PlatformCoupon | null>(null);

  const onSave = async (input: PlatformCouponInput) => {
    const target = editing?.coupon ?? null;
    await save.mutateAsync({ target, input });
    toast(
      target
        ? `${input.code} updated.`
        : `${input.code} created. Add a banner in Notifications to tell patients about it.`,
      'success',
    );
  };

  const onToggle = (c: PlatformCoupon) =>
    toggle.mutate(
      { coupon: c, active: !c.isActive },
      {
        onSuccess: () => toast(`${c.code} ${c.isActive ? 'paused' : 'resumed'}.`, 'success'),
        onError: (error) =>
          toast(
            failureMessage(error, `Could not ${c.isActive ? 'pause' : 'resume'} the coupon.`),
            'error',
            error,
          ),
      },
    );

  const onDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting, {
      onSuccess: () => {
        toast(`${deleting.code} deleted.`, 'success');
        setDeleting(null);
      },
      onError: (error) =>
        toast(failureMessage(error, 'Could not delete the coupon.'), 'error', error),
    });
  };

  const activeCount = coupons.filter((c) => couponState(c, now) === 'Active').length;
  const editKey = editing ? (editing.coupon ? `edit-${editing.coupon.id}` : 'new') : 'closed';

  return (
    <div className="flex flex-col gap-5">
      <Card pad={16} className="flex items-start gap-3">
        <div className="bg-g-100 text-g-800 flex size-9.5 flex-none items-center justify-center rounded-md">
          <Icon name="ticket" size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-body text-text-strong font-medium">
            Medibook pays the discount on these coupons
          </div>
          <div className="text-caption text-text-muted">
            The hospital is credited the discount on its settlement, so it still receives its full
            fee. Codes work on online bookings at every hospital, one coupon per booking. Patients
            find an offer through a home-screen banner and type the code when they book in the app.
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon="megaphone"
          onClick={() => navigate(opsPath('notifications'))}
        >
          Banners
        </Button>
      </Card>

      {query.isPending ? (
        <SkeletonCards count={1} lines={5} />
      ) : query.isLoadingError ? (
        <ErrorState
          error={query.error}
          title="Coupons didn't load"
          message={failureMessage(query.error, "That didn't load. Retrying usually fixes it.")}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <SectionTitle>Coupons</SectionTitle>
            <div className="flex-1"></div>
            <span className="text-caption text-text-muted">
              {activeCount} active · {coupons.length} total
            </span>
            <Button icon="plus" disabled={!canAdd} onClick={() => setEditing({ coupon: null })}>
              Create Coupon
            </Button>
          </div>
          {coupons.length === 0 ? (
            <EmptyState
              icon="ticket"
              title="No Medibook coupons yet."
              message="Create a code, then add a banner in Notifications so patients see the offer."
              actionLabel="Create Coupon"
              actionIcon="plus"
              actionVariant="button"
              onAction={canAdd ? () => setEditing({ coupon: null }) : undefined}
            />
          ) : (
            <ul className="flex flex-col" aria-label="Medibook coupons">
              {coupons.map((c, i) => {
                const st = couponState(c, now);
                return (
                  <li
                    key={c.id}
                    aria-label={c.code}
                    className={cn(
                      'flex items-center gap-3.5 px-1 py-3.25',
                      i < coupons.length - 1 && 'border-border-soft border-b',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-body text-text-strong font-semibold tracking-wide">
                        {c.code}
                        <span className="text-text-body ml-2 font-normal tracking-normal">
                          {discountLabel(c)}
                        </span>
                      </div>
                      <div className="text-caption text-text-muted tabular-nums">
                        {fmtDate(dayOf(c.validFrom))} – {fmtDate(lastDayOf(c.validTo))} ·{' '}
                        {usesLabel(c)}
                        {c.minOrderRupees > 0 ? ` · fee ₹${c.minOrderRupees} or more` : ''}
                      </div>
                    </div>
                    <Badge status={st} />
                    <Button size="sm" variant="secondary" onClick={() => setUses(c)}>
                      Uses
                    </Button>
                    {st !== 'Expired' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canEdit}
                        busy={toggle.isPending && toggle.variables.coupon.id === c.id}
                        onClick={() => onToggle(c)}
                      >
                        {c.isActive ? 'Pause' : 'Resume'}
                      </Button>
                    )}
                    <IconBtn
                      name="pencil"
                      box={36}
                      size={15}
                      label={`Edit ${c.code}`}
                      title={`Edit ${c.code}`}
                      disabled={!canEdit}
                      onClick={() => setEditing({ coupon: c })}
                    />
                    <IconBtn
                      name="trash-2"
                      box={36}
                      size={15}
                      color="var(--color-d-600)"
                      label={`Delete ${c.code}`}
                      title={`Delete ${c.code}`}
                      disabled={!canDelete}
                      onClick={() => setDeleting(c)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <OpsCouponModal
        key={editKey}
        open={editing !== null}
        coupon={editing?.coupon ?? null}
        onClose={() => setEditing(null)}
        onSave={onSave}
      />
      <CouponUsesModal coupon={uses} onClose={() => setUses(null)} />
      <OpsConfirm
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        icon="trash-2"
        tone="danger"
        title="Delete this coupon?"
        body={
          deleting
            ? `${deleting.code} stops working straight away. Bookings that already used it keep their discount, and the hospitals keep Medibook's credit for them.`
            : ''
        }
        confirmLabel={remove.isPending ? 'Deleting…' : 'Delete Coupon'}
        confirmVariant="danger"
        busy={remove.isPending}
        onConfirm={onDelete}
      />
    </div>
  );
}
