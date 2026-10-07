import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { isFailure } from '@/core/error/failure';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { money } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { InfoGrid, type InfoGridItem } from '@/shared/ui/InfoGrid';
import { OpsConfirm } from '@/shared/ui/OpsConfirm';
import { OpsField } from '@/shared/ui/OpsField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Select } from '@/shared/ui/Select';
import { StatCard, type StatCardData } from '@/shared/ui/StatCard';
import { Tabs } from '@/shared/ui/Tabs';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import {
  opsBillingForHospitalPath,
  opsOnboardingCasePath,
  opsOnboardingPath,
  opsPath,
} from '@/app/router/paths';

import { BillingHospitalCard } from '@/features/ops-billing/presentation/components/BillingHospitalCard';
import { ChangeSubscriptionModal } from '@/features/ops-billing/presentation/components/ChangeSubscriptionModal';
import { LogsHospitalActivityCard } from '@/features/ops-logs/presentation/components/LogsHospitalActivityCard';
import { OpsSettlementsHospitalCard } from '@/features/ops-settlements/presentation/components/OpsSettlementsHospitalCard';
import { usePlansQuery } from '@/features/ops-plans/application/queries/usePlansQuery';
import type {
  HospitalSuspendReason,
  HospitalUsageMeter,
  PlatformHospitalDetail,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { useReinstateHospitalMutation } from '@/features/ops-hospitals/application/queries/useReinstateHospitalMutation';
import { useSuspendHospitalMutation } from '@/features/ops-hospitals/application/queries/useSuspendHospitalMutation';
import { FirstAdminInvitationCard } from '@/features/ops-hospitals/presentation/components/FirstAdminInvitationCard';
import { HospitalBankAccountsCard } from '@/features/ops-hospitals/presentation/components/HospitalBankAccountsCard';
import { HospitalCommercialTermsCard } from '@/features/ops-hospitals/presentation/components/HospitalCommercialTermsCard';
import { HospitalEditProfileModal } from '@/features/ops-hospitals/presentation/components/HospitalEditProfileModal';
import { HospitalNumberingCard } from '@/features/ops-hospitals/presentation/components/HospitalNumberingCard';
import { HospitalPatientAccessCard } from '@/features/ops-hospitals/presentation/components/HospitalPatientAccessCard';
import { HospitalTokenPolicyCard } from '@/features/ops-hospitals/presentation/components/HospitalTokenPolicyCard';
import { longDateFromTimestamp } from '@/features/ops-hospitals/presentation/components/hospitals.dates';
import {
  GO_LIVE_BLOCKER_FALLBACK,
  GO_LIVE_BLOCKER_LABEL,
  ONBOARDING_STAGE_VIEW,
  SUSPEND_REASON_OPTIONS,
  SUSPENSION_REASON_LABEL,
  hospitalStatusView,
  isHospitalPending,
  isRejectedApplication,
  reactivateCopy,
  suspendCopy,
} from '@/features/ops-hospitals/presentation/components/hospitals.view';

/** Which dialog is open. */
type DetailModal = 'suspend' | 'unsuspend' | 'edit' | 'plan' | null;

const TAB_OVERVIEW = 'Overview';
const TAB_BILLING = 'Billing & Settlements';
const TAB_SETUP = 'Numbering & Tokens';
const TAB_ACTIVITY = 'Activity';

/** Storage usage arrives in bytes; plan limits are whole GB (backend `limits.GB`). */
const BYTES_PER_GB = 1024 ** 3;

/** The suspension note the backend accepts (`PlatformHospitalSuspendSerializer`). */
const SUSPEND_NOTE_MAX = 2000;

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

/** The masked primary payout account, as one line for the profile grid. */
function payoutAccountCopy(h: PlatformHospitalDetail): string {
  if (h.bankAccounts === null) return 'See Billing & Settlements';
  const primary = h.bankAccounts.find((a) => a.isPrimary);
  if (!primary) return 'No payout account yet';
  return `${primary.bankName} ${primary.accountNumberMasked}${primary.verifiedAt ? ' · verified' : ' · not verified'}`;
}

/**
 * One hospital's platform profile (design `OpsHospitalDetail`): header and
 * lifecycle actions, suspension notice, profile, onboarding progress, the
 * first administrator and plan usage. Suspend (with a reason, UAT-58) and
 * reactivate call their own action endpoints. Edit Profile, the patient-app
 * switches and the commercial terms keep a live hospital correct; "Manage
 * Plan" changes this hospital's subscription with proration (10·R9).
 *
 * Every tab, card and button is shown only to roles whose permission its
 * endpoint enforces (UAT-59, SEC-05): billing tables need `billing.view`,
 * settlements `settlements.view`, activity `logs.view`, numbering and token
 * policy `hospitals.edit`, the onboarding link `onboarding.view`.
 */
interface HospitalProfileProps {
  h: PlatformHospitalDetail;
}

export function HospitalProfile({ h }: HospitalProfileProps) {
  const navigate = useNavigate();
  const { can } = useOpsPermission();
  // The plan price comes from the catalog (`plans.view`); without it the profile shows the plan name only.
  const plansQuery = usePlansQuery(can('plans.view'));
  const suspendMutation = useSuspendHospitalMutation();
  const reinstateMutation = useReinstateHospitalMutation();
  // SEC-05: suspending, reactivating and editing a hospital need hospitals.edit.
  const canEditHospital = can('hospitals.edit');
  const canBillingView = can('billing.view');
  const canSettlementsView = can('settlements.view');
  const canOnboarding = can('onboarding.view');

  const [modal, setModal] = useState<DetailModal>(null);
  const [tab, setTab] = useState<string>(TAB_OVERVIEW);
  const [suspendReason, setSuspendReason] = useState<HospitalSuspendReason>('manual');
  const [suspendNote, setSuspendNote] = useState('');

  const plan = h.subscription
    ? (plansQuery.data?.find((p) => p.id === h.subscription?.planId) ?? null)
    : null;
  const planLabel = h.subscription
    ? (h.subscription.planName ?? plan?.name ?? h.subscription.planCode ?? 'Current plan')
    : 'No active subscription';
  const isYearly = h.subscription?.billingPeriod === 'yearly';
  const planPrice = plan ? (isYearly ? plan.priceYearly : plan.priceMonthly) : null;
  const [statusBadge, statusLabel] = hospitalStatusView({
    status: h.status,
    suspensionReason: h.activeSuspensions[0]?.reason ?? null,
    onboardingStage: h.onboarding?.stage ?? null,
  });
  const isPending = isHospitalPending(h.status);
  const isSuspended = h.status === 'suspended';
  const isRejected = isRejectedApplication(h);
  const suspension = h.activeSuspensions[0] ?? null;
  const location = `${h.city}${h.state ? `, ${h.state}` : ''}`;
  const stage = h.onboarding ? ONBOARDING_STAGE_VIEW[h.onboarding.stage] : null;
  const caseId = h.onboarding?.id ?? null;
  const onboardingHref = caseId ? opsOnboardingCasePath(caseId) : opsOnboardingPath();
  const adminAccepted = !h.goLiveBlockers.some((b) => b.code === 'no_admin_accepted');

  const tabs = [
    TAB_OVERVIEW,
    TAB_BILLING,
    ...(canEditHospital ? [TAB_SETUP] : []),
    ...(can('logs.view') ? [TAB_ACTIVITY] : []),
  ];
  const activeTab = tabs.includes(tab) ? tab : TAB_OVERVIEW;

  const failToast = (error: unknown) =>
    toast(isFailure(error) ? error.message : ACTION_FAILED_MESSAGE, 'error');

  const openSuspend = () => {
    setSuspendReason('manual');
    setSuspendNote('');
    setModal('suspend');
  };

  const handleSuspend = () =>
    suspendMutation.mutate(
      { id: h.id, reason: suspendReason, note: suspendNote.trim() || null },
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
      sub: 'Staff and admin sign-ins (doctors do not sign in)',
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
    { k: 'Time zone', v: h.timezone ?? '—' },
    { k: 'Plan', v: planLabel },
    { k: 'Subscription', v: h.subscription ? h.subscription.status.replace('_', ' ') : '—' },
    { k: 'Onboarded', v: longDateFromTimestamp(h.createdAt) },
    { k: 'Live Since', v: h.goLiveAt ? longDateFromTimestamp(h.goLiveAt) : 'Not live yet' },
    { k: 'Instance ID', v: h.slug, num: true },
    { k: 'Legal Name', v: h.legalName || '—' },
    { k: 'GSTIN', v: h.gstin || 'Not on file', num: Boolean(h.gstin) },
    { k: 'Registration No.', v: h.registrationNo || 'Not on file' },
    { k: 'Payout Account', v: payoutAccountCopy(h) },
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
            {h.status !== 'closed' && canEditHospital && (
              <Button variant="secondary" icon="pencil" onClick={() => setModal('edit')}>
                Edit Profile
              </Button>
            )}
            {(isPending || isRejected) && canOnboarding && (
              <Button icon="rocket" onClick={() => navigate(onboardingHref)}>
                {isRejected ? 'Re-open in Onboarding' : 'Review in Onboarding'}
              </Button>
            )}
            {!isPending && !isRejected && h.status !== 'closed' && canEditHospital && (
              <Button
                variant={isSuspended ? 'secondary' : 'danger'}
                onClick={() => (isSuspended ? setModal('unsuspend') : openSuspend())}
              >
                {isSuspended ? 'Reactivate Instance' : 'Suspend Instance'}
              </Button>
            )}
            {h.subscription && h.status !== 'closed' && can('billing.edit') && (
              <Button onClick={() => setModal('plan')}>Manage Plan</Button>
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
                {isRejected ? 'Application rejected' : 'Suspended'}
                {suspension && !isRejected
                  ? ` — ${SUSPENSION_REASON_LABEL[suspension.reason].toLowerCase()}`
                  : ''}
              </div>
              {suspension && (
                <div className="text-caption text-text-muted">
                  Since {longDateFromTimestamp(suspension.suspendedAt)}
                  {suspension.note ? ` · ${suspension.note}` : ''}
                </div>
              )}
              {isRejected && h.onboarding?.rejectionReason && (
                <div className="text-caption text-text-muted">{h.onboarding.rejectionReason}</div>
              )}
              <div className="text-caption text-text-muted mt-1">
                {isRejected
                  ? 'The hospital stays suspended until its onboarding case is re-opened. Its staff can sign in and read, but every change is refused.'
                  : 'Staff can still sign in and view their records, but every change is refused and patients cannot book while this is in force.'}
              </div>
            </div>
            {!isRejected && canEditHospital && (
              <Button size="sm" variant="secondary" onClick={() => setModal('unsuspend')}>
                Lift Suspension
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card pad={14}>
        <Tabs tabs={tabs} value={activeTab} onChange={setTab} ariaLabel="Hospital profile" />
      </Card>

      {activeTab === TAB_OVERVIEW && (
        <>
          <InfoGrid items={infoItems} />
          <HospitalPatientAccessCard h={h} />
          {(isPending || h.firstAdminInvitation !== null) && (
            <FirstAdminInvitationCard
              hospitalId={h.id}
              hospitalName={h.name}
              invitation={h.firstAdminInvitation}
              adminAccepted={adminAccepted}
            />
          )}
          <Card>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <SectionTitle>Verification &amp; KYC</SectionTitle>
                {stage && <Badge status={stage[0]}>{stage[1]}</Badge>}
              </div>
              {canOnboarding && h.onboarding && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon="rocket"
                  onClick={() => navigate(onboardingHref)}
                >
                  Review in Onboarding
                </Button>
              )}
            </div>
            <div className="text-caption text-text-muted mb-3.5">
              {!h.onboarding
                ? 'This hospital has no onboarding case.'
                : isRejected
                  ? 'The application was rejected. Re-open the case on the onboarding pipeline to continue.'
                  : h.goLiveBlockers.length > 0
                    ? 'Documents are reviewed one by one on the onboarding pipeline. These items still block go-live:'
                    : isPending
                      ? 'Nothing is blocking go-live. Approve the instance on the onboarding pipeline.'
                      : 'Onboarding is complete.'}
            </div>
            {h.goLiveBlockers.length > 0 && !isRejected && (
              <ul className="flex list-none flex-col gap-1.5 p-0">
                {h.goLiveBlockers.map((b) => (
                  <li key={b.code} className="text-body text-text-body flex items-start gap-2">
                    <Icon name="circle-alert" size={15} className="text-y-600 mt-0.5 flex-none" />
                    <span>
                      {GO_LIVE_BLOCKER_LABEL[b.code] ?? GO_LIVE_BLOCKER_FALLBACK}
                      {b.details.length > 0 && (
                        <span className="text-caption text-text-muted">
                          {' '}
                          ({b.details.map((d) => d.replace(/_/g, ' ')).join(', ')})
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

      {activeTab === TAB_BILLING && (
        <>
          <Card pad={16} className="flex flex-wrap items-center gap-3.5">
            <div className="bg-blue-soft-bg text-text-navy flex size-10 flex-none items-center justify-center rounded-md">
              <Icon name="layers" size={19} />
            </div>
            <div className="min-w-50 flex-1">
              <div className="text-body text-text-strong font-medium">
                {planLabel}
                {planPrice !== null && (
                  <>
                    {' '}
                    · <span className="tabular-nums">{money(planPrice)}</span>
                    {isYearly ? '/yr' : '/mo'}
                  </>
                )}
              </div>
              <div className="text-caption text-text-muted">
                {h.subscription
                  ? `${h.subscription.status.replace('_', ' ')} · billed ${h.subscription.billingPeriod}${
                      h.subscription.currentPeriodEnd
                        ? ` · period ends ${longDateFromTimestamp(h.subscription.currentPeriodEnd)}`
                        : ''
                    }`
                  : 'This hospital has no current subscription.'}
              </div>
            </div>
            {canBillingView && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(opsBillingForHospitalPath(h.id))}
              >
                Open billing
              </Button>
            )}
            {can('plans.view') && (
              <Button size="sm" variant="secondary" onClick={() => navigate(opsPath('plans'))}>
                Plan Catalog
              </Button>
            )}
          </Card>
          <HospitalCommercialTermsCard h={h} />
          {canBillingView && <HospitalBankAccountsCard hospitalId={h.id} />}
          {canBillingView && <BillingHospitalCard hospitalId={h.id} />}
          {canSettlementsView && <OpsSettlementsHospitalCard hospitalId={h.id} />}
        </>
      )}

      {activeTab === TAB_SETUP && canEditHospital && (
        <>
          <HospitalNumberingCard hospitalId={h.id} />
          <HospitalTokenPolicyCard hospitalId={h.id} />
        </>
      )}

      {activeTab === TAB_ACTIVITY && <LogsHospitalActivityCard hospitalId={h.id} />}

      {modal === 'edit' && <HospitalEditProfileModal h={h} onClose={() => setModal(null)} />}
      {modal === 'plan' && h.subscription && (
        <ChangeSubscriptionModal
          subscriptionId={h.subscription.id}
          hospitalName={h.name}
          onClose={() => setModal(null)}
        />
      )}
      <OpsConfirm
        open={modal === 'suspend'}
        onClose={() => setModal(null)}
        icon="ban"
        tone="danger"
        title="Suspend this hospital?"
        body={suspendCopy(h.name)}
        summary={[
          { k: 'Hospital', v: h.name },
          { k: 'Plan', v: planLabel },
          { k: 'Active staff', v: h.staffCount.toLocaleString('en-IN'), num: true },
        ]}
        confirmLabel={suspendMutation.isPending ? 'Suspending…' : 'Suspend Instance'}
        confirmVariant="danger"
        busy={suspendMutation.isPending}
        onConfirm={handleSuspend}
      >
        <div className="flex w-full flex-col gap-3 text-left">
          <OpsField label="Reason">
            <Select
              value={SUSPENSION_REASON_LABEL[suspendReason]}
              options={SUSPEND_REASON_OPTIONS.map((r) => SUSPENSION_REASON_LABEL[r])}
              onChange={(label) =>
                setSuspendReason(
                  SUSPEND_REASON_OPTIONS.find((r) => SUSPENSION_REASON_LABEL[r] === label) ??
                    suspendReason,
                )
              }
              height={44}
            />
          </OpsField>
          <OpsField label="Note (kept on the record)">
            <TextInput
              value={suspendNote}
              onChange={setSuspendNote}
              maxLength={SUSPEND_NOTE_MAX}
              placeholder="e.g. Licence lapsed — awaiting renewal certificate"
              height={44}
            />
          </OpsField>
        </div>
      </OpsConfirm>
      <OpsConfirm
        open={modal === 'unsuspend'}
        onClose={() => setModal(null)}
        icon="circle-check"
        tone="success"
        title="Reactivate this hospital?"
        body={reactivateCopy(h)}
        confirmLabel={reinstateMutation.isPending ? 'Reactivating…' : 'Reactivate'}
        busy={reinstateMutation.isPending}
        onConfirm={handleReinstate}
      />
    </div>
  );
}
