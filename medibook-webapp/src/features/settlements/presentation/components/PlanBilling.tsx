import { useState } from 'react';

import { APOLLO_HID } from '@/core/config/demo';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { fmtDate, money } from '@/shared/lib/format';
import { required } from '@/shared/lib/validate';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Can } from '@/shared/ui/Can';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoDot } from '@/shared/ui/InfoDot';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import { useHospitalsStore } from '@/features/ops-hospitals/application/store/hospitals.store';
import { usePlansStore } from '@/features/ops-plans/application/store/plans.store';
import { useSettingsStore } from '@/features/settings/application/store/settings.store';
import {
  GST_LABEL,
  MEDIBOOK_GSTIN,
  nextInvoiceDate,
  SEED_PLAN_INVOICES,
} from '@/features/settlements/application/store/plan-billing';
import { useSettlementsStore } from '@/features/settlements/application/store/settlements.store';
import type { PlanInvoice } from '@/features/settlements/application/store/settlements.types';
import { InvoiceModal } from '@/features/settlements/presentation/components/InvoiceModal';

/**
 * Six headings for six cells. The row emits invoice id, date, plan, amount,
 * status and the invoice action — the Status heading used to be missing, which
 * put amount, status and the action under the wrong columns (audit 3.1.7).
 */
const INVOICE_COLUMNS = ['Invoice', 'Date', 'Plan', 'Amount', 'Status', ''] as const;

/** Quota bar turns red past this share of the monthly allowance. */
const QUOTA_ALERT_PCT = 85;

/** Online bookings used this month — see the note under the quota bar. */
const QUOTA_USED = 3120;

interface PlanChangeForm {
  to: string;
}

/** Module-level so `useForm`'s error memo stays stable across renders. */
const PLAN_CHANGE_VALIDATORS: FormValidators<PlanChangeForm> = {
  to: (v) => required(v, 'Requested plan'),
};

/**
 * Plan & Billing tab — the hospital's subscription hero card, quota bar,
 * plan invoices and request-plan-change flow. Mirrors the live ops plan
 * catalog + Apollo's registry record (one shared plan world).
 */
export function PlanBilling() {
  const hospitals = useHospitalsStore((s) => s.hospitals);
  const plans = usePlansStore((s) => s.plans);
  const settings = useSettingsStore((s) => s.settings);
  const req = useSettlementsStore((s) => s.planChangeReq);
  const requestPlanChange = useSettlementsStore((s) => s.requestPlanChange);

  const apolloRec = hospitals.find((h) => h.id === APOLLO_HID);
  const planName = apolloRec ? apolloRec.plan : 'Growth';
  const planDef = plans.find((p) => p.name === planName);
  const price = planDef ? planDef.price : 24999;
  const quotaTotal = planDef ? planDef.quota : 5000;
  const pct = Math.round((QUOTA_USED / quotaTotal) * 100);
  const planOptions = plans.map((p) => p.name).filter((n) => n !== planName);

  const [reqOpen, setReqOpen] = useState(false);
  const [invoice, setInvoice] = useState<PlanInvoice | null>(null);

  const form = useForm<PlanChangeForm>({
    initial: { to: '' },
    validate: PLAN_CHANGE_VALIDATORS,
    onSubmit: ({ to }) => {
      requestPlanChange(to);
      setReqOpen(false);
    },
  });

  const openRequest = (): void => {
    form.reset({ to: '' });
    setReqOpen(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <Card pad={0} className="overflow-hidden">
        <div className="bg-p-500 flex items-center justify-between p-6 text-white">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-h2 text-white">{planName} Plan</span>
              <span className="text-caption rounded-full bg-white/20 px-2.5 py-0.75">Active</span>
            </div>
            <div className="text-body mt-1 text-white/80">Billed monthly · managed by Medibook</div>
          </div>
          <div className="text-[26px] font-bold text-white tabular-nums">
            {money(price)}
            <span className="text-body font-normal text-white/70">/mo</span>
          </div>
        </div>
        <div className="flex gap-7 p-6">
          <div className="flex-1">
            <div className="mb-2.5 flex items-center gap-1.75">
              <span className="text-body text-text-strong font-medium">
                Online Bookings This Month
              </span>
              <InfoDot text="Each appointment booked through the Medibook patient app uses one booking from the monthly plan quota. Walk-ins booked at the desk do not count. The quota resets on the 1st." />
            </div>
            <div className="bg-grey-300 h-3 overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full rounded-full',
                  pct > QUOTA_ALERT_PCT ? 'bg-d-500' : 'bg-blue',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-body text-text-muted mt-2 flex justify-between">
              <span className="text-text-strong font-semibold tabular-nums">
                {QUOTA_USED.toLocaleString('en-IN')} used ({pct}%)
              </span>
              <span className="tabular-nums">of {quotaTotal.toLocaleString('en-IN')} / month</span>
            </div>
          </div>
          <div className="bg-border-soft w-px" />
          <div className="flex flex-1 flex-col justify-center gap-3.5">
            <div className="flex justify-between">
              <span className="text-body text-text-muted">Billing cycle</span>
              <span className="text-body text-text-strong font-medium">
                Monthly · invoiced on the 1st
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-text-muted">Next invoice</span>
              <span className="text-body text-text-strong font-medium">
                {fmtDate(nextInvoiceDate())}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-body text-text-muted">Status</span>
              <Badge status="Active" />
            </div>
          </div>
        </div>
        <div className="text-caption text-text-muted flex items-center gap-2 px-6 pb-5">
          <Icon name="info" size={15} className="text-blue" /> Plan tiers and pricing are managed by
          Medibook operations.
          <span className="flex-1" />
          {req ? (
            <span className="text-caption text-y-700 bg-y-100 rounded-full px-3 py-1.5">
              Change to {req.to} requested · pending Medibook review
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

      <Card pad={24}>
        <SectionTitle size={16} className="mb-1">
          Plan Invoices
        </SectionTitle>
        <div className="text-caption text-text-muted mb-4">
          Billed to GSTIN {settings.gstin || '—'} · Medibook GSTIN {MEDIBOOK_GSTIN} · {GST_LABEL}{' '}
          GST shown as a separate line on every invoice
        </div>
        <TableShell
          columns={INVOICE_COLUMNS}
          rightCols={['Amount']}
          scrollLabel="Plan invoices"
          state={
            SEED_PLAN_INVOICES.length === 0
              ? {
                  kind: 'empty',
                  icon: 'receipt',
                  title: 'No plan invoices yet.',
                  message: 'The first subscription invoice appears after your next billing date.',
                }
              : undefined
          }
        >
          {SEED_PLAN_INVOICES.map((r) => (
            <tr key={r.id}>
              <td className={cn(tdClass, 'text-blue font-medium')}>{r.id}</td>
              <td className={tdClass}>{fmtDate(r.date)}</td>
              <td className={tdClass}>{r.plan}</td>
              <td className={cn(tdClass, 'text-right font-semibold tabular-nums')}>
                {money(r.total)}
              </td>
              <td className={tdClass}>
                <Badge status={r.status} />
              </td>
              <td className={tdClass}>
                <IconBtn
                  name="download"
                  label="View invoice"
                  title={`View invoice ${r.id} — save as PDF or download CSV`}
                  box={34}
                  size={15}
                  onClick={() => setInvoice(r)}
                />
              </td>
            </tr>
          ))}
        </TableShell>
        <div className="text-caption text-text-muted mt-3">
          Open an invoice to save it as a PDF or download it as a CSV — each one shows the taxable
          value, {GST_LABEL} GST and the receipt number separately.
        </div>
      </Card>

      <FormModal
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        title="Request Plan Change"
        width={460}
        submitLabel="Send Request"
        busy={form.submitting}
        onSubmit={form.handleSubmit}
      >
        <p className="text-body-lg text-text-body m-0 mb-3.5">
          Current plan: <b>{planName}</b>.{' '}
          {"Medibook operations reviews and applies plan changes — you'll see the result here."}
        </p>
        <Field label="Requested Plan" required error={form.errorFor('to')}>
          <Select
            value={form.values.to}
            placeholder="Select a plan"
            options={planOptions}
            onChange={(v) => form.setField('to', v)}
            onBlur={() => form.blurField('to')}
          />
        </Field>
      </FormModal>

      {invoice && (
        <InvoiceModal
          invoice={invoice}
          hospitalName={settings.name}
          hospitalAddress={settings.address}
          hospitalGstin={settings.gstin}
          onClose={() => setInvoice(null)}
        />
      )}
    </div>
  );
}
