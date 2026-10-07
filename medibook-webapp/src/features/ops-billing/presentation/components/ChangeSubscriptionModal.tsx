import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';

import { Button } from '@/shared/ui/Button';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { Spinner } from '@/shared/ui/Spinner';
import { toast } from '@/shared/ui/toast/toast.store';

import { opsInvoiceDetailPath } from '@/app/router/paths';

import type {
  BillingPeriod,
  PlanChangeOutcome,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { useChangeSubscriptionMutation } from '@/features/ops-billing/application/queries/useChangeSubscriptionMutation';
import { useSubscriptionPreviewQuery } from '@/features/ops-billing/application/queries/useSubscriptionPreviewQuery';
import { useSubscriptionQuery } from '@/features/ops-billing/application/queries/useSubscriptionQuery';
import { rupees } from '@/features/ops-billing/presentation/components/billingView';
import { ProrationPreviewBox } from '@/features/ops-billing/presentation/components/ProrationPreviewBox';
import { usePlansQuery } from '@/features/ops-plans/application/queries/usePlansQuery';

const PERIOD_LABEL: Readonly<Record<BillingPeriod, string>> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const PERIODS: readonly BillingPeriod[] = ['monthly', 'yearly'];

interface ChangeSubscriptionModalProps {
  subscriptionId: string;
  hospitalName: string;
  onClose: () => void;
}

/**
 * Move one hospital to another plan or billing period (`PATCH
 * /platform/billing/subscriptions/{id}`, `billing.edit`, If-Match). The change
 * applies at once with proration (Q106): the proration preview (BE-28) shows
 * what will be issued before confirming, and the issued invoice or credit
 * note is shown — and linked — afterwards (10·R9, UAT-57).
 */
export function ChangeSubscriptionModal({
  subscriptionId,
  hospitalName,
  onClose,
}: ChangeSubscriptionModalProps) {
  const navigate = useNavigate();
  const subscription = useSubscriptionQuery(subscriptionId);
  const plans = usePlansQuery();
  const change = useChangeSubscriptionMutation();
  const [planId, setPlanId] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod | null>(null);
  const [outcome, setOutcome] = useState<PlanChangeOutcome | null>(null);

  const sub = subscription.data;
  const chosenPlanId = planId ?? sub?.planId ?? null;
  const chosenPeriod = period ?? sub?.billingPeriod ?? null;
  const isChanged =
    sub !== undefined &&
    ((chosenPlanId !== null && chosenPlanId !== sub.planId) ||
      (chosenPeriod !== null && chosenPeriod !== sub.billingPeriod));
  const preview = useSubscriptionPreviewQuery(
    subscriptionId,
    chosenPlanId,
    chosenPeriod,
    isChanged,
  );
  const activePlans = (plans.data ?? []).filter((p) => p.isActive || p.id === sub?.planId);

  const confirm = () => {
    if (!sub || !isChanged) return;
    change.mutate(
      {
        id: subscriptionId,
        version: sub.version,
        change: {
          ...(chosenPlanId !== sub.planId && chosenPlanId !== null && { planId: chosenPlanId }),
          ...(chosenPeriod !== sub.billingPeriod &&
            chosenPeriod !== null && { billingPeriod: chosenPeriod }),
        },
      },
      {
        onSuccess: (result) => {
          toast(`${hospitalName} moved to ${result.subscription.planName}.`, 'success');
          setOutcome(result.outcome);
        },
        onError: (failure) =>
          toast(isFailure(failure) ? failure.message : 'The plan was not changed.', 'error'),
      },
    );
  };

  if (outcome) {
    const doc = outcome.prorationInvoice ?? outcome.creditNote;
    return (
      <Modal
        open
        onClose={onClose}
        title="Plan changed"
        width={480}
        footer={
          <>
            {outcome.prorationInvoice && (
              <Button
                variant="secondary"
                icon="file-text"
                onClick={() => {
                  onClose();
                  navigate(opsInvoiceDetailPath(outcome.prorationInvoice?.id ?? ''));
                }}
              >
                Open invoice
              </Button>
            )}
            <Button onClick={onClose}>Done</Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <Icon name="circle-check" size={20} className="text-g-600 mt-0.5 flex-none" />
          <p className="text-body text-text-body m-0">
            {doc
              ? `${outcome.prorationInvoice ? 'Proration invoice' : 'Credit note'} ${doc.number} for ${rupees(doc.totalPaise)} was issued to ${hospitalName}.`
              : `Nothing was charged or credited to ${hospitalName}.`}
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Change ${hospitalName}'s plan`}
      width={560}
      onSubmit={confirm}
      submitLabel="Change plan now"
      busy={change.isPending}
      disabled={!isChanged || preview.isFetching}
    >
      {subscription.isPending || plans.isPending ? (
        <div className="text-text-muted flex justify-center py-6">
          <Spinner size={22} label="Loading the subscription" />
        </div>
      ) : subscription.isError || !sub ? (
        <div className="text-caption text-danger bg-d-100 rounded-md px-3 py-2.5">
          {isFailure(subscription.error)
            ? subscription.error.message
            : 'The subscription could not be loaded.'}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-caption text-text-muted m-0">
            Currently on {sub.planName}, billed {sub.billingPeriod}. The change applies today.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <OpsField label="Plan">
              <Select
                value={activePlans.find((p) => p.id === chosenPlanId)?.name ?? sub.planName}
                options={activePlans.map((p) => p.name)}
                onChange={(name) =>
                  setPlanId(activePlans.find((p) => p.name === name)?.id ?? chosenPlanId)
                }
              />
            </OpsField>
            <OpsField label="Billing period">
              <Select
                value={chosenPeriod ? PERIOD_LABEL[chosenPeriod] : ''}
                options={PERIODS.map((p) => PERIOD_LABEL[p])}
                onChange={(label) =>
                  setPeriod(PERIODS.find((p) => PERIOD_LABEL[p] === label) ?? chosenPeriod)
                }
              />
            </OpsField>
          </div>
          {isChanged && (
            <ProrationPreviewBox
              preview={preview.data}
              isLoading={preview.isPending}
              error={preview.error}
            />
          )}
        </div>
      )}
    </FormModal>
  );
}
