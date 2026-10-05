import { useNavigate } from 'react-router-dom';

import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import type { IconName } from '@/shared/ui/icon-registry';

import { opsOnboardingPath, opsPath } from '@/app/router/paths';

import type {
  OpsAlertHospital,
  OpsDashboardAlert,
} from '@/features/ops-dashboard/domain/entities/opsDashboard.entities';
import {
  hospitalHref,
  plural,
  shortId,
} from '@/features/ops-dashboard/presentation/components/opsDashboardFormat';

type AlertSeverity = 'danger' | 'warning';

/** Severity tint: [icon-box bg, icon-box fg, glyph] (design `sevTint`). */
const SEV_TINT: Record<AlertSeverity, readonly [string, string, IconName]> = {
  danger: ['bg-d-100', 'text-d-500', 'circle-x'],
  warning: ['bg-y-100', 'text-y-600', 'triangle-alert'],
};

/** Hospitals an alert links to directly before the rest collapse into "+N more". */
const MAX_HOSPITAL_LINKS = 3;

interface AlertView {
  readonly key: string;
  readonly sev: AlertSeverity;
  readonly title: string;
  readonly sub: string;
  /** Hospitals to open, one button each. */
  readonly hospitals: readonly OpsAlertHospital[];
  /** A single screen to open instead. */
  readonly action?: { readonly label: string; readonly to: string };
}

function namesOf(hospitals: readonly OpsAlertHospital[]): string {
  const named = hospitals.map((h) => h.name ?? shortId(h.id));
  const shown = named.slice(0, MAX_HOSPITAL_LINKS).join(', ');
  const rest = named.length - MAX_HOSPITAL_LINKS;
  return rest > 0 ? `${shown} +${rest} more` : shown;
}

/** What each computed alert says and where it leads. */
function toView(alert: OpsDashboardAlert): AlertView {
  switch (alert.code) {
    case 'hospitals_in_grace':
      return {
        key: alert.code,
        sev: 'warning',
        title: `${plural(alert.count, 'hospital')} past due or in grace`,
        sub: namesOf(alert.hospitals),
        hospitals: alert.hospitals,
      };
    case 'hospitals_read_only':
      return {
        key: alert.code,
        sev: 'danger',
        title: `${plural(alert.count, 'hospital')} in read-only mode`,
        sub: `Unpaid subscription · ${namesOf(alert.hospitals)}`,
        hospitals: alert.hospitals,
      };
    case 'unreconciled_cash_sessions':
      return {
        key: alert.code,
        sev: 'warning',
        title: `${plural(alert.count, 'cash session')} unreconciled for over a day`,
        sub: `Across ${plural(alert.hospitals.length, 'hospital')}`,
        hospitals: alert.hospitals,
      };
    case 'dead_outbox_rows':
      return {
        key: alert.code,
        sev: 'danger',
        title: `${plural(alert.count, 'notification')} failed permanently`,
        sub: 'Messages the outbox stopped retrying. Check the messaging provider configuration.',
        hospitals: [],
      };
    case 'pending_onboarding':
      return {
        key: alert.code,
        sev: 'warning',
        title: `${plural(alert.count, 'onboarding case')} in progress`,
        sub:
          alert.olderThan7Days > 0
            ? `${plural(alert.olderThan7Days, 'case')} open for more than 7 days`
            : 'All opened within the last 7 days',
        hospitals: [],
        action: { label: 'Open onboarding', to: opsOnboardingPath() },
      };
    case 'unknown':
      return {
        key: alert.rawCode,
        sev: 'warning',
        title: `${alert.rawCode.replaceAll('_', ' ')} (${alert.count})`,
        sub: 'Reported by the platform',
        hospitals: [],
      };
  }
}

/** Button label for one hospital an alert names. */
function hospitalLabel(h: OpsAlertHospital): string {
  const who = h.name ?? `Hospital ${shortId(h.id)}`;
  return h.sessions === null ? who : `${who} · ${plural(h.sessions, 'session')}`;
}

interface CriticalAlertsCardProps {
  alerts: readonly OpsDashboardAlert[];
}

/**
 * "Critical Alerts" — conditions `/platform/dashboard` computes on every read
 * (dunning, cash reconciliation, dead outbox rows, slow onboarding). They
 * clear when the condition does, so each alert leads to where it can be
 * fixed rather than offering a dismiss button.
 */
export function CriticalAlertsCard({ alerts }: CriticalAlertsCardProps) {
  const navigate = useNavigate();
  const views = alerts.map(toView);

  return (
    <Card>
      <div className="mb-3.5 flex items-center justify-between">
        <SectionTitle>Critical Alerts</SectionTitle>
        <Badge status={views.length ? 'Failed' : 'Completed'}>{views.length} open</Badge>
      </div>
      <div className="flex flex-col gap-3.5">
        {views.map((a, ai) => {
          const t = SEV_TINT[a.sev];
          const notLast = ai < views.length - 1;
          const links = a.hospitals.slice(0, MAX_HOSPITAL_LINKS);
          return (
            <div
              key={a.key}
              className={cn(
                'flex items-start gap-3',
                notLast && 'border-border-soft border-b pb-3.5',
              )}
            >
              <div
                className={cn(
                  'flex size-9.5 flex-none items-center justify-center rounded-md',
                  t[0],
                  t[1],
                )}
              >
                <Icon name={t[2]} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-body text-text-strong font-medium">{a.title}</div>
                <div className="text-caption text-text-muted">{a.sub}</div>
                {(links.length > 0 || a.action) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {links.map((h) => (
                      <Button
                        key={h.id}
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(hospitalHref(h.id))}
                      >
                        {hospitalLabel(h)}
                      </Button>
                    ))}
                    {a.action && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => a.action && navigate(a.action.to)}
                      >
                        {a.action.label}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {views.length === 0 && (
          <EmptyState
            icon="circle-check"
            title="No critical alerts."
            message="No hospital is past due, cash desks are reconciled and onboarding is moving. New problems show up here as they happen."
            actionLabel="Open compliance logs"
            onAction={() => navigate(opsPath('logs'))}
          />
        )}
      </div>
    </Card>
  );
}
