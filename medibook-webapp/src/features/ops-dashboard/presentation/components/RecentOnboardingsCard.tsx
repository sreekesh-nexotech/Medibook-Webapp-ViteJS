import { useNavigate } from 'react-router-dom';

import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { IconBtn } from '@/shared/ui/IconBtn';
import type { OpsTint } from '@/shared/ui/OpsConfirm';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import { opsOnboardingPath, opsPath } from '@/app/router/paths';

import type { RecentOnboarding } from '@/features/ops-dashboard/domain/entities/opsDashboard.entities';
import {
  fmtDateTime,
  hospitalHref,
  stageView,
} from '@/features/ops-dashboard/presentation/components/opsDashboardFormat';

const COLUMNS = ['Hospital', 'Stage', 'Started', 'Action'] as const;

/** Rotating icon-box tint by row (design `opsTintOf`). */
const TINT_CYCLE = ['primary', 'info', 'success', 'warning', 'neutral'] as const;
const opsTintOf = (i: number): OpsTint => TINT_CYCLE[i % TINT_CYCLE.length];

interface RecentOnboardingsCardProps {
  rows: readonly RecentOnboarding[];
}

/**
 * "Recent Hospital Onboardings" — the five newest onboarding cases from
 * `/platform/dashboard`, each opening that hospital's ops profile.
 */
export function RecentOnboardingsCard({ rows }: RecentOnboardingsCardProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle>Recent Hospital Onboardings</SectionTitle>
        <button
          type="button"
          onClick={() => navigate(opsOnboardingPath())}
          className="text-body text-blue cursor-pointer font-medium"
        >
          View All
        </button>
      </div>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Recent hospital onboardings"
        state={
          rows.length === 0
            ? {
                kind: 'empty',
                icon: 'building-2',
                title: 'No hospitals onboarded yet.',
                message:
                  'New onboarding cases appear here, newest first — start from the hospital registry.',
                actionLabel: 'Open hospital registry',
                onAction: () => navigate(opsPath('hospitals')),
              }
            : undefined
        }
      >
        {rows.map((r, i) => {
          const stage = stageView(r.stage);
          return (
            <tr
              key={r.caseId}
              onClick={() => navigate(hospitalHref(r.hospitalId))}
              className="hover:bg-grey-200 cursor-pointer transition-colors duration-150"
            >
              <td className={tdClass}>
                <OpsEntity icon="building-2" tint={opsTintOf(i)} title={r.hospitalName} />
              </td>
              <td className={tdClass}>
                <Badge status={stage.badge}>{stage.label}</Badge>
              </td>
              <td className={tdClass}>{fmtDateTime(r.createdAt)}</td>
              <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                <IconBtn
                  name="eye"
                  box={36}
                  size={16}
                  label="View hospital"
                  title={`View ${r.hospitalName}`}
                  onClick={() => navigate(hospitalHref(r.hospitalId))}
                />
              </td>
            </tr>
          );
        })}
      </TableShell>
    </Card>
  );
}
