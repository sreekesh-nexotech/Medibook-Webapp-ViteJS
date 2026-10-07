import { useNavigate } from 'react-router-dom';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';
import type { TableStateSpec } from '@/shared/ui/TableState';

import { opsLogsPath } from '@/app/router/paths';

import { useLogsQuery } from '@/features/ops-logs/application/queries/useLogsQuery';
import type { AuditLogQuery } from '@/features/ops-logs/domain/entities/logs.types';
import { actorLabel, formatLogTime } from '@/features/ops-logs/presentation/components/logs.format';

/** Entries shown; Compliance Logs has the full, searchable trail. */
const RECENT_ROWS = 10;

const COLUMNS = ['Action', 'Who', 'Resource', 'Timestamp'] as const;

interface LogsHospitalActivityCardProps {
  hospitalId: string;
}

/**
 * The latest audit-trail entries recorded against one hospital (approvals,
 * suspensions, document decisions, settlement releases), for its ops profile.
 */
export function LogsHospitalActivityCard({ hospitalId }: LogsHospitalActivityCardProps) {
  const navigate = useNavigate();
  // `/platform/logs` needs `logs.view`; finance opens hospital profiles
  // without it (12·F14), so the card explains instead of firing a 403.
  const canView = useOpsPermission().can('logs.view');
  const query: AuditLogQuery = { page: 1, pageSize: RECENT_ROWS, hospitalId };
  const logs = useLogsQuery(query, canView);
  const rows = logs.data?.items ?? [];

  let state: TableStateSpec | undefined;
  if (logs.isPending) state = { kind: 'loading', rows: 4 };
  else if (logs.isError) state = { kind: 'error', onRetry: () => void logs.refetch() };
  else if (rows.length === 0)
    state = {
      kind: 'empty',
      icon: 'scroll-text',
      title: 'No logged activity for this hospital yet.',
    };

  if (!canView) {
    return (
      <Card>
        <EmptyState
          icon="lock"
          title="Compliance activity is not part of your role."
          message="Ask an owner for compliance-log access to see this hospital's audit trail."
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle>Compliance Activity</SectionTitle>
        <button
          type="button"
          onClick={() => navigate(opsLogsPath(hospitalId))}
          className="text-body text-blue cursor-pointer border-none bg-transparent p-0"
        >
          Open compliance logs
        </button>
      </div>
      <TableShell columns={COLUMNS} scrollLabel="This hospital's activity" state={state}>
        {rows.map((l) => (
          <tr key={l.id}>
            <td className={tdClass}>{l.action}</td>
            <td className={tdClass}>{actorLabel(l)}</td>
            <td className={tdClass}>{l.resourceType}</td>
            <td className={tdClass}>{formatLogTime(l.occurredAt)}</td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}
