import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { CodeBlock } from '@/shared/ui/CodeBlock';
import { Drawer } from '@/shared/ui/Drawer';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TableShell, tdClass } from '@/shared/ui/TableShell';

import type { AuditLogEntry } from '@/features/ops-logs/domain/entities/logs.types';
import {
  actorLabel,
  formatLogTimeExact,
  jsonText,
  moduleLabel,
  principalLabel,
  SEVERITY_LABEL,
} from '@/features/ops-logs/presentation/components/logs.format';

const NONE = '—';
const CHANGE_COLUMNS = ['Field', 'Before', 'After'] as const;

interface LogEntryDrawerProps {
  entry: AuditLogEntry | null;
  onClose: () => void;
  /** Narrow the trail to this entry's actor (shown when it has one). */
  onFilterActor: (actorUserId: string) => void;
  /** Narrow the trail to this entry's hospital (shown when it has one and the role can pick it). */
  onFilterHospital?: (hospitalId: string) => void;
}

interface FactProps {
  label: string;
  value: string;
  mono?: boolean;
}

function Fact({ label, value, mono = false }: FactProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-caption text-text-faint">{label}</span>
      <span
        className={
          mono
            ? 'text-caption text-text-strong font-mono break-all'
            : 'text-body text-text-strong font-medium break-words'
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * One audit entry in full (12·R9): who, where from, the request, and the
 * masked before/after the backend recorded — the parts the table leaves out.
 */
export function LogEntryDrawer({
  entry,
  onClose,
  onFilterActor,
  onFilterHospital,
}: LogEntryDrawerProps) {
  if (!entry) return null;
  const before = jsonText(entry.before);
  const after = jsonText(entry.after);
  const meta = jsonText(entry.meta);
  const actorId = entry.actorUserId;
  const hospitalId = entry.hospitalId;

  return (
    <Drawer
      open
      onClose={onClose}
      width={620}
      title={entry.action}
      subtitle={formatLogTimeExact(entry.occurredAt)}
      footer={
        <>
          {actorId && (
            <Button
              size="sm"
              variant="secondary"
              icon="user"
              onClick={() => onFilterActor(actorId)}
            >
              This actor’s entries
            </Button>
          )}
          {hospitalId && onFilterHospital && (
            <Button
              size="sm"
              variant="secondary"
              icon="building-2"
              onClick={() => onFilterHospital(hospitalId)}
            >
              This hospital’s entries
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Fact label="Who" value={actorLabel(entry)} />
          <Fact label="Account type" value={principalLabel(entry.principal)} />
          <Fact label="Actor contact" value={entry.actorEmail ?? NONE} />
          <Fact
            label="Hospital"
            value={entry.hospitalName ?? (hospitalId ? hospitalId : 'Platform (no hospital)')}
          />
          <Fact label="Module" value={moduleLabel(entry.module)} />
          <div className="flex flex-col gap-1">
            <span className="text-caption text-text-faint">Severity</span>
            <span>
              {entry.severity ? (
                <Badge status={SEVERITY_LABEL[entry.severity]} />
              ) : (
                <span className="text-body text-text-muted">Not recorded</span>
              )}
            </span>
          </div>
          <Fact label="Resource" value={entry.resourceType} />
          <Fact label="Resource id" value={entry.resourceId ?? NONE} mono />
          <Fact label="Request" value={`${entry.method} ${entry.path}`} mono />
          <Fact label="Response status" value={String(entry.statusCode)} />
          <Fact label="IP address" value={entry.ip ?? NONE} mono />
          <Fact label="Request id" value={entry.requestId} mono />
          {actorId && <Fact label="Actor id" value={actorId} mono />}
        </div>

        {entry.changes.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <SectionTitle size={15}>Changes</SectionTitle>
            <TableShell columns={CHANGE_COLUMNS} scrollLabel="Changed fields">
              {entry.changes.map((c) => (
                <tr key={c.field}>
                  <td className={`${tdClass} font-medium`}>{c.field}</td>
                  <td className={`${tdClass} break-all`}>{c.before ?? NONE}</td>
                  <td className={`${tdClass} break-all`}>{c.after ?? NONE}</td>
                </tr>
              ))}
            </TableShell>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <SectionTitle size={15}>Before</SectionTitle>
          {before ? (
            <CodeBlock label="Record before the action">{before}</CodeBlock>
          ) : (
            <span className="text-body text-text-muted">Nothing recorded before this action.</span>
          )}
        </div>
        <div className="flex flex-col gap-2.5">
          <SectionTitle size={15}>After</SectionTitle>
          {after ? (
            <CodeBlock label="Record after the action">{after}</CodeBlock>
          ) : (
            <span className="text-body text-text-muted">Nothing recorded after this action.</span>
          )}
        </div>
        {meta && (
          <div className="flex flex-col gap-2.5">
            <SectionTitle size={15}>Context</SectionTitle>
            <CodeBlock label="Context recorded with the action">{meta}</CodeBlock>
          </div>
        )}
        <p className="text-caption text-text-muted m-0">
          Personal details are masked before an entry is written, so phone numbers, emails and
          documents never appear here in full.
        </p>
      </div>
    </Drawer>
  );
}
