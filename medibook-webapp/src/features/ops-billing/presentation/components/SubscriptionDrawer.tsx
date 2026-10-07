import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { InfoGrid } from '@/shared/ui/InfoGrid';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { opsHospitalDetailPath } from '@/app/router/paths';

import type { BillingSubscription } from '@/features/ops-billing/domain/entities/billing.entities';
import { useChangeSubscriptionMutation } from '@/features/ops-billing/application/queries/useChangeSubscriptionMutation';
import {
  dateOf,
  subscriptionBadge,
} from '@/features/ops-billing/presentation/components/billingView';
import { ChangeSubscriptionModal } from '@/features/ops-billing/presentation/components/ChangeSubscriptionModal';

/** `SubscriptionUpdateSerializer.grace_days_override` bounds (Q103). */
const GRACE_MIN = 0;
const GRACE_MAX = 90;

function dateCopy(iso: string | null): string {
  return iso ? fmtDate(dateOf(iso)) : '—';
}

interface SubscriptionDrawerProps {
  subscription: BillingSubscription;
  onClose: () => void;
}

/**
 * One hospital's subscription (11·R1, R6): plan, status (incl. D-30
 * read-only), period and next invoice; a plan / period change with proration
 * and the per-hospital grace override, both `billing.edit`.
 */
export function SubscriptionDrawer({ subscription: s, onClose }: SubscriptionDrawerProps) {
  const navigate = useNavigate();
  const canEdit = useOpsPermission().can('billing.edit');
  const change = useChangeSubscriptionMutation();
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [grace, setGrace] = useState(
    s.graceDaysOverride === null ? '' : String(s.graceDaysOverride),
  );
  const [graceError, setGraceError] = useState<string | null>(null);
  const badge = subscriptionBadge(s.status);
  const hospitalName = s.hospitalName ?? 'This hospital';
  const isCancelled = s.status === 'cancelled';

  const saveGrace = () => {
    const raw = grace.trim();
    const days = raw === '' ? null : Number(raw);
    if (days !== null && (!Number.isInteger(days) || days < GRACE_MIN || days > GRACE_MAX)) {
      setGraceError(`Enter whole days from ${GRACE_MIN} to ${GRACE_MAX}, or leave empty.`);
      return;
    }
    setGraceError(null);
    change.mutate(
      { id: s.id, change: { graceDaysOverride: days }, version: s.version },
      {
        onSuccess: () =>
          toast(
            days === null
              ? `${hospitalName} uses the platform's grace period again.`
              : `${hospitalName} gets ${days} grace days.`,
            'success',
          ),
        onError: (failure) => {
          const field = isFailure(failure) ? failure.fieldErrors.grace_days_override : undefined;
          if (field) setGraceError(field.join(' '));
          else
            toast(
              isFailure(failure) ? failure.message : 'The grace period was not saved.',
              'error',
            );
        },
      },
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={hospitalName}
      subtitle={`${s.planName} · billed ${s.billingPeriod}`}
      width={520}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => navigate(opsHospitalDetailPath(s.hospitalId))}>
            Open hospital
          </Button>
          {canEdit && !isCancelled && (
            <Button icon="layers" onClick={() => setIsChangingPlan(true)}>
              Change plan
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Badge status={badge.status}>{badge.label}</Badge>
          {s.readOnly && (
            <span className="text-caption text-text-muted">
              Writes are refused until the overdue invoice is paid (D-30).
            </span>
          )}
        </div>
        <InfoGrid
          items={[
            { k: 'Plan', v: s.planName },
            { k: 'Billing period', v: s.billingPeriod },
            { k: 'Started', v: dateCopy(s.startedAt) },
            { k: 'Trial ends', v: dateCopy(s.trialEndsAt) },
            { k: 'Current period ends', v: dateCopy(s.currentPeriodEnd) },
            { k: 'Next invoice', v: dateCopy(s.nextInvoiceAt) },
            {
              k: 'Grace period',
              v: s.graceDaysOverride === null ? 'Platform default' : `${s.graceDaysOverride} days`,
            },
            { k: 'Cancels at period end', v: s.cancelAtPeriodEnd ? 'Yes' : 'No' },
          ]}
        />
        {canEdit && !isCancelled && (
          <section className="flex flex-col gap-3">
            <SectionTitle>Grace override</SectionTitle>
            <p className="text-caption text-text-muted m-0">
              Days an unpaid invoice may stay unpaid before the hospital becomes read-only. Leave
              empty to use the platform default.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <OpsField label="Grace days" error={graceError}>
                  <TextInput
                    value={grace}
                    onChange={setGrace}
                    inputMode="numeric"
                    placeholder="Default"
                    height={44}
                  />
                </OpsField>
              </div>
              <Button
                variant="secondary"
                busy={change.isPending}
                disabled={
                  grace.trim() === (s.graceDaysOverride === null ? '' : String(s.graceDaysOverride))
                }
                onClick={saveGrace}
              >
                Save grace
              </Button>
            </div>
          </section>
        )}
      </div>
      {isChangingPlan && (
        <ChangeSubscriptionModal
          subscriptionId={s.id}
          hospitalName={hospitalName}
          onClose={() => setIsChangingPlan(false)}
        />
      )}
    </Drawer>
  );
}
