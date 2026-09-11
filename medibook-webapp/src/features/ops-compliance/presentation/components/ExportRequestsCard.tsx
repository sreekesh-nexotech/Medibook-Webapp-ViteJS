import { cn } from '@/shared/lib/cn';
import { fmtDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { OpsEntity } from '@/shared/ui/OpsEntity';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import type {
  ExportRequest,
  ExportStatus,
} from '@/features/ops-compliance/application/store/compliance.types';

const COLUMNS = [
  'Request',
  'Subject',
  'Period covered',
  'Requested by',
  'Requested at',
  'Rows',
  'Status',
] as const;

/** Status → the shared status token whose tint already means that. */
const STATUS_TOKEN: Readonly<Record<ExportStatus, string>> = {
  Preparing: 'Requested',
  Completed: 'Completed',
  'No data': 'Inactive',
};

interface ExportRequestsCardProps {
  requests: readonly ExportRequest[];
}

/**
 * The export-on-request register.
 *
 * THE LAW, made visible: a request is recorded as `Preparing` while the rows
 * are gathered, `Completed` only once a file has been written (with the
 * filename and row count next to it), and `No data` when the request matched
 * nothing — the one case where no file exists and nothing pretends otherwise.
 */
export function ExportRequestsCard({ requests }: ExportRequestsCardProps) {
  return (
    <Card>
      <SectionTitle className="mb-4">Recorded Exports</SectionTitle>
      <TableShell
        columns={COLUMNS}
        scrollLabel="Recorded data-subject exports"
        rightCols={['Rows']}
        state={
          requests.length === 0
            ? {
                kind: 'empty',
                icon: 'file-down',
                title: 'No exports requested yet.',
                message:
                  'Requests you prepare above are recorded here with their status, row count and filename.',
              }
            : undefined
        }
      >
        {requests.map((r) => (
          <tr key={r.id}>
            <td className={cn(tdClass, 'whitespace-nowrap')}>
              <OpsEntity
                icon="file-down"
                tint={
                  r.status === 'Completed'
                    ? 'success'
                    : r.status === 'Preparing'
                      ? 'warning'
                      : 'neutral'
                }
                title={r.id}
                sub={r.kind}
              />
            </td>
            <td className={cn(tdClass, 'max-w-80')}>{r.subject}</td>
            <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>
              {fmtDate(r.from)} – {fmtDate(r.to)}
            </td>
            <td className={tdClass}>{r.requestedBy}</td>
            <td className={cn(tdClass, 'whitespace-nowrap tabular-nums')}>{r.requestedAt}</td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>
              {r.status === 'Completed' ? r.rows.toLocaleString('en-IN') : '—'}
            </td>
            <td className={tdClass}>
              <div className="flex flex-col items-start gap-1">
                <Badge status={STATUS_TOKEN[r.status]}>{r.status}</Badge>
                <span className="text-caption text-text-muted">
                  {r.status === 'Completed' && r.file
                    ? r.file
                    : r.status === 'Preparing'
                      ? 'Gathering records…'
                      : 'No records in range — nothing was written'}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}
