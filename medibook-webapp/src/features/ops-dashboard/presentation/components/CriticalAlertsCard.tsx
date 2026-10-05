import { useNavigate } from 'react-router-dom';

import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';

import { opsPath } from '@/app/router/paths';

import type {
  OpsAlertHospital,
  OpsDashboardAlert,
} from '@/features/ops-dashboard/domain/entities/opsDashboard.entities';
import {
  ALERT_SEV_TINT,
  hospitalHref,
  MAX_ALERT_HOSPITAL_LINKS,
  plural,
  shortId,
  toAlertView,
} from '@/features/ops-dashboard/presentation/components/opsDashboardFormat';

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
  const views = alerts.map(toAlertView);

  return (
    <Card>
      <div className="mb-3.5 flex items-center justify-between">
        <SectionTitle>Critical Alerts</SectionTitle>
        <Badge status={views.length ? 'Failed' : 'Completed'}>{views.length} open</Badge>
      </div>
      <div className="flex flex-col gap-3.5">
        {views.map((a, ai) => {
          const t = ALERT_SEV_TINT[a.sev];
          const notLast = ai < views.length - 1;
          const links = a.hospitals.slice(0, MAX_ALERT_HOSPITAL_LINKS);
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
