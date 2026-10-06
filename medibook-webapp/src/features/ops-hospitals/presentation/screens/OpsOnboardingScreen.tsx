import { useState } from 'react';

import { isFailure } from '@/core/error/failure';

import { cn } from '@/shared/lib/cn';
import { calendarDate, fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { ClearChip } from '@/shared/ui/ClearChip';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { Icon } from '@/shared/ui/Icon';
import { RefreshBtn } from '@/shared/ui/RefreshBtn';
import { SearchField } from '@/shared/ui/SearchField';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { SkeletonCards } from '@/shared/ui/Skeleton';

import type { OnboardingCaseStage } from '@/features/ops-hospitals/domain/entities/onboarding.entity';
import { useOnboardingCasesQuery } from '@/features/ops-hospitals/application/queries/useOnboardingCasesQuery';
import { OnboardingCasePanel } from '@/features/ops-hospitals/presentation/components/OnboardingCasePanel';
import {
  PIPELINE_STAGES,
  STAGE_CONTEXT,
  STAGE_GLYPH,
  STAGE_LABEL,
  STAGE_PILL,
  STAGE_TINT,
} from '@/features/ops-hospitals/presentation/components/onboarding.status';

const ALL_STAGES = 'Stage: All';

/** ISO timestamp → "12 Oct 2026"; empty for none. */
function dateCopy(iso: string | null): string {
  return iso ? fmtDate(calendarDate(iso)) : '';
}

/**
 * Hospital onboarding pipeline — audit SA-01 (`/ops/onboarding`), on
 * `/platform/onboarding/cases` (P3).
 *
 * Applications counted by the server's stage (application → documents
 * requested → under review → approved → live, plus rejected), and one
 * selected application's checklist, administrator status and go-live gate
 * beside it. New hospitals are created from the Hospitals registry; the
 * console's Onboard Hospital modal is not wired to the API yet, so it is not
 * offered here.
 */
export function OpsOnboardingScreen() {
  const pipeline = useOnboardingCasesQuery();

  const [q, setQ] = useState('');
  const [stageF, setStageF] = useState<OnboardingCaseStage | 'All'>('All');
  const [picked, setPicked] = useState<string | null>(null);

  const cases = pipeline.data?.cases ?? [];
  const counts = pipeline.data?.counts;

  const ql = q.trim().toLowerCase();
  const rows = cases
    .filter(
      (c) =>
        (stageF === 'All' || c.stage === stageF) &&
        (!ql || c.hospitalName.toLowerCase().includes(ql)),
    )
    // Applications that need work first, in pipeline order, then by name.
    .sort(
      (a, b) =>
        PIPELINE_STAGES.indexOf(a.stage) - PIPELINE_STAGES.indexOf(b.stage) ||
        a.hospitalName.localeCompare(b.hospitalName),
    );

  // Selection is derived, not stored in an effect: the picked case wins while
  // it is still in the filtered list, otherwise the first row does.
  const active = rows.find((c) => c.id === picked) ?? rows[0] ?? null;
  const filtersActive = Boolean(ql) || stageF !== 'All';
  const clearAll = (): void => {
    setQ('');
    setStageF('All');
  };
  const truncated = pipeline.data ? pipeline.data.total > cases.length : false;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {PIPELINE_STAGES.map((stage) => {
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
                  <Icon name={STAGE_GLYPH[stage]} size={18} />
                </div>
                <span className="text-stat text-text-navy tabular-nums">
                  {counts ? counts[stage] : '—'}
                </span>
              </div>
              <div className="text-body text-text-strong mt-2.5 font-medium">
                {STAGE_LABEL[stage]}
              </div>
              <div className="text-caption text-text-muted">{STAGE_CONTEXT[stage]}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="mb-4">
          <SearchField value={q} onChange={setQ} placeholder="Search applicant hospital by name" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RefreshBtn
            onRefresh={async () => {
              await pipeline.refetch();
            }}
            title="Refresh the onboarding pipeline"
          />
          <FilterSelect
            value={stageF === 'All' ? ALL_STAGES : STAGE_LABEL[stageF]}
            aria-label="Filter by onboarding stage"
            options={[ALL_STAGES, ...PIPELINE_STAGES.map((s) => STAGE_LABEL[s])]}
            onChange={(v) => setStageF(PIPELINE_STAGES.find((s) => STAGE_LABEL[s] === v) ?? 'All')}
          />
          {filtersActive && <ClearChip onClick={clearAll} />}
          <div className="flex-1"></div>
          {truncated && pipeline.data && (
            <span className="text-caption text-text-muted">
              Showing the newest {cases.length} of {pipeline.data.total} applications
            </span>
          )}
        </div>
      </Card>

      {pipeline.isPending ? (
        <SkeletonCards count={3} lines={4} />
      ) : pipeline.isLoadingError ? (
        <ErrorState
          title="The onboarding pipeline didn't load"
          message={isFailure(pipeline.error) ? pipeline.error.message : undefined}
          onRetry={() => void pipeline.refetch()}
        />
      ) : cases.length === 0 ? (
        <Card>
          <EmptyState
            icon="rocket"
            title="No applications yet."
            message="A case opens here as soon as a hospital is created in the Hospitals registry."
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="search"
            title="No applications match your filters."
            message="Clear the filters to see the whole pipeline."
            actionLabel="Clear filters"
            onAction={clearAll}
          />
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <SectionTitle size={16}>
                {stageF === 'All' ? 'All applications' : STAGE_LABEL[stageF]}
              </SectionTitle>
              <span className="text-caption text-text-muted tabular-nums">{rows.length}</span>
            </div>
            <div className="flex max-h-150 flex-col gap-2 overflow-y-auto">
              {rows.map((c) => {
                const selected = active?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => setPicked(c.id)}
                    className={cn(
                      'flex w-full flex-col gap-1.5 rounded-md border px-3.5 py-3 text-left transition-colors duration-150',
                      selected
                        ? 'border-text-navy bg-blue-soft-bg'
                        : 'border-border-soft hover:bg-grey-200 cursor-pointer',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-body text-text-strong truncate font-medium">
                        {c.hospitalName}
                      </span>
                      <Badge status={STAGE_PILL[c.stage]}>{STAGE_LABEL[c.stage]}</Badge>
                    </div>
                    <span className="text-caption text-text-muted truncate">
                      Instance {c.hospitalStatus}
                      {c.submittedAt ? ` · applied ${dateCopy(c.submittedAt)}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
          <div className="lg:col-span-2">
            {active ? (
              <OnboardingCasePanel key={active.id} summary={active} />
            ) : (
              <Card>
                <EmptyState
                  icon="building-2"
                  title="Pick an application."
                  message="Choose a hospital on the left to review its checklist and go-live gate."
                />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
