import { useState } from 'react';

import { isFailure } from '@/core/error/failure';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { usePermission } from '@/shared/hooks/usePermission';
import { cn } from '@/shared/lib/cn';
import { fmtDate, todayISO } from '@/shared/lib/format';
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
import { useCreditNotesQuery } from '@/features/settlements/application/queries/useCreditNotesQuery';
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
  CYCLE_LABEL,
  graceNotice,
  planChoices,
  UNPAID_INVOICE_STATUSES,
} from '@/features/settlements/presentation/components/planBillingView';
import {
  billingPeriodLabel,
  bpToPct,
  fmtDateTime,
  invoiceStatus,
  periodLabel,
  rupees,
  subscriptionStatus,
  USAGE_LABELS,
  usagePct,
  usageValue,
} from '@/features/settlements/presentation/components/settlementsFormat';

const INVOICE_COLUMNS = ['Invoice', 'Period', 'Issued', 'Due', 'Amount', 'Status', ''] as const;

const CREDIT_NOTE_COLUMNS = ['Credit Note', 'Issued', 'Reason', 'Total', 'Used', 'Left'] as const;

/** Decided plan-change outcomes, and how the hospital is told about each. */
const DECIDED_COPY: Readonly<Record<string, string>> = {
  applied: 'was approved and applied',
  approved: 'was approved',
  rejected: 'was declined',
  withdrawn: 'was withdrawn',
};
const INVOICE_PAGE_SIZE = 10;

/** Usage bar turns red past this share of the plan limit. */
const QUOTA_ALERT_PCT = 85;

/** Backend 404 code when the hospital has no current subscription. */
const NOT_FOUND_KIND = 'notFound';

/** Billing-cycle label → value, for the cycle select. */
const PERIOD_VALUE: Readonly<Record<string, BillingPeriod>> = {
  [CYCLE_LABEL.monthly]: 'monthly',
  [CYCLE_LABEL.yearly]: 'yearly',
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
 * subscription invoices, credit notes and the request-plan-change flow.
 * Medibook operations review plan changes; the pending request shows here
 * until they do. An approved change applies at once with proration (Q106).
 * A past-due subscription says how long full access lasts, and a lapsed one
 * what read-only means (D-30, appendix 09 F5/F6).
 */
export function PlanBilling() {
  const { can } = usePermission();
  const canEdit = can('Billing & Settlements.edit');

  const subscriptionQuery = useSubscriptionQuery();
  const usageQuery = useBillingUsageQuery();
  const [invoicePage, setInvoicePage] = useState(0);
  const invoicesQuery = useInvoicesQuery(invoicePage + 1, INVOICE_PAGE_SIZE);
  // The newest invoices, whatever page the table is on — the source of the
  // "payment due" banner.
  const latestInvoicesQuery = useInvoicesQuery(1, INVOICE_PAGE_SIZE);
  // The hospital route stays on `billing_settlements.edit` (only the ops list moved to view).
  const requestsQuery = usePlanChangeRequestsQuery(canEdit);
  const requestMutation = useRequestPlanChangeMutation();
  const creditNotesQuery = useCreditNotesQuery();

  const [reqOpen, setReqOpen] = useState(false);
  const [invoice, setInvoice] = useState<BillingInvoice | null>(null);

  const pendingRequest = requestsQuery.data?.find((r) => r.status === 'requested') ?? null;
  // Once Medibook has decided, the latest outcome (and its note) is shown
  // until the hospital raises a new request.
  const latestDecided = pendingRequest
    ? null
    : ([...(requestsQuery.data ?? [])]
        .filter((r) => DECIDED_COPY[r.status] !== undefined)
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0] ?? null);
  const plansQuery = useBillingPlansQuery(
    reqOpen || pendingRequest !== null || latestDecided !== null,
  );
  const plans = plansQuery.data ?? [];

  const sub = subscriptionQuery.data;
  const choices = planChoices(plans, sub ?? null);
  const planNameOf = (planId: string, fromRow: string | null): string | undefined =>
    fromRow ?? plans.find((p) => p.id === planId)?.name;
  const pendingPlanName =
    pendingRequest && planNameOf(pendingRequest.toPlanId, pendingRequest.toPlanName);
  const decidedPlanName =
    latestDecided && planNameOf(latestDecided.toPlanId, latestDecided.toPlanName);
  const today = todayISO();
  const latestInvoices = latestInvoicesQuery.data?.items ?? [];
  const dueInvoices = latestInvoices.filter(
    (i) => UNPAID_INVOICE_STATUSES.has(i.status) && i.dueAt <= today,
  );
  const grace = sub ? graceNotice(sub, latestInvoices, today) : null;

  const form = useForm<PlanChangeForm>({
    initial: { plan: '', period: '', note: '' },
    validate: PLAN_CHANGE_VALIDATORS,
    onSubmit: async ({ plan, period, note }) => {
      const target = choices.find((c) => c.label === plan);
      const toBillingPeriod = PERIOD_VALUE[period];
      if (!target || !toBillingPeriod || !target.cycles.includes(toBillingPeriod)) return;
      try {
        await requestMutation.mutateAsync({
          toPlanId: target.plan.id,
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

  const selectedChoice = choices.find((c) => c.label === form.values.plan);
  const selectedPlan = selectedChoice?.plan;
  const periodOptions = (selectedChoice?.cycles ?? []).map((c) => CYCLE_LABEL[c]);

  const openRequest = (): void => {
    form.reset({ plan: '', period: '', note: '' });
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
              <span className="text-body font-normal text-white/70">
                {price.suffix} + {bpToPct(sub.plan.gstRateBp)} GST
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-3.5 p-6">
            {dueInvoices.length > 0 && (
              <div className="text-body text-d-700 bg-d-100 flex flex-wrap items-center gap-2 rounded-md px-3.5 py-2.5">
                <Icon name="triangle-alert" size={16} />
                <span className="flex-1">
                  Payment due to Medibook:{' '}
                  {dueInvoices
                    .map(
                      (i) =>
                        `${i.invoiceNo} · ${rupees(i.totalPaise - i.amountPaidPaise)} (due ${fmtDate(i.dueAt)})`,
                    )
                    .join('; ')}
                </span>
                {dueInvoices[0] && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="receipt"
                    onClick={() => setInvoice(dueInvoices[0] ?? null)}
                  >
                    View invoice
                  </Button>
                )}
              </div>
            )}
            {sub.readOnly && (
              <div className="text-body text-d-700 bg-d-100 flex items-start gap-2 rounded-md px-3.5 py-2.5">
                <Icon name="triangle-alert" size={16} className="mt-0.5 flex-none" />
                <span>
                  <b className="font-semibold">
                    Your subscription has lapsed, so the hospital is read-only.
                  </b>{' '}
                  Staff can still sign in and see everything, but nothing can be added or changed —
                  bookings, payments, patients and settings are all refused — and patients cannot
                  book this hospital in the Medibook app. Full access returns as soon as Medibook
                  records the payment of the outstanding invoice.
                </span>
              </div>
            )}
            {!sub.readOnly && grace && (
              <div className="text-body text-y-700 bg-y-100 flex items-start gap-2 rounded-md px-3.5 py-2.5">
                <Icon name="clock" size={16} className="mt-0.5 flex-none" />
                <span>
                  Invoice {grace.invoice.invoiceNo} is overdue. Pay it by{' '}
                  <b className="font-semibold">{fmtDate(grace.endsOn)}</b> to keep full access;
                  after that the hospital becomes read-only until it is paid. Signing in is never
                  blocked.
                </span>
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
              <>
                {latestDecided && (
                  <span
                    className={cn(
                      'text-caption rounded-full px-3 py-1.5',
                      latestDecided.status === 'rejected'
                        ? 'text-d-700 bg-d-100'
                        : 'text-g-700 bg-g-100',
                    )}
                  >
                    Your request to change to {decidedPlanName ?? 'a new plan'} (
                    {billingPeriodLabel(latestDecided.toBillingPeriod).toLowerCase()}){' '}
                    {DECIDED_COPY[latestDecided.status]}
                    {latestDecided.reviewNote ? ` — “${latestDecided.reviewNote}”` : ''}
                  </span>
                )}
                <Can perm="Billing & Settlements.edit">
                  <Button size="sm" variant="secondary" icon="send" onClick={openRequest}>
                    Request Plan Change
                  </Button>
                </Can>
              </>
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
  const creditNotes = creditNotesQuery.data ?? [];
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
                <td
                  className={cn(
                    tdClass,
                    UNPAID_INVOICE_STATUSES.has(r.status) && r.dueAt <= today && 'text-d-700',
                  )}
                >
                  {fmtDate(r.dueAt)}
                </td>
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

      {creditNotes.length > 0 && (
        <Card pad={24}>
          <SectionTitle size={16} className="mb-1">
            Credit Notes
          </SectionTitle>
          <div className="text-caption text-text-muted mb-4">
            Issued when a plan change leaves unused credit. The credit settles unpaid invoices
            first, oldest due first; anything left settles your next invoices.
          </div>
          <TableShell
            columns={CREDIT_NOTE_COLUMNS}
            rightCols={['Total', 'Used', 'Left']}
            scrollLabel="Credit notes"
          >
            {creditNotes.map((n) => (
              <tr key={n.id}>
                <td className={cn(tdClass, 'text-text-strong font-medium')}>{n.creditNoteNo}</td>
                <td className={tdClass}>{fmtDateTime(n.issuedAt)}</td>
                <td className={tdClass}>{n.reason ?? '—'}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>
                  {rupees(n.totalPaise)}
                  <div className="text-caption text-text-muted">incl. {rupees(n.gstPaise)} GST</div>
                </td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{rupees(n.appliedPaise)}</td>
                <td
                  className={cn(tdClass, 'text-text-strong text-right font-semibold tabular-nums')}
                >
                  {rupees(n.remainingPaise)}
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>
      )}

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
          Current plan: <b>{sub?.plan.name ?? '—'}</b>
          {sub ? ` (${billingPeriodLabel(sub.billingPeriod).toLowerCase()})` : ''}.{' '}
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
                options={choices.map((c) => c.label)}
                onChange={(v) => {
                  const first = choices.find((c) => c.label === v)?.cycles[0];
                  form.setValues({ plan: v, period: first ? CYCLE_LABEL[first] : '' });
                }}
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
                placeholder="Select a plan first"
                options={periodOptions}
                onChange={(v) => form.setField('period', v)}
                onBlur={() => form.blurField('period')}
                disabled={!selectedChoice}
              />
            </Field>
            {selectedChoice?.isCurrent && (
              <div className="text-caption text-text-muted">
                Same plan, new billing cycle — only the cycle changes.
              </div>
            )}
            <div className="text-caption text-text-body bg-bg-subtle border-border-soft flex items-start gap-2 rounded-md border px-3 py-2.5">
              <Icon name="info" size={14} className="text-blue mt-0.5 flex-none" />
              <span>
                Once Medibook approves, the change applies straight away with proration: you are
                credited for the unused part of the current period and charged for the new plan from
                that day. An upgrade is billed on one invoice; a downgrade issues a credit note,
                which first settles any unpaid invoices.
              </span>
            </div>
            <Field label="Note for Medibook (optional)">
              {(field) => (
                <textarea
                  id={field.id}
                  value={form.values.note}
                  maxLength={NOTE_MAX_LENGTH}
                  onChange={(e) => form.setField('note', e.target.value)}
                  placeholder="e.g. We are adding three doctors next month"
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
