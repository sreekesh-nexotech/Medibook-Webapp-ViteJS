import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { usePrintArea } from '@/shared/hooks/usePrintArea';
import { type SortAccessors, useSort } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { money, moneyShort } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { IconBtn } from '@/shared/ui/IconBtn';
import { KpiStrip } from '@/shared/ui/KpiStrip';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { Pager } from '@/shared/ui/Pager';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import type { StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';
import { Tabs } from '@/shared/ui/Tabs';
import { toast } from '@/shared/ui/toast/toast.store';

import { OPS_BASE_PATH, OPS_VIEW_SEGMENT } from '@/app/router/paths';

import {
  hospName,
  useHospitalsStore,
} from '@/features/ops-hospitals/application/store/hospitals.store';
import { isoFromLongDate } from '@/features/ops-hospitals/application/store/opsDates';

import { invoiceTax, isUnpaid } from '@/features/ops-billing/application/store/billing.derive';
import {
  billingTodayIso,
  useBillingStore,
} from '@/features/ops-billing/application/store/billing.store';
import type { Invoice, Payment } from '@/features/ops-billing/application/store/billing.types';
import { InvoicePrintSheet } from '@/features/ops-billing/presentation/components/InvoicePrintSheet';
import { SendReminderModal } from '@/features/ops-billing/presentation/components/SendReminderModal';

/** Rows per page for both billing tables (design `OPS_BILL_PAGE`). */
const OPS_BILL_PAGE = 6;

/** Attempts a gateway payment gets before ops has to collect it manually. */
const MAX_PAYMENT_ATTEMPTS = 3;

/** The billing period a subscription invoice covers (design copy). */
const INVOICE_PERIOD = 'June 01 – June 30, 2026';

type BillTab = 'Invoices' | 'Payments';

const INVOICE_COLUMNS = ['Invoice', 'Amount', 'Issued', 'Due', 'Status', 'Action'] as const;
const PAYMENT_COLUMNS = [
  'Transaction',
  'Invoice',
  'Method',
  'Amount',
  'Date',
  'Status',
  'Action',
] as const;

const isInvoice = (v: Invoice | Payment): v is Invoice => 'no' in v;
const isPayment = (v: Invoice | Payment): v is Payment => 'txn' in v;

/**
 * Ops subscription billing (design `Ops.jsx` `OpsBilling`): KPI row, the
 * Invoices | Payments tabs (preset through the `?tab=` search param), search +
 * issued/paid date range + method / status filters, sortable columns and
 * pagination.
 *
 * Three audit fixes live here. Refresh re-reads the billing snapshot and holds
 * the table's loading state for as long as that takes (3.1.1) — it used to do
 * nothing at all. The row actions are named for what they do (3.3.2). And the
 * old "Download PDF" glyph, which fired a success toast for a file that never
 * arrived (3.1.4), is now **Save invoice as PDF**: it prints the real invoice
 * document through the browser's print dialog, with a genuine CSV export for
 * the filtered list beside it.
 */
export function OpsBillingScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const allInvoices = useBillingStore((s) => s.invoices);
  const allPayments = useBillingStore((s) => s.payments);
  const syncedAt = useBillingStore((s) => s.syncedAt);
  const resync = useBillingStore((s) => s.resync);
  const retryPayment = useBillingStore((s) => s.retryPayment);
  const hospitals = useHospitalsStore((s) => s.hospitals);

  const initialTab: BillTab = searchParams.get('tab') === 'Payments' ? 'Payments' : 'Invoices';
  const [tab, setTabRaw] = useState<BillTab>(initialTab);
  const setTab = (t: BillTab) => {
    setTabRaw(t);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', t);
        return next;
      },
      { replace: true },
    );
  };

  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('All');
  const [methodF, setMethodF] = useState('All');
  const [dateF, setDateF] = useState('');
  const [dateT, setDateT] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reminderFor, setReminderFor] = useState<Invoice | null>(null);
  const [busy, run] = useOpsAct();

  /**
   * Save-as-PDF target. Held with a sequence number so clicking the same row
   * twice starts a second print job — the effect below is what opens the
   * dialog, once the sheet for that invoice is actually in the DOM.
   */
  const [printJob, setPrintJob] = useState<{ invoice: Invoice; seq: number } | null>(null);
  const { ref: printRef, print } = usePrintArea<HTMLDivElement>();
  useEffect(() => {
    if (printJob) print();
  }, [printJob, print]);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await resync();
    } finally {
      setLoading(false);
    }
  }, [resync]);

  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };

  const clearAll = (): void => {
    setQ('');
    setStatusF('All');
    setMethodF('All');
    setDateF('');
    setDateT('');
    setPage(0);
  };

  const ql = q.trim().toLowerCase();
  const inRange = (dstr: string): boolean => {
    const ts = Date.parse(dstr) || 0;
    if (dateF && ts < Date.parse(dateF)) return false;
    if (dateT && ts > Date.parse(dateT) + 86399999) return false;
    return true;
  };

  const invoices = allInvoices.filter(
    (v) =>
      (!ql || v.no.toLowerCase().includes(ql) || hospName(v).toLowerCase().includes(ql)) &&
      (statusF === 'All' || v.status === statusF) &&
      inRange(v.issued),
  );
  const payments = allPayments.filter(
    (v) =>
      (!ql ||
        v.txn.toLowerCase().includes(ql) ||
        v.inv.toLowerCase().includes(ql) ||
        hospName(v).toLowerCase().includes(ql)) &&
      (methodF === 'All' || v.method === methodF) &&
      (statusF === 'All' || v.status === statusF) &&
      inRange(v.date),
  );

  /* KPI tiles, counted off the ledger the screen is showing — so Refresh, a
   * mark-as-paid or a retry moves them, instead of four frozen numbers. */
  const thisMonth = billingTodayIso().slice(0, 7);
  const collected = allInvoices
    .filter((v) => !isUnpaid(v) && (isoFromLongDate(v.issued) ?? '').startsWith(thisMonth))
    .reduce((sum, v) => sum + v.amount, 0);
  const openInvoices = allInvoices.filter(isUnpaid);
  const outstanding = openInvoices.reduce((sum, v) => sum + v.amount, 0);
  const failedPayments = allPayments.filter((p) => p.status === 'Payment failed');
  const retried = failedPayments.filter((p) => p.attempts > 1).length;

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'indian-rupee',
      label: 'Collected This Month',
      value: moneyShort(collected),
      sub: 'Invoices settled in the current cycle',
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
      subClass: 'text-text-muted',
    },
    {
      icon: 'hourglass',
      label: 'Outstanding Dues',
      value: moneyShort(outstanding),
      sub: `${openInvoices.length} invoice${openInvoices.length === 1 ? '' : 's'} open`,
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
      subClass: 'text-text-muted',
    },
    {
      icon: 'file-text',
      label: 'Invoices Issued',
      value: allInvoices.length,
      sub: 'In the subscription ledger',
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
      subClass: 'text-text-muted',
    },
    {
      icon: 'circle-x',
      label: 'Failed Payments',
      value: failedPayments.length,
      sub: `${retried} already retried`,
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
      subClass: 'text-text-muted',
    },
  ];

  const { sort, onSort, sorted } = useSort<Invoice | Payment>();
  const accessors: SortAccessors<Invoice | Payment> =
    tab === 'Invoices'
      ? {
          no: (v) => (isInvoice(v) ? v.no : null),
          amount: (v) => v.amount,
          issued: (v) => (isInvoice(v) ? Date.parse(v.issued) || 0 : 0),
          due: (v) => (isInvoice(v) ? Date.parse(v.due) || 0 : 0),
          status: (v) => v.status,
        }
      : {
          txn: (v) => (isPayment(v) ? v.txn : null),
          inv: (v) => (isPayment(v) ? v.inv : null),
          method: (v) => (isPayment(v) ? v.method : null),
          amount: (v) => v.amount,
          date: (v) => (isPayment(v) ? Date.parse(v.date) || 0 : 0),
          status: (v) => v.status,
        };
  const source: readonly (Invoice | Payment)[] = tab === 'Invoices' ? invoices : payments;
  const list = sorted([...source], accessors);
  const pg = Math.min(page, Math.max(0, Math.ceil(list.length / OPS_BILL_PAGE) - 1));
  const rows = list.slice(pg * OPS_BILL_PAGE, pg * OPS_BILL_PAGE + OPS_BILL_PAGE);

  const statusOpts =
    tab === 'Invoices'
      ? ['All', 'Completed', 'Pending', 'Overdue', 'Payment failed']
      : ['All', 'Success', 'Pending', 'Payment failed'];

  const toInvoice = (id: number): void => {
    navigate(`${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['invoice-detail'].replace(':id', String(id))}`);
  };
  const toPayment = (id: number): void => {
    navigate(`${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['payment-detail'].replace(':id', String(id))}`);
  };
  const hospitalOf = (hid: number) => hospitals.find((h) => h.id === hid) ?? null;

  const exportCsv = (): void => {
    if (tab === 'Invoices') {
      const filename = 'medibook-ops-invoices.csv';
      downloadCsv(filename, [
        [
          'Invoice',
          'Hospital',
          'Issued',
          'Due',
          'Status',
          'Taxable value',
          'GST (18%)',
          'Total',
          'Paid mode',
          'Reference',
        ],
        ...invoices.map((v) => {
          const tax = invoiceTax(v.amount);
          return [
            v.no,
            hospName(v),
            v.issued,
            v.due,
            v.status,
            tax.base,
            tax.gst,
            tax.total,
            v.paidMode ?? '',
            v.paidRef ?? '',
          ];
        }),
      ]);
      toast(`Exported ${filename}`, 'success');
      return;
    }
    const filename = 'medibook-ops-payments.csv';
    downloadCsv(filename, [
      ['Transaction', 'Invoice', 'Hospital', 'Method', 'Amount', 'Date', 'Status', 'Attempts'],
      ...payments.map((v) => [
        v.txn,
        v.inv,
        hospName(v),
        v.method,
        v.amount,
        v.date,
        v.status,
        v.attempts,
      ]),
    ]);
    toast(`Exported ${filename}`, 'success');
  };

  const dateInputClass =
    'rounded-input border-border text-body text-text-body h-11 border bg-white px-3';
  const filtersActive = Boolean(ql || statusF !== 'All' || methodF !== 'All' || dateF || dateT);

  /** Loading / empty row for whichever table is on screen. */
  const tableState = (
    noun: string,
    icon: 'file-text' | 'indian-rupee',
  ): TableStateSpec | undefined => {
    if (loading) return { kind: 'loading', rows: OPS_BILL_PAGE };
    if (rows.length > 0) return undefined;
    return filtersActive
      ? {
          kind: 'empty',
          icon,
          title: 'No results match your filters.',
          message: `No ${noun} match the current search, date range and status.`,
          actionLabel: 'Clear filters',
          onAction: clearAll,
        }
      : {
          kind: 'empty',
          icon,
          title: `No ${noun} yet.`,
          message:
            tab === 'Invoices'
              ? 'Subscription invoices appear here as each billing cycle is run.'
              : 'Payments appear here as hospitals settle their subscription invoices.',
        };
  };

  return (
    <div className="flex flex-col gap-5">
      <KpiStrip items={KPIS} />
      <Card pad={14}>
        <Tabs
          tabs={['Invoices', 'Payments']}
          value={tab}
          onChange={(v) => {
            setTab(v as BillTab);
            setQ('');
            setStatusF('All');
            setMethodF('All');
            setDateF('');
            setDateT('');
            setPage(0);
          }}
        />
      </Card>
      <Card>
        <div className="mb-4">
          <SearchField
            value={q}
            onChange={reset(setQ)}
            placeholder={
              tab === 'Invoices'
                ? 'Search invoice or hospital'
                : 'Search transaction, invoice or hospital'
            }
          />
        </div>
        <div className="mb-4.5 flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={refresh} title="Refresh billing" />
          <input
            type="date"
            value={dateF}
            onChange={(e) => reset(setDateF)(e.target.value)}
            title={tab === 'Invoices' ? 'Issued from' : 'Paid from'}
            aria-label={tab === 'Invoices' ? 'Issued from' : 'Paid from'}
            className={dateInputClass}
          />
          <input
            type="date"
            value={dateT}
            onChange={(e) => reset(setDateT)(e.target.value)}
            title={tab === 'Invoices' ? 'Issued to' : 'Paid to'}
            aria-label={tab === 'Invoices' ? 'Issued to' : 'Paid to'}
            className={dateInputClass}
          />
          {tab === 'Payments' && (
            <FilterSelect
              value={methodF}
              aria-label="Filter by payment method"
              options={['All', 'UPI', 'Card', 'NetBanking', 'Bank transfer', 'Cheque', 'Cash'].map(
                (x) => (x === 'All' ? 'Method: All' : x),
              )}
              onChange={(v) => reset(setMethodF)(v === 'Method: All' ? 'All' : v)}
            />
          )}
          <FilterSelect
            value={statusF}
            aria-label={
              tab === 'Invoices' ? 'Filter by invoice status' : 'Filter by payment status'
            }
            options={statusOpts.map((x) => (x === 'All' ? 'Status: All' : x))}
            onChange={(v) => reset(setStatusF)(v === 'Status: All' ? 'All' : v)}
          />
          {filtersActive && <ClearChip onClick={clearAll} />}
          <div className="flex-1"></div>
          <span className="text-caption text-text-muted">Updated {syncedAt}</span>
          <Button variant="secondary" size="sm" icon="download" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
        {tab === 'Invoices' ? (
          <>
            <TableShell
              columns={INVOICE_COLUMNS}
              rightCols={['Amount']}
              scrollLabel="Subscription invoices"
              sortKeys={{
                Invoice: 'no',
                Amount: 'amount',
                Issued: 'issued',
                Due: 'due',
                Status: 'status',
              }}
              sort={sort}
              onSort={onSort}
              state={tableState('invoices', 'file-text')}
            >
              {rows.filter(isInvoice).map((v) => (
                <tr
                  key={v.id}
                  onClick={() => toInvoice(v.id)}
                  className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
                >
                  <td className={tdClass}>
                    <OpsEntity icon="file-text" tint="primary" title={v.no} sub={hospName(v)} />
                  </td>
                  <td
                    className={cn(tdClass, 'text-text-strong text-right font-medium tabular-nums')}
                  >
                    {money(v.amount)}
                  </td>
                  <td className={tdClass}>{v.issued}</td>
                  <td className={tdClass}>{v.due}</td>
                  <td className={tdClass}>
                    <Badge status={v.status} />
                  </td>
                  <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <IconBtn
                        name="eye"
                        label="View invoice"
                        box={36}
                        size={16}
                        onClick={() => toInvoice(v.id)}
                      />
                      <IconBtn
                        name="printer"
                        label="Save invoice as PDF"
                        box={36}
                        size={16}
                        title={`Save ${v.no} as PDF (opens the print dialog)`}
                        onClick={() =>
                          setPrintJob((job) => ({ invoice: v, seq: (job?.seq ?? 0) + 1 }))
                        }
                      />
                      {isUnpaid(v) && (
                        <IconBtn
                          name="bell-ring"
                          label="Queue payment reminder"
                          box={36}
                          size={16}
                          title={`Queue a payment reminder for ${v.no}`}
                          onClick={() => setReminderFor(v)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </TableShell>
            <Pager
              total={invoices.length}
              page={pg}
              pageSize={OPS_BILL_PAGE}
              onPage={setPage}
              noun="invoices"
            />
          </>
        ) : (
          <>
            <TableShell
              columns={PAYMENT_COLUMNS}
              rightCols={['Amount']}
              scrollLabel="Subscription payments"
              sortKeys={{
                Transaction: 'txn',
                Invoice: 'inv',
                Method: 'method',
                Amount: 'amount',
                Date: 'date',
                Status: 'status',
              }}
              sort={sort}
              onSort={onSort}
              state={tableState('payments', 'indian-rupee')}
            >
              {rows.filter(isPayment).map((v) => (
                <tr
                  key={v.id}
                  onClick={() => toPayment(v.id)}
                  className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
                >
                  <td className={tdClass}>
                    <OpsEntity icon="indian-rupee" tint="success" title={v.txn} sub={hospName(v)} />
                  </td>
                  <td className={cn(tdClass, 'tabular-nums')}>{v.inv}</td>
                  <td className={tdClass}>{v.method}</td>
                  <td
                    className={cn(tdClass, 'text-text-strong text-right font-medium tabular-nums')}
                  >
                    {money(v.amount)}
                  </td>
                  <td className={tdClass}>
                    {v.date}
                    {v.attempts > 1 && (
                      <div className="text-caption text-text-muted">
                        Attempt {v.attempts} of {MAX_PAYMENT_ATTEMPTS}
                      </div>
                    )}
                  </td>
                  <td className={tdClass}>
                    <Badge status={v.status} />
                  </td>
                  <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <IconBtn
                        name="eye"
                        label="View payment"
                        box={36}
                        size={16}
                        onClick={() => toPayment(v.id)}
                      />
                      {v.status === 'Payment failed' && (
                        <IconBtn
                          name="rotate-ccw"
                          label="Retry payment"
                          box={36}
                          size={16}
                          disabled={v.attempts >= MAX_PAYMENT_ATTEMPTS}
                          busy={busy[`retry${v.id}`]}
                          title={
                            v.attempts >= MAX_PAYMENT_ATTEMPTS
                              ? `${MAX_PAYMENT_ATTEMPTS} attempts have failed — collect this payment manually`
                              : `Retry ${v.txn} (attempt ${v.attempts + 1})`
                          }
                          onClick={() =>
                            run(
                              `retry${v.id}`,
                              `Retry queued for ${v.txn} — attempt ${v.attempts + 1} is pending with the gateway.`,
                              () => retryPayment(v.id),
                            )
                          }
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </TableShell>
            <Pager
              total={payments.length}
              page={pg}
              pageSize={OPS_BILL_PAGE}
              onPage={setPage}
              noun="payments"
            />
          </>
        )}
      </Card>

      {/* The real print target for the row action. `invisible` (not `hidden`)
          because the print rule in index.css restores visibility — it cannot
          undo `display: none`. */}
      <div
        ref={printRef}
        aria-hidden="true"
        className="pointer-events-none invisible fixed inset-0 -z-10 overflow-hidden bg-white"
      >
        {printJob && (
          <InvoicePrintSheet
            invoice={printJob.invoice}
            hospitalName={hospName(printJob.invoice)}
            hospitalGstin={hospitalOf(printJob.invoice.hid)?.gstin}
            planName={hospitalOf(printJob.invoice.hid)?.plan ?? 'Growth'}
            period={INVOICE_PERIOD}
          />
        )}
      </div>

      {reminderFor && (
        <SendReminderModal
          open
          invoice={reminderFor}
          hospitalEmail={hospitalOf(reminderFor.hid)?.email ?? ''}
          hospitalPhone={hospitalOf(reminderFor.hid)?.phone ?? ''}
          onClose={() => setReminderFor(null)}
          onDone={() => setReminderFor(null)}
        />
      )}
    </div>
  );
}
