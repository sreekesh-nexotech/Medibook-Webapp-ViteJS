import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { SortState } from '@/shared/hooks/useSort';
import { cn } from '@/shared/lib/cn';
import { downloadCsv } from '@/shared/lib/download';
import { fmtDate, formatInstant, rupeesFromPaise } from '@/shared/lib/format';
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
  useExportInvoicesMutation,
  useInvoicePdfMutation,
  usePaymentsExportMutation,
} from '@/features/ops-billing/application/queries/useInvoiceFileMutations';
import { useInvoicesQuery } from '@/features/ops-billing/application/queries/useInvoicesQuery';
import { usePaymentsQuery } from '@/features/ops-billing/application/queries/usePaymentsQuery';
import type {
  BillingInvoice,
  InvoiceListParams,
  InvoiceSortField,
  PaymentListParams,
  PaymentSortField,
} from '@/features/ops-billing/domain/entities/billing.entities';
import { BillingHospitalName } from '@/features/ops-billing/presentation/components/BillingHospitalName';
import {
  INVOICE_STATUS_BADGES,
  METHOD_LABELS,
  PAYMENT_STATUS_BADGES,
  dateOf,
  failureText,
  fromLabel,
  isNotImplemented,
  isUnpaid,
  plural,
  rupees,
  saveFile,
} from '@/features/ops-billing/presentation/components/billingView';
import { PlanChangesPanel } from '@/features/ops-billing/presentation/components/PlanChangesPanel';
import { SendReminderModal } from '@/features/ops-billing/presentation/components/SendReminderModal';
import { useBillingDebouncedValue } from '@/features/ops-billing/presentation/components/useBillingDebouncedValue';

/** Rows per page for the billing tables (design `OPS_BILL_PAGE`). */
const OPS_BILL_PAGE = 6;

/** Wait this long after the last keystroke before searching. */
const SEARCH_DEBOUNCE_MS = 300;

/** A count tile only needs the list's `total`. */
const COUNT_PAGE_SIZE = 1;

const TABS = ['Invoices', 'Payments', 'Plan Changes'] as const;
type BillTab = (typeof TABS)[number];

const STATUS_ALL = 'Status: All';
const METHOD_ALL = 'Method: All';

const PAYMENTS_CSV_FILENAME = 'medibook-subscription-payments.csv';

const INVOICE_COLUMNS = ['Invoice', 'Amount', 'Issued', 'Due', 'Status', 'Action'] as const;
const PAYMENT_COLUMNS = [
  'Payment',
  'Invoice',
  'Method',
  'Amount',
  'Date',
  'Status',
  'Action',
] as const;

const INVOICE_SORT_FIELDS: Readonly<Record<string, InvoiceSortField>> = {
  no: 'invoice_no',
  amount: 'total_paise',
  issued: 'issued_at',
  due: 'due_at',
};
const PAYMENT_SORT_FIELDS: Readonly<Record<string, PaymentSortField>> = {
  amount: 'amount_paise',
  date: 'attempted_at',
};

const NO_SORT: SortState = { key: null, dir: 'asc' };

const PDF_FAILED = 'The invoice PDF could not be downloaded. Please try again.';
const PDF_UNAVAILABLE =
  'This server cannot render invoice PDFs yet. Open the invoice and use Save as PDF to print it.';
const EXPORT_FAILED = 'The export could not be created. Please try again.';

/** The invoice list's defaults, shared by the table and the count tiles. */
const BASE_INVOICE_PARAMS: InvoiceListParams = {
  page: 1,
  pageSize: COUNT_PAGE_SIZE,
  q: '',
  statuses: [],
  dueFrom: null,
  dueTo: null,
  overdue: null,
  sortField: 'issued_at',
  sortDirection: 'desc',
};

const BASE_PAYMENT_PARAMS: PaymentListParams = {
  page: 1,
  pageSize: COUNT_PAGE_SIZE,
  statuses: [],
  method: null,
  invoiceId: null,
  sortField: 'attempted_at',
  sortDirection: 'desc',
};

function isTab(v: string | null): v is BillTab {
  return (TABS as readonly string[]).includes(v ?? '');
}

/**
 * Ops subscription billing (design `Ops.jsx` `OpsBilling`): count tiles, the
 * Invoices | Payments | Plan Changes tabs (preset through `?tab=`), and
 * server-side search, filters, sort and paging on the platform billing API.
 */
export function OpsBillingScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const [tab, setTabRaw] = useState<BillTab>(isTab(requested) ? requested : 'Invoices');

  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState(STATUS_ALL);
  const [methodF, setMethodF] = useState(METHOD_ALL);
  const [dateF, setDateF] = useState('');
  const [dateT, setDateT] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState>(NO_SORT);
  const [reminderFor, setReminderFor] = useState<BillingInvoice | null>(null);

  const search = useBillingDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);

  const invoiceSortField = sort.key ? INVOICE_SORT_FIELDS[sort.key] : undefined;
  const invoiceStatus = fromLabel(INVOICE_STATUS_BADGES, statusF);
  const invoiceParams: InvoiceListParams = {
    ...BASE_INVOICE_PARAMS,
    page: page + 1,
    pageSize: OPS_BILL_PAGE,
    q: search,
    statuses: invoiceStatus ? [invoiceStatus] : [],
    dueFrom: dateF || null,
    dueTo: dateT || null,
    sortField: invoiceSortField ?? 'issued_at',
    sortDirection: invoiceSortField ? sort.dir : 'desc',
  };
  const paymentSortField = sort.key ? PAYMENT_SORT_FIELDS[sort.key] : undefined;
  const paymentStatus = fromLabel(PAYMENT_STATUS_BADGES, statusF);
  const paymentParams: PaymentListParams = {
    ...BASE_PAYMENT_PARAMS,
    page: page + 1,
    pageSize: OPS_BILL_PAGE,
    statuses: paymentStatus ? [paymentStatus] : [],
    method: fromLabel(METHOD_LABELS, methodF),
    sortField: paymentSortField ?? 'attempted_at',
    sortDirection: paymentSortField ? sort.dir : 'desc',
  };

  const invoicesQuery = useInvoicesQuery(invoiceParams);
  const paymentsQuery = usePaymentsQuery(paymentParams, tab === 'Payments');

  /* Count tiles: the totals of filtered lists. The API has no amount sums,
   * so the tiles count invoices instead of adding up rupees. */
  const issuedCount = useInvoicesQuery(BASE_INVOICE_PARAMS);
  const openCount = useInvoicesQuery({ ...BASE_INVOICE_PARAMS, statuses: ['issued', 'overdue'] });
  const overdueCount = useInvoicesQuery({ ...BASE_INVOICE_PARAMS, overdue: true });
  const failedCount = usePaymentsQuery({ ...BASE_PAYMENT_PARAMS, statuses: ['failed'] });
  const countOf = (query: { data?: { total: number }; isLoadingError: boolean }) =>
    query.data?.total ?? (query.isLoadingError ? '—' : '…');

  const pdf = useInvoicePdfMutation();
  const exportInvoices = useExportInvoicesMutation();
  const exportPayments = usePaymentsExportMutation();

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'file-text',
      label: 'Invoices Issued',
      value: countOf(issuedCount),
      sub: 'In the subscription ledger',
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
      subClass: 'text-text-muted',
    },
    {
      icon: 'hourglass',
      label: 'Open Invoices',
      value: countOf(openCount),
      sub: 'Issued and not yet paid',
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
      subClass: 'text-text-muted',
    },
    {
      icon: 'triangle-alert',
      label: 'Overdue',
      value: countOf(overdueCount),
      sub: 'Past their due date',
      iconClass: 'bg-d-100 text-d-500',
      valueClass: 'text-d-500',
      subClass: 'text-text-muted',
    },
    {
      icon: 'circle-x',
      label: 'Failed Payments',
      value: countOf(failedCount),
      sub: 'Gateway attempts that did not go through',
      iconClass: 'bg-badge-noshow-bg text-orange',
      valueClass: 'text-orange',
      subClass: 'text-text-muted',
    },
  ];

  const clearAll = (): void => {
    setQ('');
    setStatusF(STATUS_ALL);
    setMethodF(METHOD_ALL);
    setDateF('');
    setDateT('');
    setSort(NO_SORT);
    setPage(0);
  };
  const setTab = (t: BillTab): void => {
    setTabRaw(t);
    clearAll();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', t);
        return next;
      },
      { replace: true },
    );
  };
  const reset =
    (fn: (v: string) => void) =>
    (v: string): void => {
      fn(v);
      setPage(0);
    };
  const onSort = (key: string): void => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
    setPage(0);
  };

  const toInvoice = (id: string): void => {
    navigate(`${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['invoice-detail'].replace(':id', id)}`);
  };
  const toPayment = (id: string, invoiceId: string): void => {
    navigate(`${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['payment-detail'].replace(':id', id)}`, {
      state: { invoiceId },
    });
  };

  const downloadPdf = (inv: BillingInvoice): void => {
    pdf.mutate(
      { id: inv.id, invoiceNo: inv.invoiceNo },
      {
        onSuccess: saveFile,
        onError: (error) =>
          toast(
            isNotImplemented(error) ? PDF_UNAVAILABLE : failureText(error, PDF_FAILED),
            'error',
          ),
      },
    );
  };

  const exportCsv = (): void => {
    if (tab === 'Invoices') {
      exportInvoices.mutate(invoiceParams, {
        onSuccess: (file) => {
          saveFile(file);
          toast(`Exported ${file.filename}`, 'success');
        },
        onError: (error) => toast(failureText(error, EXPORT_FAILED), 'error'),
      });
      return;
    }
    exportPayments.mutate(paymentParams, {
      onSuccess: (result) => {
        downloadCsv(PAYMENTS_CSV_FILENAME, [
          [
            'Payment',
            'Invoice',
            'Method',
            'Amount (₹)',
            'Attempted',
            'Status',
            'Attempt',
            'Reference',
          ],
          ...result.items.map((p) => [
            p.gatewayPaymentId ?? p.id,
            p.invoiceNo,
            METHOD_LABELS[p.method],
            rupeesFromPaise(p.amountPaise),
            p.attemptedAt,
            PAYMENT_STATUS_BADGES[p.status].label,
            p.attemptNo,
            p.referenceNote ?? '',
          ]),
        ]);
        toast(
          result.total > result.items.length
            ? `Exported the newest ${result.items.length} of ${plural(result.total, 'payment')}`
            : `Exported ${PAYMENTS_CSV_FILENAME}`,
          'success',
        );
      },
      onError: (error) => toast(failureText(error, EXPORT_FAILED), 'error'),
    });
  };

  const dateInputClass =
    'rounded-input border-border text-body text-text-body h-11 border bg-white px-3';
  const filtersActive = Boolean(
    q || statusF !== STATUS_ALL || methodF !== METHOD_ALL || dateF || dateT,
  );

  const activeQuery = tab === 'Invoices' ? invoicesQuery : paymentsQuery;
  const rowCount =
    tab === 'Invoices'
      ? (invoicesQuery.data?.items.length ?? 0)
      : (paymentsQuery.data?.items.length ?? 0);

  /** Loading / error / empty row for whichever table is on screen. */
  const tableState = (
    noun: string,
    icon: 'file-text' | 'indian-rupee',
  ): TableStateSpec | undefined => {
    if (activeQuery.isPending) return { kind: 'loading', rows: OPS_BILL_PAGE };
    if (activeQuery.isLoadingError)
      return {
        kind: 'error',
        message: failureText(activeQuery.error, `The ${noun} could not be loaded.`),
        onRetry: () => void activeQuery.refetch(),
      };
    if (rowCount > 0) return undefined;
    return filtersActive
      ? {
          kind: 'empty',
          icon,
          title: 'No results match your filters.',
          message: `No ${noun} match the current search, dates and filters.`,
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

  const invoiceStatusOpts = [
    STATUS_ALL,
    ...Object.values(INVOICE_STATUS_BADGES).map((b) => b.label),
  ];
  const paymentStatusOpts = [
    STATUS_ALL,
    ...Object.values(PAYMENT_STATUS_BADGES).map((b) => b.label),
  ];

  return (
    <div className="flex flex-col gap-5">
      <KpiStrip items={KPIS} />
      <Card pad={14}>
        <Tabs tabs={[...TABS]} value={tab} onChange={(v) => setTab(v as BillTab)} />
      </Card>
      <Card>
        {tab === 'Plan Changes' ? (
          <PlanChangesPanel />
        ) : (
          <>
            {tab === 'Invoices' && (
              <div className="mb-4">
                <SearchField value={q} onChange={reset(setQ)} placeholder="Search invoice number" />
              </div>
            )}
            <div className="mb-4.5 flex flex-wrap items-center gap-3">
              <RefreshBtn
                onRefresh={async () => {
                  await activeQuery.refetch();
                }}
                title="Refresh billing"
              />
              {tab === 'Invoices' && (
                <>
                  <input
                    type="date"
                    value={dateF}
                    onChange={(e) => reset(setDateF)(e.target.value)}
                    title="Due from"
                    aria-label="Due from"
                    className={dateInputClass}
                  />
                  <input
                    type="date"
                    value={dateT}
                    onChange={(e) => reset(setDateT)(e.target.value)}
                    title="Due to"
                    aria-label="Due to"
                    className={dateInputClass}
                  />
                </>
              )}
              {tab === 'Payments' && (
                <FilterSelect
                  value={methodF}
                  aria-label="Filter by payment method"
                  options={[METHOD_ALL, ...Object.values(METHOD_LABELS)]}
                  onChange={reset(setMethodF)}
                />
              )}
              <FilterSelect
                value={statusF}
                aria-label={
                  tab === 'Invoices' ? 'Filter by invoice status' : 'Filter by payment status'
                }
                options={tab === 'Invoices' ? invoiceStatusOpts : paymentStatusOpts}
                onChange={reset(setStatusF)}
              />
              {filtersActive && <ClearChip onClick={clearAll} />}
              <div className="flex-1"></div>
              {activeQuery.dataUpdatedAt > 0 && (
                <span className="text-caption text-text-muted">
                  Updated{' '}
                  {formatInstant(activeQuery.dataUpdatedAt, { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button
                variant="secondary"
                size="sm"
                icon="download"
                busy={exportInvoices.isPending || exportPayments.isPending}
                onClick={exportCsv}
              >
                Export CSV
              </Button>
            </div>
            {tab === 'Invoices' ? (
              <>
                <TableShell
                  columns={INVOICE_COLUMNS}
                  rightCols={['Amount']}
                  scrollLabel="Subscription invoices"
                  sortKeys={{ Invoice: 'no', Amount: 'amount', Issued: 'issued', Due: 'due' }}
                  sort={sort}
                  onSort={onSort}
                  state={tableState('invoices', 'file-text')}
                >
                  {(invoicesQuery.data?.items ?? []).map((v) => {
                    const badge = INVOICE_STATUS_BADGES[v.status];
                    return (
                      <tr
                        key={v.id}
                        onClick={() => toInvoice(v.id)}
                        className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
                      >
                        <td className={tdClass}>
                          <OpsEntity
                            icon="file-text"
                            tint="primary"
                            title={v.invoiceNo}
                            sub={v.hospitalName}
                          />
                        </td>
                        <td
                          className={cn(
                            tdClass,
                            'text-text-strong text-right font-medium tabular-nums',
                          )}
                        >
                          {rupees(v.totalPaise)}
                          {v.amountPaidPaise > 0 && v.status !== 'paid' && (
                            <div className="text-caption text-text-muted font-normal">
                              {rupees(v.amountPaidPaise)} paid
                            </div>
                          )}
                        </td>
                        <td className={tdClass}>{fmtDate(dateOf(v.issuedAt))}</td>
                        <td className={tdClass}>{fmtDate(v.dueAt)}</td>
                        <td className={tdClass}>
                          <Badge status={badge.status}>{badge.label}</Badge>
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
                              name="download"
                              label="Download invoice PDF"
                              box={36}
                              size={16}
                              title={`Download ${v.invoiceNo} as PDF`}
                              busy={pdf.isPending && pdf.variables?.id === v.id}
                              onClick={() => downloadPdf(v)}
                            />
                            {isUnpaid(v) && (
                              <IconBtn
                                name="bell-ring"
                                label="Queue payment reminder"
                                box={36}
                                size={16}
                                title={`Queue a payment reminder for ${v.invoiceNo}`}
                                onClick={() => setReminderFor(v)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </TableShell>
                <Pager
                  total={invoicesQuery.data?.total ?? 0}
                  page={page}
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
                  sortKeys={{ Amount: 'amount', Date: 'date' }}
                  sort={sort}
                  onSort={onSort}
                  state={tableState('payments', 'indian-rupee')}
                >
                  {(paymentsQuery.data?.items ?? []).map((v) => {
                    const badge = PAYMENT_STATUS_BADGES[v.status];
                    return (
                      <tr
                        key={v.id}
                        onClick={() => toPayment(v.id, v.invoiceId)}
                        className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
                      >
                        <td className={tdClass}>
                          <OpsEntity
                            icon="indian-rupee"
                            tint="success"
                            title={v.gatewayPaymentId ?? v.referenceNote ?? 'Manual payment'}
                            sub={<BillingHospitalName hospitalId={v.hospitalId} />}
                          />
                        </td>
                        <td className={cn(tdClass, 'tabular-nums')}>{v.invoiceNo}</td>
                        <td className={tdClass}>{METHOD_LABELS[v.method]}</td>
                        <td
                          className={cn(
                            tdClass,
                            'text-text-strong text-right font-medium tabular-nums',
                          )}
                        >
                          {rupees(v.amountPaise)}
                        </td>
                        <td className={tdClass}>
                          {fmtDate(dateOf(v.attemptedAt))}
                          {v.attemptNo > 1 && (
                            <div className="text-caption text-text-muted">
                              Attempt {v.attemptNo}
                            </div>
                          )}
                        </td>
                        <td className={tdClass}>
                          <Badge status={badge.status}>{badge.label}</Badge>
                        </td>
                        <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                          <IconBtn
                            name="eye"
                            label="View payment"
                            box={36}
                            size={16}
                            onClick={() => toPayment(v.id, v.invoiceId)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </TableShell>
                <Pager
                  total={paymentsQuery.data?.total ?? 0}
                  page={page}
                  pageSize={OPS_BILL_PAGE}
                  onPage={setPage}
                  noun="payments"
                />
              </>
            )}
          </>
        )}
      </Card>

      {reminderFor && (
        <SendReminderModal
          invoice={reminderFor}
          hospitalEmail={null}
          onClose={() => setReminderFor(null)}
        />
      )}
    </div>
  );
}
