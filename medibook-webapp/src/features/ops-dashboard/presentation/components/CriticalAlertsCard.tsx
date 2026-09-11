import { useNavigate } from 'react-router-dom';

import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import type { IconName } from '@/shared/ui/icon-registry';

import { opsHospitalDetailPath, opsPath } from '@/app/router/paths';

import { useInboxStore } from '@/features/ops-dashboard/application/store/inbox.store';
import type {
  OpsAlertSeverity,
  OpsAlertTarget,
} from '@/features/ops-dashboard/application/store/inbox.types';

/** Severity tint: [icon-box bg, icon-box fg, glyph] (design `sevTint`). */
const SEV_TINT: Record<OpsAlertSeverity, readonly [string, string, IconName]> = {
  danger: ['bg-d-100', 'text-d-500', 'circle-x'],
  warning: ['bg-y-100', 'text-y-600', 'triangle-alert'],
};

/**
 * "Critical Alerts" card — severity-tinted rows that navigate to the related
 * screen on click (`hospital:<id>` → that hospital's ops profile) and a
 * "Resolve Now" action per alert.
 */
export function CriticalAlertsCard() {
  const navigate = useNavigate();
  const alerts = useInboxStore((s) => s.alerts);
  const resolveAlert = useInboxStore((s) => s.resolveAlert);

  const goTarget = (go: OpsAlertTarget) => {
    if (go === 'settlements' || go === 'logs') {
      navigate(opsPath(go));
      return;
    }
    navigate(opsHospitalDetailPath(Number(go.split(':')[1])));
  };

  return (
    <Card>
      <div className="mb-3.5 flex items-center justify-between">
        <SectionTitle>Critical Alerts</SectionTitle>
        <Badge status={alerts.length ? 'Failed' : 'Completed'}>{alerts.length} open</Badge>
      </div>
      <div className="flex flex-col gap-3.5">
        {alerts.map((a, ai) => {
          const t = SEV_TINT[a.sev];
          const notLast = ai < alerts.length - 1;
          return (
            <div
              key={a.id}
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
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => goTarget(a.go)}
                title="Open the related screen"
              >
                <div className="text-body text-text-strong font-medium">{a.title}</div>
                <div className="text-caption text-text-muted">{a.sub}</div>
                <div className="mt-2">
                  <Button size="sm" variant="secondary" onClick={() => resolveAlert(a.id)}>
                    Resolve Now
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {alerts.length === 0 && (
          <EmptyState
            icon="circle-check"
            title="No critical alerts."
            message="Every hospital instance is healthy. Payout failures and compliance events show up here as they happen."
            actionLabel="Open compliance logs"
            onAction={() => navigate(opsPath('logs'))}
          />
        )}
      </div>
    </Card>
  );
}
