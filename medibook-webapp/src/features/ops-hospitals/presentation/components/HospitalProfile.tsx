import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { opsOnboardingPath, opsPath } from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
import { money } from '@/shared/lib/format';
import { toast } from '@/shared/ui/toast/toast.store';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { InfoGrid, type InfoGridItem } from '@/shared/ui/InfoGrid';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { StatCard, type StatCardData } from '@/shared/ui/StatCard';
import { Tabs } from '@/shared/ui/Tabs';

import { BillingHospitalCard } from '@/features/ops-billing/presentation/components/BillingHospitalCard';
import { LogsHospitalActivityCard } from '@/features/ops-logs/presentation/components/LogsHospitalActivityCard';
import { OpsSettlementsHospitalCard } from '@/features/ops-settlements/presentation/components/OpsSettlementsHospitalCard';
import { usePlansQuery } from '@/features/ops-plans/application/queries/usePlansQuery';
import { useReinstateHospitalMutation } from '@/features/ops-hospitals/application/queries/useReinstateHospitalMutation';
import { useSuspendHospitalMutation } from '@/features/ops-hospitals/application/queries/useSuspendHospitalMutation';
import { HospitalCommercialTermsCard } from '@/features/ops-hospitals/presentation/components/HospitalCommercialTermsCard';
import { HospitalEditProfileModal } from '@/features/ops-hospitals/presentation/components/HospitalEditProfileModal';
import { HospitalPatientAccessCard } from '@/features/ops-hospitals/presentation/components/HospitalPatientAccessCard';
import { longDateFromTimestamp } from '@/features/ops-hospitals/presentation/components/hospitals.dates';
import type {
  HospitalUsageMeter,
  PlatformHospitalDetail,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';

import {
  GO_LIVE_BLOCKER_FALLBACK,
  GO_LIVE_BLOCKER_LABEL,
  HOSPITAL_STATUS_VIEW,
  ONBOARDING_STAGE_VIEW,
  SUSPENSION_REASON_LABEL,
  isHospitalPending,
} from '@/features/ops-hospitals/presentation/components/hospitals.view';

/** Which dialog is open. */
type DetailModal = 'suspend' | 'unsuspend' | 'edit' | null;

const TABS = ['Overview', 'Billing & Settlements', 'Activity'] as const;

/** Storage usage arrives in bytes; plan limits are whole GB (backend `limits.GB`). */
const BYTES_PER_GB = 1024 ** 3;

/** A suspension applied from this page is recorded as a manual review. */
const MANUAL_SUSPENSION_NOTE = 'Suspended from the hospital profile by operations.';

/** Shown where the platform API has no value for a field. */
const NOT_AVAILABLE = 'Not available on the platform yet';

const ACTION_FAILED_MESSAGE = 'That did not go through. Please try again.';

function usageValue(
  meter: HospitalUsageMeter | undefined,
  format: (n: number) => string = String,
): string {
  if (!meter) return '—';
  return meter.limit === null
    ? format(meter.current)
    : `${format(meter.current)} / ${format(meter.limit)}`;
}

function usageSub(meter: HospitalUsageMeter | undefined, noun: string): string {
  if (!meter) return 'No plan usage recorded';
  if (meter.limit === null) return `Unlimited ${noun} on this plan`;
  const pct = meter.limit === 0 ? 100 : Math.round((meter.current / meter.limit) * 100);
  return `${pct}% of the plan's ${noun}${meter.hard ? ' · hard cap' : ''}`;
}

const gb = (bytes: number): string => `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;

/**
 * One hospital's platform profile (design `OpsHospitalDetail`): header and
 * lifecycle actions, suspension notice, profile, onboarding progress and plan
 * usage. Suspend / reactivate call their own action endpoints. Edit Profile
 * (`PATCH /platform/hospitals/{id}`), the patient-app switches
 * (`set-visibility`, `online_booking_enabled`) and the commercial terms
 * (`set-commission`, `set-convenience-fee`) keep a live hospital correct.
 *
 * Approve, reject and the KYC review belong to the onboarding pipeline (P3);
 * a pending hospital is sent there. Departments, doctors and bookings have no
 * platform endpoint. Invoices, payments, settlements and activity are this
 * hospital's latest rows from the billing, settlements and logs modules.
 */
interface HospitalProfileProps {
  h: PlatformHospitalDetail;
}

export function HospitalProfile({ h }: HospitalProfileProps) {
  const navigate = useNavigate();
  const plansQuery = usePlansQuery();
  const suspendMutation = useSuspendHospitalMutation();
  const reinstateMutation = useReinstateHospitalMutation();

  const [modal, setModal] = useState<DetailModal>(null);
  const [tab, setTab] = useState<string>('Overview');

  const plan = h.subscription
    ? (plansQuery.data?.find((p) => p.id === h.subscription?.planId) ?? null)
    : null;
  const planLabel = h.subscription
    ? (plan?.name ?? h.subscription.planCode)
    : 'No active subscription';
  const [statusBadge, statusLabel] = HOSPITAL_STATUS_VIEW[h.status];
  const isPending = isHospitalPending(h.status);
  const isSuspended = h.status === 'suspended';
  const suspension = h.activeSuspensions[0] ?? null;
  const location = `${h.city}${h.state ? `, ${h.state}` : ''}`;
  const stage = h.onboarding ? ONBOARDING_STAGE_VIEW[h.onboarding.stage] : null;

  const failToast = (error: unknown) =>
    toast(isFailure(error) ? error.message : ACTION_FAILED_MESSAGE, 'error');

  const handleSuspend = () =>
    suspendMutation.mutate(
      { id: h.id, reason: 'manual', note: MANUAL_SUSPENSION_NOTE },
      {
        onSuccess: () => {
          toast(`${h.name} suspended.`, 'success');
          setModal(null);
        },
        onError: failToast,
      },
    );

  const handleReinstate = () =>
    reinstateMutation.mutate(h.id, {
      onSuccess: () => {
        toast(`${h.name} reactivated.`, 'success');
        setModal(null);
      },
      onError: failToast,
    });

  const KPIS: readonly StatCardData[] = [
    {
      icon: 'users',
      label: 'Active Staff',
      value: h.staffCount.toLocaleString('en-IN'),
      sub: 'Doctors, staff and admins',
      iconClass: 'bg-blue-soft-bg text-blue',
      valueClass: 'text-blue',
    },
    {
      icon: 'user-check',
      label: 'Staff Seats',
      value: usageValue(h.usage.users),
      sub: usageSub(h.usage.users, 'staff seats'),
      iconClass: 'bg-blue-soft-bg text-text-navy',
      valueClass: 'text-text-navy',
    },
    {
      icon: 'stethoscope',
      label: 'Doctors',
      value: usageValue(h.usage.doctors),
      sub: usageSub(h.usage.doctors, 'doctor limit'),
      iconClass: 'bg-g-100 text-g-600',
      valueClass: 'text-g-600',
    },
    {
      icon: 'layers',
      label: 'Storage',
      value: usageValue(h.usage.storage, gb),
      sub: usageSub(h.usage.storage, 'storage'),
      iconClass: 'bg-y-100 text-y-600',
      valueClass: 'text-y-600',
    },
  ];

  const infoItems: InfoGridItem[] = [
    { k: 'Email', v: h.email },
    { k: 'Phone', v: h.phone, num: true },
    { k: 'Location', v: location },
    { k: 'Plan', v: planLabel },
    { k: 'Onboarded', v: longDateFromTimestamp(h.createdAt) },
    { k: 'Live Since', v: h.goLiveAt ? longDateFromTimestamp(h.goLiveAt) : 'Not live yet' },
    { k: 'Instance ID', v: h.slug, num: true },
    { k: 'Legal Name', v: h.legalName || '—' },
    { k: 'GSTIN', v: h.gstin || 'Not on file', num: Boolean(h.gstin) },
    { k: 'Registration No.', v: h.registrationNo || 'Not on file' },
    { k: 'Payout Account', v: NOT_AVAILABLE },
    { k: 'Payment Grace', v: NOT_AVAILABLE },
    ...(suspension
      ? [
          { k: 'Suspended Since', v: longDateFromTimestamp(suspension.suspendedAt) },
          { k: 'Suspension Reason', v: SUSPENSION_REASON_LABEL[suspension.reason] },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-blue-soft-bg text-text-navy flex size-14 flex-none items-center justify-center rounded-lg">
            <Icon name="building-2" size={26} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-3">
              <SectionTitle size={20}>{h.name}</SectionTitle>
              <Badge status={statusBadge}>{statusLabel}</Badge>
            </div>
            <span className="text-caption text-text-muted">
              {h.email} · {h.phone} · {location}
            </span>
          </div>
          <div className="flex-1"></div>
          <div className="flex flex-wrap gap-3">
            {h.status !== 'closed' && (
              <Button variant="secondary" icon="pencil" onClick={() => setModal('edit')}>
                Edit Profile
              </Button>
            )}
            {isPending ? (
              <Button icon="rocket" onClick={() => navigate(opsOnboardingPath())}>
                Review in Onboarding
              </Button>
            ) : h.status === 'closed' ? null : (
              <>
                <Button
                  variant={isSuspended ? 'secondary' : 'danger'}
                  onClick={() => setModal(isSuspended ? 'unsuspend' : 'suspend')}
                >
                  {isSuspended ? 'Reactivate Instance' : 'Suspend Instance'}
                </Button>
                <Button onClick={() => navigate(opsPath('plans'))}>Manage Plan</Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {isSuspended && (
        <Card pad={16} className="border-d-500">
          <div className="flex flex-wrap items-start gap-3.5">
            <div className="bg-d-100 text-d-500 flex size-10 flex-none items-center justify-center rounded-md">
              <Icon name="ban" size={19} />
            </div>
            <div className="min-w-50 flex-1">
              <div className="text-body text-text-strong font-medium">
                Suspended
                {suspension ? ` — ${SUSPENSION_REASON_LABEL[suspension.reason].toLowerCase()}` : ''}
              </div>
              {suspension && (
                <div className="text-caption text-text-muted">
                  Since {longDateFromTimestamp(suspension.suspendedAt)}
                </div>
              )}
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

      <Card pad={14}>
        <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      </Card>

      {tab === 'Overview' && (
        <>
          <InfoGrid items={infoItems} />
          <HospitalPatientAccessCard h={h} />
          <Card>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <SectionTitle>Verification &amp; KYC</SectionTitle>
                {stage && <Badge status={stage[0]}>{stage[1]}</Badge>}
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
              {!h.onboarding
                ? 'This hospital has no onboarding case.'
                : h.goLiveBlockers.length > 0
                  ? 'Documents are reviewed one by one on the onboarding pipeline. These items still block go-live:'
                  : isPending
                    ? 'Nothing is blocking go-live. Approve the instance on the onboarding pipeline.'
                    : 'Onboarding is complete.'}
            </div>
            {h.goLiveBlockers.length > 0 && (
              <ul className="flex list-none flex-col gap-1.5 p-0">
                {h.goLiveBlockers.map((b) => (
                  <li key={b.code} className="text-body text-text-body flex items-start gap-2">
                    <Icon name="circle-alert" size={15} className="text-y-600 mt-0.5 flex-none" />
                    <span>
                      {GO_LIVE_BLOCKER_LABEL[b.code] ?? GO_LIVE_BLOCKER_FALLBACK}
                      {b.details.length > 0 && (
                        <span className="text-caption text-text-muted">
                          {' '}
                          ({b.details.join(', ')})
                        </span>
                      )}
                    </span>
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
        </>
      )}

      {tab === 'Billing & Settlements' && (
        <>
          <Card pad={16} className="flex flex-wrap items-center gap-3.5">
            <div className="bg-blue-soft-bg text-text-navy flex size-10 flex-none items-center justify-center rounded-md">
              <Icon name="layers" size={19} />
            </div>
            <div className="min-w-50 flex-1">
              <div className="text-body text-text-strong font-medium">
                {planLabel}
                {plan && (
                  <>
                    {' '}
                    · <span className="tabular-nums">{money(plan.priceMonthly)}</span>/mo
                  </>
                )}
              </div>
              <div className="text-caption text-text-muted">
                {h.subscription
                  ? `${h.subscription.status} · billed ${h.subscription.billingPeriod}${
                      h.subscription.currentPeriodEnd
                        ? ` · period ends ${longDateFromTimestamp(h.subscription.currentPeriodEnd)}`
                        : ''
                    }`
                  : 'This hospital has no current subscription.'}
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate(opsPath('plans'))}>
              Plan Catalog
            </Button>
          </Card>
          <HospitalCommercialTermsCard h={h} />
          <BillingHospitalCard hospitalId={h.id} />
          <OpsSettlementsHospitalCard hospitalId={h.id} />
        </>
      )}

      {tab === 'Activity' && <LogsHospitalActivityCard hospitalId={h.id} />}

      {modal === 'edit' && <HospitalEditProfileModal h={h} onClose={() => setModal(null)} />}
      <OpsConfirm
        open={modal === 'suspend'}
        onClose={() => setModal(null)}
        icon="ban"
        tone="danger"
        title="Suspend this hospital?"
        body={`${h.name}'s staff lose access to Medibook immediately and patients can no longer book appointments there. Existing bookings are kept. Reactivation is a separate action.`}
        summary={[
          { k: 'Hospital', v: h.name },
          { k: 'Plan', v: planLabel },
          { k: 'Active staff', v: h.staffCount.toLocaleString('en-IN'), num: true },
          { k: 'Reason recorded', v: SUSPENSION_REASON_LABEL.manual },
        ]}
        confirmLabel={suspendMutation.isPending ? 'Suspending…' : 'Suspend Instance'}
        confirmVariant="danger"
        busy={suspendMutation.isPending}
        onConfirm={handleSuspend}
      />
      <OpsConfirm
        open={modal === 'unsuspend'}
        onClose={() => setModal(null)}
        icon="circle-check"
        tone="success"
        title="Reactivate this hospital?"
        body={`${h.name} regains access immediately and can take new bookings right away.${
          suspension?.reason === 'non_payment' || suspension?.reason === 'non_payment_read_only'
            ? ' Its unpaid invoice stays unpaid — record the payment on the invoice as well.'
            : ''
        }`}
        confirmLabel={reinstateMutation.isPending ? 'Reactivating…' : 'Reactivate'}
        busy={reinstateMutation.isPending}
        onConfirm={handleReinstate}
      />
    </div>
  );
}
