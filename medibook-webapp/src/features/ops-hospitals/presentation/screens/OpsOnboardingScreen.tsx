import { useCallback, useState } from 'react';

import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { EmptyState } from '@/shared/ui/EmptyState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import { useHospitalsStore } from '@/features/ops-hospitals/application/store/hospitals.store';
import type { OpsHospital } from '@/features/ops-hospitals/application/store/hospitals.types';
import {
  docProgress,
  goLiveBlockers,
  stageOf,
} from '@/features/ops-hospitals/application/store/onboarding.derive';
import { useOnboardingStore } from '@/features/ops-hospitals/application/store/onboarding.store';
import {
  ONBOARDING_STAGES,
  type OnboardingCase,
  type OnboardingStage,
} from '@/features/ops-hospitals/application/store/onboarding.types';
import { OnboardingCasePanel } from '@/features/ops-hospitals/presentation/components/OnboardingCasePanel';
import { OnboardHospitalModal } from '@/features/ops-hospitals/presentation/components/OnboardHospitalModal';
import {
  STAGE_BADGE,
  STAGE_HINT,
  STAGE_ICON,
} from '@/features/ops-hospitals/presentation/components/onboarding.view';

/** One pipeline row: the application and the registry record it belongs to. */
interface PipelineRow {
  readonly hospital: OpsHospital;
  readonly onboarding: OnboardingCase;
  readonly stage: OnboardingStage;
  readonly blockers: number;
}

/** Tinted icon box per stage, reusing the ops accent pairs. */
const STAGE_TINT: Readonly<Record<OnboardingStage, string>> = {
  Application: 'bg-blue-soft-bg text-blue',
  'Documents requested': 'bg-y-100 text-y-600',
  'Under review': 'bg-badge-noshow-bg text-orange',
  Approved: 'bg-g-100 text-g-600',
  Live: 'bg-g-100 text-g-700',
};

/**
 * Hospital onboarding pipeline — audit SA-01 (`/ops/onboarding`).
 *
 * The audit found no screen that "creates the hospital's first administrator,
 * sends an invitation, or requests documents", and no way to approve KYC
 * documents "one by one". This is that screen: applications counted by stage
 * (application → documents requested → under review → approved → live), and
 * one selected application's administrators, checklist and per-document review
 * beside it, with go-live gated on every required document being approved and
 * an administrator having accepted.
 */
export function OpsOnboardingScreen() {
  const hospitals = useHospitalsStore((s) => s.hospitals);
  const syncedAt = useHospitalsStore((s) => s.syncedAt);
  const resyncHospitals = useHospitalsStore((s) => s.resync);
  const cases = useOnboardingStore((s) => s.cases);
  const resyncCases = useOnboardingStore((s) => s.resync);

  const [q, setQ] = useState('');
  const [stageF, setStageF] = useState<OnboardingStage | 'All'>('All');
  const [picked, setPicked] = useState<number | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await Promise.all([resyncHospitals(), resyncCases()]);
    } finally {
      setLoading(false);
    }
  }, [resyncHospitals, resyncCases]);

  const all: readonly PipelineRow[] = cases.flatMap((c) => {
    const hospital = hospitals.find((h) => h.id === c.hid);
    if (!hospital) return [];
    return [
      {
        hospital,
        onboarding: c,
        stage: stageOf(c),
        blockers: goLiveBlockers(c).length,
      },
    ];
  });

  const countFor = (stage: OnboardingStage): number => all.filter((r) => r.stage === stage).length;

  const ql = q.trim().toLowerCase();
  const rows = [...all]
    .filter(
      (r) =>
        (stageF === 'All' || r.stage === stageF) &&
        (!ql ||
          r.hospital.name.toLowerCase().includes(ql) ||
          r.hospital.city.toLowerCase().includes(ql) ||
          r.hospital.email.toLowerCase().includes(ql)),
    )
    // Applications that need work first, in pipeline order, then by name.
    .sort(
      (a, b) =>
        ONBOARDING_STAGES.indexOf(a.stage) - ONBOARDING_STAGES.indexOf(b.stage) ||
        a.hospital.name.localeCompare(b.hospital.name),
    );

  // Selection is derived, not stored in an effect: the picked hospital wins
  // while it is still in the filtered list, otherwise the first row does.
  const active = rows.find((r) => r.hospital.id === picked) ?? rows[0] ?? null;
  const filtersActive = Boolean(ql) || stageF !== 'All';
  const clearAll = (): void => {
    setQ('');
    setStageF('All');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {ONBOARDING_STAGES.map((stage) => {
          const count = countFor(stage);
          const selected = stageF === stage;
          return (
            <Card
              key={stage}
              pad={16}
              hover
              className={cn('min-w-0', selected && 'border-text-navy')}
              onClick={() => setStageF(selected ? 'All' : stage)}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex size-9 flex-none items-center justify-center rounded-md',
                    STAGE_TINT[stage],
                  )}
                >
                  <Icon name={STAGE_ICON[stage]} size={18} />
                </div>
                <span className="text-stat text-text-navy tabular-nums">{count}</span>
              </div>
              <div className="text-body text-text-strong mt-2.5 font-medium">{stage}</div>
              <div className="text-caption text-text-muted">{STAGE_HINT[stage]}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="mb-4">
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="Search applicant hospital, city or admin email"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RefreshBtn onRefresh={refresh} title="Refresh the onboarding pipeline" />
          <FilterSelect
            value={stageF}
            aria-label="Filter by onboarding stage"
            options={['Stage: All', ...ONBOARDING_STAGES]}
            onChange={(v) => setStageF(v === 'Stage: All' ? 'All' : (v as OnboardingStage))}
          />
          {filtersActive && <ClearChip onClick={clearAll} />}
          <div className="flex-1"></div>
          <span className="text-caption text-text-muted">Updated {syncedAt}</span>
          <Button icon="plus" onClick={() => setOnboarding(true)}>
            Onboard Hospital
          </Button>
        </div>
      </Card>

      {loading ? (
        <SkeletonCards count={3} lines={4} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="rocket"
            title="No applications match your filters."
            message="Every hospital in the network sits somewhere in this pipeline — clear the filters to see them all, or onboard a new applicant."
            actionLabel="Clear filters"
            onAction={clearAll}
          >
            <Button size="sm" icon="plus" onClick={() => setOnboarding(true)}>
              Onboard Hospital
            </Button>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <SectionTitle size={16}>
                {stageF === 'All' ? 'All applications' : stageF}
              </SectionTitle>
              <span className="text-caption text-text-muted tabular-nums">{rows.length}</span>
            </div>
            <div className="flex max-h-150 flex-col gap-2 overflow-y-auto">
              {rows.map((r) => {
                const selected = active?.hospital.id === r.hospital.id;
                const progress = docProgress(r.onboarding);
                return (
                  <button
                    key={r.hospital.id}
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => setPicked(r.hospital.id)}
                    className={cn(
                      'flex w-full flex-col gap-1.5 rounded-md border px-3.5 py-3 text-left transition-colors duration-150',
                      selected
                        ? 'border-text-navy bg-blue-soft-bg'
                        : 'border-border-soft hover:bg-grey-200 cursor-pointer',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-body text-text-strong truncate font-medium">
                        {r.hospital.name}
                      </span>
                      <Badge status={STAGE_BADGE[r.stage]}>{r.stage}</Badge>
                    </div>
                    <span className="text-caption text-text-muted truncate">
                      {r.hospital.city}
                      {r.hospital.st ? `, ${r.hospital.st}` : ''} · {r.hospital.plan}
                      {progress.total > 0
                        ? ` · ${progress.approved}/${progress.total} documents approved`
                        : ' · no checklist yet'}
                    </span>
                    {r.blockers > 0 && (
                      <span className="text-caption text-y-700 flex items-center gap-1.5">
                        <Icon name="circle-alert" size={13} className="flex-none" />
                        {r.blockers} blocker{r.blockers === 1 ? '' : 's'} before go-live
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          <div className="lg:col-span-2">
            {active ? (
              <OnboardingCasePanel
                key={active.hospital.id}
                hospital={active.hospital}
                onboarding={active.onboarding}
              />
            ) : (
              <Card>
                <EmptyState
                  icon="building-2"
                  title="Pick an application."
                  message="Choose a hospital on the left to review its administrators and documents."
                />
              </Card>
            )}
          </div>
        </div>
      )}

      {onboarding && (
        <OnboardHospitalModal
          open
          onClose={() => setOnboarding(false)}
          onDone={(hid) => {
            setOnboarding(false);
            // Land straight on the new application's case.
            setQ('');
            setStageF('All');
            setPicked(hid);
          }}
        />
      )}
    </div>
  );
}
