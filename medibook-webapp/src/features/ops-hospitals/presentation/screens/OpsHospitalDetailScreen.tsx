import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { OPS_BASE_PATH, OPS_VIEW_SEGMENT, opsOnboardingPath, opsPath } from '@/app/router/paths';
import { SETTLE_COMMISSION } from '@/core/config/demo';
import { useSort } from '@/shared/hooks/useSort';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { cn } from '@/shared/lib/cn';
import { fmtDate, money, moneyShort } from '@/shared/lib/format';
import { toast } from '@/shared/ui/toast/toast.store';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { IconBtn } from '@/shared/ui/IconBtn';
import { InfoGrid, type InfoGridItem } from '@/shared/ui/InfoGrid';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { StatCard, type StatCardData } from '@/shared/ui/StatCard';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import { Tabs } from '@/shared/ui/Tabs';

import { usePlansStore } from '@/features/ops-plans/application/store/plans.store';
import { useBillingStore } from '@/features/ops-billing/application/store/billing.store';
import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';
import { useSettlementsStore } from '@/features/settlements/application/store/settlements.store';
import { useOpsSettlementsStore } from '@/features/ops-settlements/application/store/opsSettlements.store';
import { useOpsSettingsStore } from '@/features/ops-settings/application/store/opsSettings.store';
import {
  bankOf,
  gstinOf,
  hospName,
  kycOf,
  opsBookingsFor,
  opsDeptsFor,
  opsDocsFor,
  useHospitalsStore,
} from '@/features/ops-hospitals/application/store/hospitals.store';
import { KYC_DOCS } from '@/features/ops-hospitals/application/store/hospitals.fixtures';
import type { OpsDoctor } from '@/features/ops-hospitals/application/store/hospitals.types';
import {
  docProgress,
  goLiveBlockers,
  stageOf,
} from '@/features/ops-hospitals/application/store/onboarding.derive';
import { ONBOARDING_DOC_LABEL } from '@/features/ops-hospitals/application/store/onboarding.fixtures';
import { useOnboardingStore } from '@/features/ops-hospitals/application/store/onboarding.store';
import { longDateFromIso } from '@/features/ops-hospitals/application/store/opsDates';
import {
  DOC_BADGE,
  STAGE_BADGE,
} from '@/features/ops-hospitals/presentation/components/onboarding.view';
import {
  graceFor,
  graceDaysFor,
  isUnpaid,
} from '@/features/ops-billing/application/store/billing.derive';
import { billingTodayIso } from '@/features/ops-billing/application/store/billing.store';

/** Which lifecycle dialog is open. */
type DetailModal = 'approve' | 'reject' | 'suspend' | 'unsuspend' | null;

/** Detail-page path builder for a billing sub-record (reuses the route table). */
const billingDetailPath = (view: 'invoice-detail' | 'payment-detail', id: number): string =>
  `${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT[view].replace(':id', String(id))}`;

export function OpsHospitalDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const hospitals = useHospitalsStore((s) => s.hospitals);
  const approve = useHospitalsStore((s) => s.approve);
  const reject = useHospitalsStore((s) => s.reject);
  const suspendHospital = useHospitalsStore((s) => s.suspend);
  const unsuspendHospital = useHospitalsStore((s) => s.unsuspend);
  const onboardingCases = useOnboardingStore((s) => s.cases);
  const goLive = useOnboardingStore((s) => s.goLive);
  const plans = usePlansStore((s) => s.plans);
  const invoices = useBillingStore((s) => s.invoices);
  const payments = useBillingStore((s) => s.payments);
  const apolloSettlements = useSettlementsStore((s) => s.settlements);
  const opsSettlements = useOpsSettlementsStore((s) => s.settlements);
  const logs = useLogsStore((s) => s.logs);
  const commission = useOpsSettingsStore((s) => s.settings.commission);

  const [modal, setModal] = useState<DetailModal>(null);
  const [reason, setReason] = useState('');
  const [tab, setTab] = useState('Overview');
  const [docDeptF, setDocDeptF] = useState('All');
  const { sort: dSort, onSort: dOnSort, sorted: dSorted } = useSort<OpsDoctor>();
  const [busy, run] = useOpsAct();

  const numId = Number(id);
  const h = hospitals.find((x) => x.id === numId) ?? hospitals[0];
  if (!h) return null;

  /** Effective platform commission rate (design `opsComm`). */
  const opsComm = (): number => {
    const n = parseFloat(commission);
    return isFinite(n) && n >= 0 && n <= 100 ? n / 100 : SETTLE_COMMISSION;
  };
  /** Monthly booking quota for a plan name (design `opsPlanQuota`). */
  const opsPlanQuota = (name: string): number => {
    const p = plans.find((x) => x.name === name);
    return p ? p.quota : 1500;
  };

  const limit = opsPlanQuota(h.plan);
  const bank = bankOf(h.id);
  /* The onboarding case is authoritative for KYC once one exists: it holds the
   * per-document decisions the pipeline records (SA-01). Hospitals seeded
   * before a case existed still fall back to the registry's KYC record. */
  const onboarding = onboardingCases.find((c) => c.hid === h.id) ?? null;
  const onboardingDocs = onboarding && onboarding.docs.length > 0 ? onboarding.docs : null;
  const blockers = onboarding ? goLiveBlockers(onboarding) : [];
  const progress = onboarding ? docProgress(onboarding) : { approved: 0, total: 0 };
  const quota = Math.min(100, Math.round((h.bookings / limit) * 100));
  const suspended = h.status === 'Suspended';
  const kyc = kycOf(h);
  const kycMissing = KYC_DOCS.filter(([k]) => kyc[k] === 'Missing').map(([, l]) => l);
  const kycReady = onboardingDocs ? blockers.length === 0 : kycMissing.length === 0;
  const gstin = gstinOf(h);
  const depts = opsDeptsFor(h);
  const invs = invoices.filter((v) => v.hid === h.id);
  const pays = payments.filter((v) => v.hid === h.id);
  const comm = opsComm();
  const setts = [...apolloSettlements, ...opsSettlements]
    .filter((r) => r.hid === h.id)
    .map((r) => ({
      id: r.id,
      period: r.period,
      expected: r.expected,
      status: r.status,
      utr: r.utr,
      net: 'net' in r && typeof r.net === 'number' ? r.net : Math.round(r.gross * (1 - comm)),
    }));
  const acts = logs.filter((l) => l.hid === h.id || String(l.action).includes(h.name)).slice(0, 8);
  /* Oldest unpaid invoice drives the grace countdown and the suspension path. */
  const oldestUnpaid = [...invs]
    .filter(isUnpaid)
    .sort((a, b) => (Date.parse(a.due) || 0) - (Date.parse(b.due) || 0))[0];
  const grace = oldestUnpaid ? graceFor(oldestUnpaid, h, billingTodayIso()) : null;
  const graceDays = oldestUnpaid ? graceDaysFor(oldestUnpaid, h) : h.graceDays;
  const allDocs = opsDocsFor(h);
  const docs = dSorted(docDeptF === 'All' ? allDocs : allDocs.filter((d) => d.dept === docDeptF), {
    name: (d) => d.name,
    dept: (d) => d.dept,
    room: (d) => d.room,
    fee: (d) => d.fee,
    rating: (d) => parseFloat(d.rating),
    status: (d) => d.status,
  });

  const planPrice = plans.find((p) => p.name === h.plan)?.price ?? 0;

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'calendar-check',
      label: 'Bookings This Month',
      value: h.bookings.toLocaleString('en-IN'),
      sub: '+4.6% vs last week',
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
      subClass: 'text-g-600',
    },
    {
      icon: 'indian-rupee',
      label: 'Monthly Revenue',
      value: moneyShort(h.bookings * 45),
      sub: '+8.2% vs last week',
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
      subClass: 'text-g-600',
    },
    {
      icon: 'users',
      label: 'Active Staff',
      value: String(Math.max(8, Math.round(h.bookings / 30))),
      sub: 'Doctors, staff and admins',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'ticket',
      label: 'Booking Quota',
      value: `${quota}%`,
      sub: `${h.bookings.toLocaleString('en-IN')} of ${limit.toLocaleString('en-IN')} bookings used`,
      iconClass: quota >= 90 ? 'bg-badge-noshow-bg text-orange' : 'bg-blue-soft-bg text-blue',
      valueClass: quota >= 90 ? 'text-orange' : 'text-blue',
    },
  ];

  const infoItems: InfoGridItem[] = [
    { k: 'Admin Email', v: h.email },
    { k: 'Phone', v: h.phone, num: true },
    { k: 'Location', v: `${h.city}${h.st ? ', ' + h.st : ''}` },
    { k: 'Plan', v: h.plan },
    { k: 'Onboarded', v: h.onboarded },
    { k: 'Instance ID', v: `MB-HOSP-0${100 + h.id}`, num: true },
    { k: 'GSTIN', v: gstin || 'Not on file', num: Boolean(gstin) },
    {
      k: 'Payout Account',
      v: bank
        ? `${bank.bank} ····${String(bank.account).slice(-4)}`
        : 'Not added — hospital adds it in Hospital Settings',
      num: Boolean(bank),
    },
    { k: 'IFSC', v: bank ? bank.ifsc : '—', num: Boolean(bank) },
    { k: 'Settlement UPI', v: bank && bank.upi ? bank.upi : '—' },
    {
      k: 'Payment Grace',
      v:
        graceDays === undefined
          ? 'Platform default'
          : `${graceDays} day${graceDays === 1 ? '' : 's'}${h.graceDays !== undefined ? ' (set on this hospital)' : ''}`,
    },
    ...(h.status === 'Rejected' && h.rejectReason
      ? [{ k: 'Rejection Reason', v: h.rejectReason }]
      : []),
    ...(h.suspension
      ? [
          { k: 'Suspended Since', v: longDateFromIso(h.suspension.since) },
          { k: 'Suspension Reason', v: h.suspension.reason },
        ]
      : []),
  ];

  const attemptApprove = () => {
    if (!kycReady) {
      toast(
        onboardingDocs
          ? `Cannot approve — ${blockers[0]}`
          : `Cannot approve — ${kycMissing.join(', ')} not received.`,
        'error',
      );
      return;
    }
    setModal('approve');
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-blue-soft-bg text-text-navy flex size-14 flex-none items-center justify-center rounded-lg">
            <Icon name="building-2" size={26} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-3">
              <SectionTitle size={20}>{hospName(h.id)}</SectionTitle>
              <Badge status={h.status} />
            </div>
            <span className="text-caption text-text-muted">
              {h.email} · {h.phone} · {h.city}
              {h.st ? `, ${h.st}` : ''}
            </span>
          </div>
          <div className="flex-1"></div>
          <div className="flex gap-3">
            {h.status === 'Pending verification' ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => {
                    setReason('');
                    setModal('reject');
                  }}
                >
                  Reject
                </Button>
                <Button
                  icon="circle-check"
                  onClick={attemptApprove}
                  className={cn(!kycReady && 'opacity-60')}
                >
                  Approve &amp; Go Live
                </Button>
              </>
            ) : h.status === 'Rejected' ? (
              <Button
                variant="secondary"
                onClick={attemptApprove}
                className={cn(!kycReady && 'opacity-60')}
              >
                Re-review &amp; Approve
              </Button>
            ) : (
              <>
                <Button
                  variant={suspended ? 'secondary' : 'danger'}
                  onClick={() => setModal(suspended ? 'unsuspend' : 'suspend')}
                >
                  {suspended ? 'Reactivate Instance' : 'Suspend Instance'}
                </Button>
                <Button onClick={() => navigate(opsPath('plans'))}>Manage Plan</Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {h.suspension && (
        <Card pad={16} className="border-d-500">
          <div className="flex flex-wrap items-start gap-3.5">
            <div className="bg-d-100 text-d-500 flex size-10 flex-none items-center justify-center rounded-md">
              <Icon name="ban" size={19} />
            </div>
            <div className="min-w-50 flex-1">
              <div className="text-body text-text-strong font-medium">
                Suspended — {h.suspension.reason.toLowerCase()}
              </div>
              <div className="text-caption text-text-muted">
                Since {longDateFromIso(h.suspension.since)} by {h.suspension.by}
                {h.suspension.invoiceNo ? ` · ${h.suspension.invoiceNo}` : ''}
                {h.suspension.note ? ` · ${h.suspension.note}` : ''}
              </div>
              <div className="text-caption text-text-muted mt-1">
                Staff cannot sign in and patients cannot book while this is in force.
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setModal('unsuspend')}>
              Lift Suspension
            </Button>
          </div>
        </Card>
      )}

      {!suspended && grace && oldestUnpaid && (
        <Card pad={16}>
          <div className="flex flex-wrap items-center gap-3.5">
            <div
              className={cn(
                'flex size-10 flex-none items-center justify-center rounded-md',
                grace.expired ? 'bg-d-100 text-d-500' : 'bg-y-100 text-y-600',
              )}
            >
              <Icon name={grace.expired ? 'triangle-alert' : 'hourglass'} size={19} />
            </div>
            <div className="min-w-50 flex-1">
              <div className="text-body text-text-strong font-medium">
                {oldestUnpaid.no} is unpaid ·{' '}
                {grace.expired
                  ? `grace closed ${-grace.daysLeft} day${grace.daysLeft === -1 ? '' : 's'} ago`
                  : `grace ends in ${grace.daysLeft} day${grace.daysLeft === 1 ? '' : 's'}`}
              </div>
              <div className="text-caption text-text-muted">
                {money(oldestUnpaid.amount)} due {oldestUnpaid.due} · {grace.days}-day grace window
                ends {longDateFromIso(grace.endsIso)}
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(billingDetailPath('invoice-detail', oldestUnpaid.id))}
            >
              Open Invoice
            </Button>
          </div>
        </Card>
      )}

      <Card pad={14}>
        <Tabs
          tabs={['Overview', 'Departments', 'Doctors', 'Billing & Settlements', 'Activity']}
          value={tab}
          onChange={setTab}
        />
      </Card>

      {tab === 'Overview' && (
        <>
          <InfoGrid items={infoItems} />
          <Card>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <SectionTitle>Verification &amp; KYC</SectionTitle>
                {onboarding ? (
                  <Badge status={STAGE_BADGE[stageOf(onboarding)]}>{stageOf(onboarding)}</Badge>
                ) : (
                  (h.status === 'Pending verification' || h.status === 'Rejected') && (
                    <Badge status={kycReady ? 'Completed' : 'Pending'}>
                      {kycReady ? 'Ready for review' : 'Documents incomplete'}
                    </Badge>
                  )
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon="rocket"
                onClick={() => navigate(opsOnboardingPath())}
              >
                Review in Onboarding
              </Button>
            </div>
            <div className="text-caption text-text-muted mb-3.5">
              {onboardingDocs
                ? `${progress.approved} of ${progress.total} required documents approved. Each one is approved or rejected individually on the onboarding pipeline.`
                : 'Documents are requested from the admin email at onboarding. Every document must be approved before the instance can go live.'}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {onboardingDocs
                ? onboardingDocs.map((doc) => (
                    <div
                      key={doc.key}
                      className={cn(
                        'flex items-center gap-3 rounded-md border px-3.5 py-3',
                        doc.status === 'Rejected' ? 'border-d-500' : 'border-border-soft',
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-9 flex-none items-center justify-center rounded-md',
                          doc.status === 'Approved'
                            ? 'bg-g-100 text-g-600'
                            : doc.status === 'Rejected'
                              ? 'bg-d-100 text-d-500'
                              : doc.status === 'Uploaded'
                                ? 'bg-y-100 text-y-600'
                                : 'bg-grey-300 text-text-muted',
                        )}
                      >
                        <Icon name="file-text" size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-body text-text-strong font-medium">
                          {ONBOARDING_DOC_LABEL[doc.key]}
                          {!doc.required && (
                            <span className="text-caption text-text-muted font-normal">
                              {' '}
                              (optional)
                            </span>
                          )}
                        </div>
                        <div className="text-caption text-text-muted">
                          {doc.status === 'Requested'
                            ? 'Requested — nothing on file yet'
                            : doc.status === 'Uploaded'
                              ? `On file${doc.uploadedAt ? ` since ${longDateFromIso(doc.uploadedAt)}` : ''} · awaiting review`
                              : `${doc.status} by ${doc.reviewedBy ?? 'operations'}${doc.reviewedAt ? ` · ${doc.reviewedAt}` : ''}`}
                        </div>
                        {doc.status === 'Rejected' && doc.rejectReason && (
                          <div className="text-caption text-d-700">{doc.rejectReason}</div>
                        )}
                      </div>
                      <Badge status={DOC_BADGE[doc.status]}>{doc.status}</Badge>
                    </div>
                  ))
                : KYC_DOCS.map(([k, label]) => {
                    const st = kyc[k];
                    return (
                      <div
                        key={k}
                        className="border-border-soft flex items-center gap-3 rounded-md border px-3.5 py-3"
                      >
                        <div
                          className={cn(
                            'flex size-9 flex-none items-center justify-center rounded-md',
                            st === 'Missing'
                              ? 'bg-d-100 text-d-500'
                              : 'bg-blue-soft-bg text-text-navy',
                          )}
                        >
                          <Icon name="file-text" size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-body text-text-strong font-medium">{label}</div>
                          <div className="text-caption text-text-muted">
                            {st === 'Missing'
                              ? 'Not received'
                              : st === 'Submitted'
                                ? 'Received · awaiting review'
                                : 'Verified at approval'}
                          </div>
                        </div>
                        <Badge status={st} />
                      </div>
                    );
                  })}
            </div>
            {onboardingDocs && blockers.length > 0 && (
              <ul className="mt-3.5 flex list-none flex-col gap-1.5 p-0">
                {blockers.map((b) => (
                  <li key={b} className="text-body text-text-body flex items-start gap-2">
                    <Icon name="circle-alert" size={15} className="text-y-600 mt-0.5 flex-none" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KPIS.map((k) => (
              <StatCard key={k.label} k={k} />
            ))}
          </div>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <SectionTitle>Recent Bookings</SectionTitle>
              <span className="text-caption text-text-muted">
                {h.name === 'Apollo Hospital'
                  ? 'Live from the hospital instance'
                  : 'Synced from the hospital instance'}
              </span>
            </div>
            <TableShell columns={['Patient', 'Department', 'Date', 'Status']}>
              {opsBookingsFor(h).map((b) => (
                <tr key={b.id}>
                  <td className={tdClass}>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={b.patient} size={30} />
                      <span className="text-text-strong font-medium">{b.patient}</span>
                    </div>
                  </td>
                  <td className={tdClass}>{b.department}</td>
                  <td className={tdClass}>{b.date}</td>
                  <td className={tdClass}>
                    <Badge status={b.status} />
                  </td>
                </tr>
              ))}
            </TableShell>
          </Card>
        </>
      )}

      {tab === 'Departments' && (
        <Card>
          <div className="mb-1 flex items-center gap-2.5">
            <SectionTitle>Departments &amp; Doctors</SectionTitle>
            <Badge status="Info">Read-only</Badge>
          </div>
          <div className="text-caption text-text-muted mb-3.5">
            {h.name === 'Apollo Hospital'
              ? "Live from the hospital's mbAdmin catalog — the hospital manages departments, doctors, fees and schedules itself."
              : "Synced from the hospital's mbAdmin catalog. Hospitals manage their own departments, doctors, fees and schedules."}
          </div>
          <TableShell
            columns={['Department', 'Doctors', 'Base Fee', 'Working Hours', 'Status']}
            rightCols={['Doctors', 'Base Fee']}
          >
            {depts.map((d) => (
              <tr key={d.name}>
                <td className={cn(tdClass, 'text-text-strong font-medium')}>{d.name}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{d.docs}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{money(d.fee)}</td>
                <td className={tdClass}>{d.hours}</td>
                <td className={tdClass}>
                  <Badge status={d.status} />
                </td>
              </tr>
            ))}
          </TableShell>
          <div className="text-caption text-text-muted mt-3">
            {depts.length} departments · {depts.reduce((a, d) => a + d.docs, 0)} doctors on the
            roster
          </div>
        </Card>
      )}

      {tab === 'Doctors' && (
        <Card>
          <div className="mb-1 flex items-center gap-2.5">
            <SectionTitle>Doctors Roster</SectionTitle>
            <Badge status="Info">Read-only</Badge>
          </div>
          <div className="text-caption text-text-muted mb-3.5">
            {h.name === 'Apollo Hospital'
              ? "Live from the hospital's mbAdmin catalog — schedules, fees and leave are managed by the hospital."
              : "Synced from the hospital's mbAdmin catalog — schedules, fees and leave are managed by the hospital."}
          </div>
          <div className="mb-4.5 flex flex-wrap items-center gap-3">
            <FilterSelect
              value={docDeptF}
              aria-label="Filter the roster by department"
              options={['All', ...opsDeptsFor(h).map((d) => d.name)].map((x) =>
                x === 'All' ? 'Dept: All' : x,
              )}
              onChange={(v) => setDocDeptF(v === 'Dept: All' ? 'All' : v)}
            />
            {docDeptF !== 'All' && (
              <span
                onClick={() => setDocDeptF('All')}
                className="text-body text-blue cursor-pointer"
              >
                Clear
              </span>
            )}
            <div className="flex-1"></div>
            <span className="text-caption text-text-muted">
              {docs.length} of {allDocs.length} doctors
            </span>
          </div>
          <TableShell
            columns={['Doctor', 'Department', 'Room', 'Fee', 'Rating', 'Availability', 'Status']}
            rightCols={['Fee']}
            sortKeys={{
              Doctor: 'name',
              Department: 'dept',
              Room: 'room',
              Fee: 'fee',
              Rating: 'rating',
              Status: 'status',
            }}
            sort={dSort}
            onSort={dOnSort}
          >
            {docs.map((d, i) => (
              <tr key={`${d.name}-${d.room}-${i}`}>
                <td className={tdClass}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={d.name} size={32} />
                    <div>
                      <div className="text-body text-text-strong font-medium">{d.name}</div>
                      <div className="text-caption text-text-muted">{d.spec}</div>
                    </div>
                  </div>
                </td>
                <td className={tdClass}>{d.dept}</td>
                <td className={cn(tdClass, 'tabular-nums')}>{d.room}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{money(d.fee)}</td>
                <td className={tdClass}>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="star" size={13} className="text-y-500" />
                    <span className="tabular-nums">{d.rating}</span>
                  </span>
                </td>
                <td className={tdClass}>
                  {d.days} days/wk
                  {d.leave && (
                    <div className="text-caption text-y-700">
                      On leave {d.leave.from} – {d.leave.to}
                    </div>
                  )}
                </td>
                <td className={tdClass}>
                  <Badge status={d.status} />
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>
      )}

      {tab === 'Billing & Settlements' && (
        <>
          <Card pad={16} className="flex flex-wrap items-center gap-3.5">
            <div className="bg-blue-soft-bg text-text-navy flex size-10 flex-none items-center justify-center rounded-md">
              <Icon name="layers" size={19} />
            </div>
            <div className="min-w-50 flex-1">
              <div className="text-body text-text-strong font-medium">
                {h.plan} · <span className="tabular-nums">{money(planPrice)}</span>/mo
              </div>
              <div className="text-caption text-text-muted">
                {h.bookings.toLocaleString('en-IN')} of {limit.toLocaleString('en-IN')} monthly
                bookings used ({quota}%)
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate(opsPath('plans'))}>
              Plan Catalog
            </Button>
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <SectionTitle>Invoices</SectionTitle>
              <span
                onClick={() => navigate(`${opsPath('billing')}?tab=Invoices`)}
                className="text-body text-blue cursor-pointer font-medium"
              >
                Open Billing
              </span>
            </div>
            {invs.length ? (
              <TableShell
                columns={['Invoice', 'Amount', 'Issued', 'Due', 'Status', '']}
                rightCols={['Amount']}
              >
                {invs.map((v) => (
                  <tr key={v.id}>
                    <td className={cn(tdClass, 'text-text-strong font-medium tabular-nums')}>
                      {v.no}
                    </td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{money(v.amount)}</td>
                    <td className={tdClass}>{v.issued}</td>
                    <td className={tdClass}>{v.due}</td>
                    <td className={tdClass}>
                      <Badge status={v.status} />
                    </td>
                    <td className={tdClass}>
                      <IconBtn
                        name="eye"
                        label="View invoice"
                        box={36}
                        size={16}
                        title={`Open ${v.no}`}
                        onClick={() => navigate(billingDetailPath('invoice-detail', v.id))}
                      />
                    </td>
                  </tr>
                ))}
              </TableShell>
            ) : (
              <EmptyState
                icon="file-text"
                compact
                title="No invoices issued to this hospital yet."
                message="Subscription invoices appear here once a billing cycle has been run for this instance."
                actionLabel="Open billing"
                onAction={() => navigate(`${opsPath('billing')}?tab=Invoices`)}
              />
            )}
          </Card>
          <Card>
            <SectionTitle className="mb-4">Payment Transactions</SectionTitle>
            {pays.length ? (
              <TableShell
                columns={['Transaction', 'Invoice', 'Method', 'Amount', 'Date', 'Status', '']}
                rightCols={['Amount']}
              >
                {pays.map((v) => (
                  <tr key={v.id}>
                    <td className={cn(tdClass, 'text-text-strong font-medium tabular-nums')}>
                      {v.txn}
                    </td>
                    <td className={cn(tdClass, 'tabular-nums')}>{v.inv}</td>
                    <td className={tdClass}>{v.method}</td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{money(v.amount)}</td>
                    <td className={tdClass}>{v.date}</td>
                    <td className={tdClass}>
                      <Badge status={v.status} />
                    </td>
                    <td className={tdClass}>
                      <IconBtn
                        name="eye"
                        label="View payment"
                        box={36}
                        size={16}
                        title={`Open ${v.txn}`}
                        onClick={() => navigate(billingDetailPath('payment-detail', v.id))}
                      />
                    </td>
                  </tr>
                ))}
              </TableShell>
            ) : (
              <EmptyState
                icon="indian-rupee"
                compact
                title="No payment transactions recorded yet."
                message="Gateway payments and payments recorded by operations both appear here."
                actionLabel="Open payments"
                onAction={() => navigate(`${opsPath('billing')}?tab=Payments`)}
              />
            )}
          </Card>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <SectionTitle>Settlements</SectionTitle>
              <span
                onClick={() => navigate(opsPath('settlements'))}
                className="text-body text-blue cursor-pointer font-medium"
              >
                Open Hospital Settlements
              </span>
            </div>
            {setts.length ? (
              <TableShell
                columns={['Statement', 'Net Payable', 'Expected', 'Status']}
                rightCols={['Net Payable']}
              >
                {setts.map((r) => (
                  <tr key={r.id}>
                    <td className={cn(tdClass, 'text-text-strong font-medium')}>
                      {r.id}
                      <div className="text-caption text-text-muted font-normal">{r.period}</div>
                    </td>
                    <td className={cn(tdClass, 'text-right tabular-nums')}>{money(r.net)}</td>
                    <td className={tdClass}>{fmtDate(r.expected)}</td>
                    <td className={tdClass}>
                      <Badge status={r.status} />
                      {r.utr && (
                        <div className="text-caption text-text-muted mt-1 tabular-nums">
                          {r.utr}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </TableShell>
            ) : (
              <EmptyState
                icon="banknote"
                compact
                title="No settlement statements for this hospital yet."
                message="Statements are generated per payout run once the hospital takes online bookings."
                actionLabel="Open hospital settlements"
                onAction={() => navigate(opsPath('settlements'))}
              />
            )}
          </Card>
        </>
      )}

      {tab === 'Activity' && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Compliance Activity</SectionTitle>
            <span
              onClick={() => navigate(opsPath('logs'))}
              className="text-body text-blue cursor-pointer font-medium"
            >
              Open Compliance Logs
            </span>
          </div>
          {acts.length ? (
            <TableShell columns={['Action', 'Module', 'Timestamp', 'Severity']}>
              {acts.map((l) => (
                <tr key={l.id}>
                  <td className={cn(tdClass, 'text-text-strong font-medium')}>
                    {l.action}
                    <div className="text-caption text-text-muted font-normal">{l.actor}</div>
                  </td>
                  <td className={tdClass}>{l.module}</td>
                  <td className={tdClass}>{l.time}</td>
                  <td className={tdClass}>
                    <Badge status={l.sev} />
                  </td>
                </tr>
              ))}
            </TableShell>
          ) : (
            <EmptyState
              icon="scroll-text"
              title={`No logged actions reference ${h.name} yet.`}
              message="Approvals, suspensions, document decisions and settlement releases all appear here."
              actionLabel="Open compliance logs"
              onAction={() => navigate(opsPath('logs'))}
            />
          )}
        </Card>
      )}

      <OpsConfirm
        open={modal === 'approve'}
        onClose={() => setModal(null)}
        icon="circle-check"
        tone="success"
        title="Approve this hospital?"
        body={`${h.name} goes live immediately and can start taking bookings on Medibook.`}
        confirmLabel={busy.approve ? 'Approving…' : 'Approve & Go Live'}
        confirmVariant="primary"
        busy={busy.approve}
        onConfirm={() =>
          run('approve', `${h.name} approved and live.`, () => {
            // With an onboarding case, go-live runs through it so the case and
            // the registry cannot disagree; older rows approve directly.
            if (onboarding && onboarding.docs.length > 0) {
              if (!goLive(h.id)) {
                toast('Something is still blocking go-live — check the KYC list.', 'error');
                return;
              }
            } else {
              approve(h.id);
            }
            setModal(null);
          })
        }
      />
      <OpsConfirm
        open={modal === 'suspend'}
        onClose={() => setModal(null)}
        icon="ban"
        tone="danger"
        title="Suspend this hospital?"
        body={`${h.name}'s staff lose access to Medibook immediately and patients can no longer book appointments there. Existing bookings are kept. Reactivation is a separate action.`}
        summary={[
          { k: 'Hospital', v: h.name },
          { k: 'Plan', v: h.plan },
          { k: 'Bookings this month', v: h.bookings.toLocaleString('en-IN'), num: true },
          { k: 'Reason recorded', v: 'Manual review' },
        ]}
        confirmLabel={busy.suspend ? 'Suspending…' : 'Suspend Instance'}
        confirmVariant="danger"
        busy={busy.suspend}
        onConfirm={() =>
          run('suspend', `${h.name} suspended.`, () => {
            suspendHospital(h.id, {
              reason: 'Manual review',
              note: 'Suspended from the hospital profile by operations.',
            });
            setModal(null);
          })
        }
      />
      <OpsConfirm
        open={modal === 'unsuspend'}
        onClose={() => setModal(null)}
        icon="circle-check"
        tone="success"
        title="Reactivate this hospital?"
        body={`${h.name} regains access immediately and can take new bookings right away.${
          h.suspension?.reason === 'Non-payment'
            ? ' Its unpaid invoice stays unpaid — record the payment on the invoice as well.'
            : ''
        }`}
        confirmLabel={busy.unsuspend ? 'Reactivating…' : 'Reactivate'}
        busy={busy.unsuspend}
        onConfirm={() =>
          run('unsuspend', `${h.name} reactivated.`, () => {
            unsuspendHospital(h.id);
            setModal(null);
          })
        }
      />
      {modal === 'reject' && (
        <div
          onClick={() => setModal(null)}
          className="animate-fade-in bg-text-strong/45 fixed inset-0 z-50 flex items-center justify-center p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-pop-in shadow-pop flex w-112 max-w-full flex-col gap-4 rounded-xl bg-white p-6"
          >
            <div className="flex items-center gap-3">
              <div className="bg-d-100 text-d-500 flex size-11 flex-none items-center justify-center rounded-md">
                <Icon name="ban" size={20} />
              </div>
              <SectionTitle size={20}>Reject this hospital?</SectionTitle>
            </div>
            <OpsField label="Reason for rejection" required>
              <Select
                value={reason}
                placeholder="Select a reason"
                options={[
                  'Incomplete KYC documents',
                  'Invalid GST or licence details',
                  'Failed physical verification',
                  'Duplicate registration',
                ]}
                onChange={setReason}
                height={48}
              />
            </OpsField>
            <p className="text-body text-text-muted m-0">
              <b className="text-text-strong font-medium">{h.name}</b> is notified by email and
              cannot take bookings. This decision is final.
            </p>
            <div className="border-border-soft flex justify-end gap-3 border-t pt-4">
              <Button variant="secondary" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={
                  !reason || busy.reject
                    ? undefined
                    : () =>
                        run('reject', `${h.name} rejected. The hospital has been notified.`, () => {
                          reject(h.id, reason);
                          setModal(null);
                        })
                }
                className={cn((!reason || busy.reject) && 'cursor-not-allowed opacity-50')}
              >
                {busy.reject ? 'Rejecting…' : 'Reject Hospital'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
