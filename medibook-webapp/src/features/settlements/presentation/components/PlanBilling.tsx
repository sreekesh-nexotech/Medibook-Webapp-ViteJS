import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { usePermission } from '@/shared/hooks/usePermission';
import { cn } from '@/shared/lib/cn';
import { required } from '@/shared/lib/validate';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Pager } from '@/shared/ui/Pager';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { SkeletonCards } from '@/shared/ui/Skeleton';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { toast } from '@/shared/ui/toast/toast.store';

import { useBillingPlansQuery } from '@/features/settlements/application/queries/useBillingPlansQuery';
import { useBillingUsageQuery } from '@/features/settlements/application/queries/useBillingUsageQuery';
import { useInvoicesQuery } from '@/features/settlements/application/queries/useInvoicesQuery';
import { usePlanChangeRequestsQuery } from '@/features/settlements/application/queries/usePlanChangeRequestsQuery';
import { useRequestPlanChangeMutation } from '@/features/settlements/application/queries/useRequestPlanChangeMutation';
import { useSubscriptionQuery } from '@/features/settlements/application/queries/useSubscriptionQuery';
import type {
  BillingInvoice,
  BillingPeriod,
  BillingPlan,
} from '@/features/settlements/domain/entities/billing.entities';
import { InvoiceModal } from '@/features/settlements/presentation/components/InvoiceModal';
import {
  billingPeriodLabel,
  fmtDateTime,
  invoiceStatus,
  periodLabel,
  rupees,
  subscriptionStatus,
  USAGE_LABELS,
  usagePct,
  usageValue,
} from '@/features/settlements/presentation/components/settlementsFormat';

const INVOICE_COLUMNS = ['Invoice', 'Period', 'Issued', 'Amount', 'Status', ''] as const;
const INVOICE_PAGE_SIZE = 10;

/** Usage bar turns red past this share of the plan limit. */
const QUOTA_ALERT_PCT = 85;

/** Backend 404 code when the hospital has no current subscription. */
const NOT_FOUND_KIND = 'notFound';

const PERIOD_MONTHLY = 'Monthly';
const PERIOD_YEARLY = 'Yearly';
const PERIOD_VALUE: Readonly<Record<string, BillingPeriod>> = {
  [PERIOD_MONTHLY]: 'monthly',
  [PERIOD_YEARLY]: 'yearly',
};

const NOTE_MAX_LENGTH = 2000;

interface PlanChangeForm {
  plan: string;
  period: string;
  note: string;
}

/** Module-level so `useForm`'s error memo stays stable across renders. */
const PLAN_CHANGE_VALIDATORS: FormValidators<PlanChangeForm> = {
  plan: (v) => required(v, 'Requested plan'),
  period: (v) => required(v, 'Billing cycle'),
};

/** The price a plan is billed at for `period`, with its suffix. */
function priceFor(plan: BillingPlan, period: string): { paise: number; suffix: string } {
  if (period === 'yearly' && plan.priceYearlyPaise !== null) {
    return { paise: plan.priceYearlyPaise, suffix: '/yr' };
  }
  return { paise: plan.priceMonthlyPaise, suffix: '/mo' };
}

/**
 * Plan & Billing tab — the hospital's Medibook subscription
 * (`/hospital/billing/*`): current plan, usage against plan limits, the
 * subscription invoices and the request-plan-change flow. Medibook operations
 * review plan changes; the pending request shows here until they do.
 */
export function PlanBilling() {
  const { can } = usePermission();
  const canEdit = can('Billing & Settlements.edit');

  const subscriptionQuery = useSubscriptionQuery();
  const usageQuery = useBillingUsageQuery();
  const [invoicePage, setInvoicePage] = useState(0);
  const invoicesQuery = useInvoicesQuery(invoicePage + 1, INVOICE_PAGE_SIZE);
  const requestsQuery = usePlanChangeRequestsQuery(canEdit);
  const requestMutation = useRequestPlanChangeMutation();

  const [reqOpen, setReqOpen] = useState(false);
  const [invoice, setInvoice] = useState<BillingInvoice | null>(null);

  const pendingRequest = requestsQuery.data?.find((r) => r.status === 'requested') ?? null;
  const plansQuery = useBillingPlansQuery(reqOpen || pendingRequest !== null);
  const plans = plansQuery.data ?? [];

  const sub = subscriptionQuery.data;
  const planOptions = plans.filter((p) => p.id !== sub?.plan.id);
  const pendingPlanName =
    pendingRequest && plans.find((p) => p.id === pendingRequest.toPlanId)?.name;

  const form = useForm<PlanChangeForm>({
    initial: { plan: '', period: PERIOD_MONTHLY, note: '' },
    validate: PLAN_CHANGE_VALIDATORS,
    onSubmit: async ({ plan, period, note }) => {
      const target = planOptions.find((p) => p.name === plan);
      const toBillingPeriod = PERIOD_VALUE[period];
      if (!target || !toBillingPeriod) return;
      try {
        await requestMutation.mutateAsync({
          toPlanId: target.id,
          toBillingPeriod,
          note: note.trim() || null,
        });
        toast('Plan change request sent to Medibook', 'success');
        setReqOpen(false);
      } catch (failure) {
        toast(
          isFailure(failure) ? failure.message : 'Could not send the plan change request.',
          'error',
        );
      }
    },
  });

  const selectedPlan = planOptions.find((p) => p.name === form.values.plan);
  const periodOptions =
    selectedPlan && selectedPlan.priceYearlyPaise === null
      ? [PERIOD_MONTHLY]
      : [PERIOD_MONTHLY, PERIOD_YEARLY];

  const openRequest = (): void => {
    form.reset({ plan: '', period: PERIOD_MONTHLY, note: '' });
    setReqOpen(true);
  };

  const subscriptionCard = subscriptionQuery.isPending ? (
    <SkeletonCards count={1} lines={4} />
  ) : subscriptionQuery.isError ? (
    isFailure(subscriptionQuery.error) && subscriptionQuery.error.kind === NOT_FOUND_KIND ? (
      <Card>
        <EmptyState
          icon="receipt"
          title="No active subscription"
          message="This hospital has no Medibook subscription yet. Medibook operations set it up during onboarding."
        />
      </Card>
    ) : (
      <Card>
        <ErrorState
          inline
          title="Your plan didn't load"
          message={isFailure(subscriptionQuery.error) ? subscriptionQuery.error.message : undefined}
          onRetry={() => void subscriptionQuery.refetch()}
        />
      </Card>
    )
  ) : sub ? (
    (() => {
      const price = priceFor(sub.plan, sub.billingPeriod);
      const status = subscriptionStatus(sub.status);
      return (
        <Card pad={0} className="overflow-hidden">
          <div className="bg-p-500 flex flex-wrap items-center justify-between gap-3 p-6 text-white">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-h2 text-white">{sub.plan.name} Plan</span>
                <span className="text-caption rounded-full bg-white/20 px-2.5 py-0.75">
                  {status.label}
                </span>
              </div>
              <div className="text-body mt-1 text-white/80">
                Billed {billingPeriodLabel(sub.billingPeriod).toLowerCase()} · managed by Medibook
              </div>
            </div>
            <div className="text-h1 font-bold text-white tabular-nums">
              {rupees(price.paise)}
              <span className="text-body font-normal text-white/70">{price.suffix}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3.5 p-6">
            {sub.readOnly && (
              <div className="text-body text-d-700 bg-d-100 flex items-center gap-2 rounded-md px-3.5 py-2.5">
                <Icon name="triangle-alert" size={16} /> Your subscription has lapsed. The app is
                read-only until the outstanding invoice is paid.
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-body text-text-muted">Billing cycle</span>
              <span className="text-body text-text-strong font-medium">
                {billingPeriodLabel(sub.billingPeriod)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-text-muted">Current period</span>
              <span className="text-body text-text-strong font-medium">
                {fmtDateTime(sub.currentPeriodStart)} – {fmtDateTime(sub.currentPeriodEnd)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-text-muted">Next invoice</span>
              <span className="text-body text-text-strong font-medium">
                {sub.cancelAtPeriodEnd ? 'Ends this period' : fmtDateTime(sub.nextInvoiceAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-text-muted">Status</span>
              <Badge status={status.badge}>{status.label}</Badge>
            </div>
          </div>
          <div className="text-caption text-text-muted flex flex-wrap items-center gap-2 px-6 pb-5">
            <Icon name="info" size={15} className="text-blue" /> Plan tiers and pricing are managed
            by Medibook operations.
            <span className="flex-1" />
            {pendingRequest ? (
              <span className="text-caption text-y-700 bg-y-100 rounded-full px-3 py-1.5">
                Change to {pendingPlanName ?? 'a new plan'} (
                {billingPeriodLabel(pendingRequest.toBillingPeriod).toLowerCase()}) requested ·
                pending Medibook review
              </span>
            ) : (
              <Can perm="Billing & Settlements.edit">
                <Button size="sm" variant="secondary" icon="send" onClick={openRequest}>
                  Request Plan Change
                </Button>
              </Can>
            )}
          </div>
        </Card>
      );
    })()
  ) : null;

  const usageCard = (
    <Card pad={24}>
      <div className="mb-4 flex items-center gap-1.75">
        <SectionTitle size={16}>Usage This Period</SectionTitle>
        <InfoDot text="What your plan allows against what you use today. A hard limit stops new records being added past the cap; a soft limit only warns. Unlimited metrics have no bar." />
      </div>
      {usageQuery.isPending ? (
        <SkeletonCards count={1} lines={3} />
      ) : usageQuery.isError ? (
        <ErrorState
          inline
          title="Usage didn't load"
          message={isFailure(usageQuery.error) ? usageQuery.error.message : undefined}
          onRetry={() => void usageQuery.refetch()}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {usageQuery.data.meters.map((m) => {
            const pct = usagePct(m.current, m.limit);
            return (
              <div key={m.metric}>
                <div className="text-body text-text-strong mb-2 flex items-center justify-between font-medium">
                  {USAGE_LABELS[m.metric]}
                  {m.hard && m.limit !== null && (
                    <span className="text-caption text-text-muted font-normal">hard limit</span>
                  )}
                </div>
                {pct !== null && (
                  <div className="bg-grey-300 h-3 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        pct > QUOTA_ALERT_PCT ? 'bg-d-500' : 'bg-blue',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                <div className="text-body text-text-muted mt-2 flex justify-between">
                  <span className="text-text-strong font-semibold tabular-nums">
                    {usageValue(m.metric, m.current)} used{pct !== null ? ` (${pct}%)` : ''}
                  </span>
                  <span className="tabular-nums">
                    {m.limit === null ? 'Unlimited' : `of ${usageValue(m.metric, m.limit)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  const invoices = invoicesQuery.data?.items ?? [];
  const invoiceState: TableStateSpec | undefined = invoicesQuery.isPending
    ? { kind: 'loading', rows: 3 }
    : invoicesQuery.isError
      ? {
          kind: 'error',
          message: isFailure(invoicesQuery.error) ? invoicesQuery.error.message : undefined,
          onRetry: () => void invoicesQuery.refetch(),
        }
      : invoices.length === 0
        ? {
            kind: 'empty',
            icon: 'receipt',
            title: 'No plan invoices yet.',
            message: 'The first subscription invoice appears after your next billing date.',
          }
        : undefined;

  return (
    <div className="flex flex-col gap-5">
      {subscriptionCard}
      {usageCard}

      <Card pad={24}>
        <SectionTitle size={16} className="mb-1">
          Plan Invoices
        </SectionTitle>
        <div className="text-caption text-text-muted mb-4">
          Every invoice shows the taxable value and GST as separate lines, with both GSTINs as they
          stood when it was issued.
        </div>
        <TableShell
          columns={INVOICE_COLUMNS}
          rightCols={['Amount']}
          scrollLabel="Plan invoices"
          state={invoiceState}
        >
          {invoices.map((r) => {
            const status = invoiceStatus(r.status);
            return (
              <tr key={r.id}>
                <td className={cn(tdClass, 'text-blue font-medium')}>{r.invoiceNo}</td>
                <td className={tdClass}>{periodLabel(r.periodStart, r.periodEnd)}</td>
                <td className={tdClass}>{fmtDateTime(r.issuedAt)}</td>
                <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>
                  {rupees(r.totalPaise)}
                </td>
                <td className={tdClass}>
                  <Badge status={status.badge}>{status.label}</Badge>
                </td>
                <td className={tdClass}>
                  <IconBtn
                    name="download"
                    label="View invoice"
                    title={`View invoice ${r.invoiceNo} — download the PDF or CSV`}
                    box={34}
                    size={15}
                    onClick={() => setInvoice(r)}
                  />
                </td>
              </tr>
            );
          })}
        </TableShell>
        <Pager
          total={invoicesQuery.data?.total ?? 0}
          page={invoicePage}
          pageSize={INVOICE_PAGE_SIZE}
          onPage={setInvoicePage}
          noun="invoices"
        />
      </Card>

      <FormModal
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        title="Request Plan Change"
        width={460}
        submitLabel="Send Request"
        busy={form.submitting || requestMutation.isPending}
        disabled={plansQuery.isPending || plansQuery.isError}
        onSubmit={form.handleSubmit}
      >
        <p className="text-body-lg text-text-body m-0 mb-3.5">
          Current plan: <b>{sub?.plan.name ?? '—'}</b>.{' '}
          {"Medibook operations reviews and applies plan changes — you'll see the result here."}
        </p>
        {plansQuery.isError ? (
          <ErrorState
            inline
            title="Plans didn't load"
            message={isFailure(plansQuery.error) ? plansQuery.error.message : undefined}
            onRetry={() => void plansQuery.refetch()}
          />
        ) : (
          <div className="flex flex-col gap-3.5">
            <Field label="Requested Plan" required error={form.errorFor('plan')}>
              <Select
                value={form.values.plan}
                placeholder={plansQuery.isPending ? 'Loading plans…' : 'Select a plan'}
                options={planOptions.map((p) => p.name)}
                onChange={(v) => form.setValues({ plan: v, period: PERIOD_MONTHLY })}
                onBlur={() => form.blurField('plan')}
                disabled={plansQuery.isPending}
              />
            </Field>
            {selectedPlan && (
              <div className="text-caption text-text-muted">
                {rupees(selectedPlan.priceMonthlyPaise)}/mo
                {selectedPlan.priceYearlyPaise !== null &&
                  ` · ${rupees(selectedPlan.priceYearlyPaise)}/yr`}{' '}
                + GST
              </div>
            )}
            <Field label="Billing Cycle" required error={form.errorFor('period')}>
              <Select
                value={form.values.period}
                options={periodOptions}
                onChange={(v) => form.setField('period', v)}
                onBlur={() => form.blurField('period')}
              />
            </Field>
            <Field label="Note for Medibook (optional)">
              {(field) => (
                <textarea
                  id={field.id}
                  value={form.values.note}
                  maxLength={NOTE_MAX_LENGTH}
                  onChange={(e) => form.setField('note', e.target.value)}
                  placeholder="e.g. We are adding a second branch next month"
                  className="border-border rounded-input text-body-lg text-text-strong h-18 w-full resize-none border p-3"
                />
              )}
            </Field>
          </div>
        )}
      </FormModal>

      {invoice && (
        <InvoiceModal
          invoiceId={invoice.id}
          invoiceNo={invoice.invoiceNo}
          onClose={() => setInvoice(null)}
        />
      )}
    </div>
  );
}
